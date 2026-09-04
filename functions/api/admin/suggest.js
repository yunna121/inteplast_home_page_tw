import { json, fail } from "../_lib.js";

/* 用 LLM 產生別名候選 → 寫進 synonym_suggestions 待審
   ------------------------------------------------------------
   POST /api/admin/suggest  { product_id: 3 }   單一產品
   POST /api/admin/suggest  { all: true }       全部產品

   為什麼要待審：機器一定會產出「看起來合理但錯」的別名
   （清潔袋 → 保鮮袋）。錯的別名比缺別名更糟 —— 客戶會被導到
   錯的產品，而且沒人會發現。所以這裡只寫進待審表，
   人在編輯頁按「採用」才會進 synonyms。

   需要在 Pages → Settings → Bindings 綁 Workers AI，變數名 AI。 */

const MODEL = "@cf/qwen/qwen1.5-14b-chat-awq";

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

function parseList(text) {
  const raw = String(text || "");
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => String(x || "").trim())
      .filter((x) => x.length >= 2 && x.length <= 12)
      .slice(0, 10);
  } catch (err) {
    return [];
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  if (request.method !== "POST") return json({ error: "只接受 POST" }, 405);
  if (!env.AI) {
    return json({ error: "還沒綁定 Workers AI。請到 Pages → Settings → Bindings 新增，變數名 AI" }, 500);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const wantAll = !!body.all;
    const productId = Number(body.product_id || 0);

    const products = wantAll
      ? (await DB.prepare("SELECT * FROM products ORDER BY id").all()).results || []
      : [await DB.prepare("SELECT * FROM products WHERE id = ?").bind(productId).first()].filter(Boolean);

    if (!products.length) return json({ error: "找不到產品" }, 404);

    // 已經有的別名（含已退回的建議）不要重複產生
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

    for (const product of products) {
      const res = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: "你只輸出 JSON 陣列，不輸出任何其他文字。" },
          { role: "user", content: buildPrompt(product) },
        ],
        max_tokens: 300,
      });

      const words = parseList(res && (res.response || res.result || res));
      if (!words.length) {
        skipped.push({ product_id: product.id, name: product.name, reason: "模型沒有回傳可用的詞" });
        continue;
      }

      const stmts = [];
      words.forEach((say) => {
        if (String(say).trim().toLowerCase() === String(product.name).trim().toLowerCase()) return;
        if (taken.has(product.id + "\u0000" + say.toLowerCase())) return;
        stmts.push(
          DB.prepare(
            "INSERT OR IGNORE INTO synonym_suggestions (product_id, say, source) VALUES (?, ?, 'ai')"
          ).bind(product.id, say)
        );
        added.push({ product_id: product.id, product_name: product.name, say });
      });

      if (stmts.length) await DB.batch(stmts);
    }

    return json({ ok: true, added, skipped, model: MODEL });
  } catch (error) {
    return fail(error);
  }
}
