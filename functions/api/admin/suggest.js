import { json, fail } from "../_lib.js";

/* 用 LLM 產生別名候選 → 寫進 synonym_suggestions 待審
   ------------------------------------------------------------
   POST /api/admin/suggest  { product_id: 3 }   單一產品
   POST /api/admin/suggest  { all: true }       全部產品

   為什麼要待審：機器一定會產出「看起來合理但錯」的別名
   （清潔袋 → 保鮮袋）。錯的別名比缺別名更糟 —— 客戶會被導到
   錯的產品，而且沒人會發現。所以這裡只寫進待審表，
   人在編輯頁按「採用」才會進 synonyms。

   模型：Cloudflare 的目錄換得很快（先前寫死的 qwen1.5 已於
   2025-10 下架），所以這裡準備一組候選、依序嘗試，第一個跑得
   起來的就用，並在回傳裡告訴前端用了哪一支。
   要指定特定模型就在 Pages 設環境變數 AI_MODEL。

   需要在 Pages → 設定 → 繫結 新增 Workers AI，變數名稱 AI。 */

const MODELS = [
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/qwen/qwen3-30b-a3b",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/openai/gpt-oss-20b",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
  "@cf/meta/llama-3.1-8b-instruct",
];

function buildPrompt(product) {
  return `你是台灣塑膠製品公司的電商搜尋顧問。

產品資料：
- 品名：${product.name}
- 重點：${product.highlight || "（無）"}
- 說明：${product.desc || "（無）"}
- 細項：${product.items || "（無）"}

請列出台灣的採購人員、店家或一般消費者在搜尋這個產品時，
可能會輸入但與正式品名不同的字詞（別名、俗稱、口語說法、常見英文）。

規則：
1. 只輸出 JSON 陣列，不要任何解釋或標點以外的文字
2. 每個詞 2 到 12 個字，最多 10 個詞
3. 不要包含正式品名本身，也不要包含細項裡已經有的詞
4. 不要臆測這個產品沒有的用途或材質
5. 台灣用語優先（例如「垃圾袋」而不是「垃圾口袋」）

範例輸出格式：
["垃圾袋","廚餘袋","trash bag"]`;
}

/** 不同模型的回傳結構不一樣，這裡統一抽出純文字 */
function textOf(res) {
  if (!res) return "";
  if (typeof res === "string") return res;
  if (typeof res.response === "string") return res.response;
  if (res.result && typeof res.result.response === "string") return res.result.response;
  if (Array.isArray(res.output)) {
    // gpt-oss 這類的結構：output[].content[].text
    return res.output
      .map((o) => (o && Array.isArray(o.content) ? o.content.map((c) => (c && c.text) || "").join("") : ""))
      .join("\n");
  }
  if (Array.isArray(res.choices) && res.choices[0] && res.choices[0].message) {
    const content = res.choices[0].message.content;
    if (typeof content === "string") return content;
  }
  return JSON.stringify(res);
}

function parseList(text) {
  const raw = String(text || "");
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");

  let words = [];
  if (start > -1 && end > start) {
    try {
      const arr = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(arr)) words = arr.map((x) => String(x || ""));
    } catch (err) { /* 落到下面的寬鬆解析 */ }
  }

  // 模型沒有照格式輸出時，退而用換行／逗號切開
  if (!words.length) {
    words = raw
      .replace(/^[\s\S]*?[:：]/, "")
      .split(/[\n,，、]+/)
      .map((x) => x.replace(/^[\s\-*\d.、"'`]+|["'`]+$/g, ""));
  }

  const seen = new Set();
  return words
    .map((x) => x.trim())
    .filter((x) => {
      if (x.length < 2 || x.length > 12) return false;
      if (/[。！？]/.test(x)) return false;
      const key = x.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  if (request.method !== "POST") return json({ error: "只接受 POST" }, 405);
  if (!env.AI) {
    return json({ error: "還沒繫結 Workers AI。請到 Pages → 設定 → 繫結 新增，變數名稱 AI" }, 500);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const wantAll = !!body.all;
    const productId = Number(body.product_id || 0);
    const candidates = env.AI_MODEL ? [env.AI_MODEL, ...MODELS] : MODELS;

    const products = wantAll
      ? (await DB.prepare("SELECT * FROM products ORDER BY id").all()).results || []
      : [await DB.prepare("SELECT * FROM products WHERE id = ?").bind(productId).first()].filter(Boolean);

    if (!products.length) return json({ error: "找不到產品" }, 404);

    const [existing, rejected] = await Promise.all([
      DB.prepare("SELECT product_id, say FROM synonyms").all(),
      DB.prepare("SELECT product_id, say FROM synonym_suggestions WHERE status = 'rejected'").all(),
    ]);
    const taken = new Set();
    [...(existing.results || []), ...(rejected.results || [])].forEach((r) => {
      taken.add(r.product_id + "\u0000" + String(r.say).toLowerCase());
    });

    const added = [];
    const skipped = [];
    const errors = [];
    let usedModel = null;

    for (const product of products) {
      let words = [];

      // 已經找到可用的模型就只用那一支，否則依序試
      for (const model of usedModel ? [usedModel] : candidates) {
        try {
          const res = await env.AI.run(model, {
            messages: [
              { role: "system", content: "你只輸出 JSON 陣列，不輸出任何其他文字。" },
              { role: "user", content: buildPrompt(product) },
            ],
            max_tokens: 300,
          });
          words = parseList(textOf(res));
          if (words.length) {
            usedModel = model;
            break;
          }
        } catch (err) {
          const message = String((err && err.message) || err);
          if (errors.indexOf(model + "：" + message) === -1) errors.push(model + "：" + message);
        }
      }

      if (!words.length) {
        skipped.push({ product_id: product.id, name: product.name });
        continue;
      }

      const stmts = [];
      words.forEach((say) => {
        if (say.trim().toLowerCase() === String(product.name).trim().toLowerCase()) return;
        if (taken.has(product.id + "\u0000" + say.toLowerCase())) return;
        taken.add(product.id + "\u0000" + say.toLowerCase());
        stmts.push(
          DB.prepare(
            "INSERT OR IGNORE INTO synonym_suggestions (product_id, say, source) VALUES (?, ?, 'ai')"
          ).bind(product.id, say)
        );
        added.push({ product_id: product.id, product_name: product.name, say });
      });

      if (stmts.length) await DB.batch(stmts);
    }

    if (!added.length && errors.length) {
      return json({ error: "所有模型都試過了：" + errors.join("｜") }, 502);
    }

    return json({ ok: true, added, skipped, model: usedModel, errors });
  } catch (error) {
    return fail(error);
  }
}
