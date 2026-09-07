import { json, fail } from "../_lib.js";

/* 用 LLM 產生翻譯草稿（不寫入資料庫）
   ------------------------------------------------------------
   POST /api/admin/translate
   { entity: 'product'|'timeline', id: 3, lang: 'ja', fields: ['name','desc'] }

   回傳 { ok, draft: { name: '…', desc: '…' }, model }

   刻意「只回傳、不寫入」：翻譯是要給客戶看的文字，機器譯稿一定
   要有人過目。前端把結果填進表單欄位，使用者改完按儲存才進資料庫。
   不滿意就關掉，資料庫完全沒被碰過。

   需要 Workers AI 繫結（變數名稱 AI）。 */

const MODELS = [
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/qwen/qwen3-30b-a3b",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
  "@cf/meta/llama-3.1-8b-instruct",
];

const TABLES = {
  product: {
    table: "products",
    fields: {
      name: "產品名稱（簡短，不要加說明）",
      highlight: "產品重點（一句話，保留「｜」與「・」這類分隔符號）",
      desc: "產品敘述（完整段落）",
      items: "產品細項（用「、」分隔的詞組，翻完仍用該語言習慣的分隔方式）",
    },
  },
  timeline: {
    table: "timeline",
    fields: {
      title: "事件標題（簡短）",
      description: "事件說明",
      future_outlook: "未來展望",
    },
  },
};

const LANG_NAMES = {
  en: "English（英文）",
  ja: "日本語（日文）",
  ko: "한국어（韓文）",
  vi: "Tiếng Việt（越南文）",
  th: "ภาษาไทย（泰文）",
  id: "Bahasa Indonesia（印尼文）",
  "zh-cn": "简体中文",
  es: "Español（西班牙文）",
  de: "Deutsch（德文）",
  fr: "Français（法文）",
};

function textOf(res) {
  if (!res) return "";
  if (typeof res === "string") return res;
  if (typeof res.response === "string") return res.response;
  if (res.result && typeof res.result.response === "string") return res.result.response;
  if (Array.isArray(res.output)) {
    return res.output
      .map((o) => (o && Array.isArray(o.content) ? o.content.map((c) => (c && c.text) || "").join("") : ""))
      .join("\n");
  }
  if (Array.isArray(res.choices) && res.choices[0] && res.choices[0].message) {
    const c = res.choices[0].message.content;
    if (typeof c === "string") return c;
  }
  return "";
}

function parseObject(text) {
  const raw = String(text || "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1));
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
  } catch (err) {
    return null;
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") return json({ error: "只接受 POST" }, 405);
  if (!env.AI) {
    return json({ error: "還沒繫結 Workers AI。請到 Pages → 設定 → 繫結 新增，變數名稱 AI" }, 500);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const conf = TABLES[String(body.entity || "")];
    const id = Number(body.id || 0);
    const lang = String(body.lang || "").trim();

    if (!conf) return json({ error: "不支援的資料類型" }, 400);
    if (!id) return json({ error: "缺少 id" }, 400);
    if (!lang) return json({ error: "缺少語言" }, 400);

    const row = await env.DB.prepare(`SELECT * FROM ${conf.table} WHERE id = ?`).bind(id).first();
    if (!row) return json({ error: "找不到資料" }, 404);

    const wanted = Array.isArray(body.fields) && body.fields.length
      ? body.fields.filter((f) => conf.fields[f])
      : Object.keys(conf.fields);

    // 只翻譯繁中有內容的欄位
    const source = {};
    wanted.forEach((f) => {
      const v = row[f];
      if (v != null && String(v).trim()) source[f] = String(v);
    });

    if (!Object.keys(source).length) {
      return json({ error: "這筆資料的繁體中文內容是空的，沒有東西可以翻譯" }, 400);
    }

    const target = LANG_NAMES[lang.toLowerCase()] || lang;
    const spec = Object.keys(source)
      .map((f) => `- ${f}：${conf.fields[f]}`)
      .join("\n");

    const prompt = `你是台灣塑膠製品製造商的多語型錄翻譯員。請把下面的繁體中文內容翻成${target}。

要翻譯的欄位：
${spec}

規則：
1. 只輸出 JSON 物件，鍵是欄位名稱，值是翻譯後的文字，不要任何解釋
2. 保留原文的換行、「｜」「・」「、」等分隔符號的結構
3. 這是商品型錄，用語要專業自然，不要逐字直譯
4. 產品規格的數字、單位、專有名詞（如 Scale Sheet）維持原樣
5. 不要自行增加原文沒有的內容

原文：
${JSON.stringify(source, null, 2)}`;

    const candidates = env.AI_MODEL ? [env.AI_MODEL, ...MODELS] : MODELS;
    const errors = [];
    let draft = null;
    let used = null;

    for (const model of candidates) {
      try {
        const res = await env.AI.run(model, {
          messages: [
            { role: "system", content: "你只輸出 JSON 物件，不輸出任何其他文字。" },
            { role: "user", content: prompt },
          ],
          max_tokens: 900,
        });
        const obj = parseObject(textOf(res));
        if (obj) {
          draft = {};
          Object.keys(source).forEach((f) => {
            if (obj[f] != null && String(obj[f]).trim()) draft[f] = String(obj[f]).trim();
          });
          if (Object.keys(draft).length) {
            used = model;
            break;
          }
          draft = null;
        }
      } catch (err) {
        errors.push(model + "：" + String((err && err.message) || err));
      }
    }

    if (!draft) {
      return json({ error: errors.length ? "翻譯失敗：" + errors.join("｜") : "模型沒有回傳可用的翻譯" }, 502);
    }

    return json({ ok: true, draft, model: used });
  } catch (error) {
    return fail(error);
  }
}
