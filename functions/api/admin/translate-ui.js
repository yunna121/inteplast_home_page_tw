import { json, fail } from "../_lib.js";

/* 介面文字批次翻譯
   ------------------------------------------------------------
   POST /api/admin/translate-ui  { lang: 'ja', limit: 20 }

   一次翻譯 limit 條「還沒有這個語言翻譯」的字串，直接寫進
   translations。與產品那邊的「草稿不存檔」不同 —— 介面文字有
   186 條，逐條確認才存不切實際；這裡先寫進去，後台清單上每一條
   都能直接改，人工是「校對」而不是「逐條核准」。

   回傳 { ok, done, remaining, items } —— items 是這批翻了什麼，
   後台照著顯示，使用者可以立刻看到並修正。

   分批的原因：186 條一次送給模型會超出 token 上限，而且
   Cloudflare Function 有執行時間限制。前端會重複呼叫直到
   remaining 歸零，並顯示進度。 */

const MODELS = [
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/qwen/qwen3-30b-a3b",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
  "@cf/meta/llama-3.1-8b-instruct",
];

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
  const DB = env.DB;

  if (request.method !== "POST") return json({ error: "只接受 POST" }, 405);
  if (!env.AI) {
    return json({ error: "還沒繫結 Workers AI。請到 Pages → 設定 → 繫結 新增，變數名稱 AI" }, 500);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const lang = String(body.lang || "").trim();
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 30);
    if (!lang) return json({ error: "缺少語言" }, 400);

    const base = await DB.prepare("SELECT code FROM languages WHERE is_base = 1").first();
    if (base && base.code === lang) return json({ error: "基準語言不需要翻譯" }, 400);

    // 還沒翻的（含翻成空字串的）
    const { results } = await DB.prepare(
      `SELECT u.id, u.zh
         FROM ui_strings u
         LEFT JOIN translations t
           ON t.entity = 'ui' AND t.entity_id = u.id AND t.field = 'text' AND t.lang = ?
        WHERE t.id IS NULL OR t.value = ''
        ORDER BY u.id
        LIMIT ?`
    ).bind(lang, limit).all();

    const pending = results || [];

    const countRow = await DB.prepare(
      `SELECT COUNT(*) AS n
         FROM ui_strings u
         LEFT JOIN translations t
           ON t.entity = 'ui' AND t.entity_id = u.id AND t.field = 'text' AND t.lang = ?
        WHERE t.id IS NULL OR t.value = ''`
    ).bind(lang).first();

    const totalPending = countRow ? Number(countRow.n) : pending.length;

    if (!pending.length) {
      return json({ ok: true, done: 0, remaining: 0, items: [], message: "全部都翻好了" });
    }

    const target = LANG_NAMES[lang.toLowerCase()] || lang;

    // 用編號當鍵，避免中文原文裡的引號、換行把 JSON 弄壞
    const source = {};
    pending.forEach((r, i) => { source["s" + i] = r.zh; });

    const prompt = `你是台灣塑膠製品製造商官方網站的翻譯員。請把下面的繁體中文網站介面文字翻成${target}。

規則：
1. 只輸出 JSON 物件，鍵沿用輸入的編號，值是翻譯後的文字，不要任何解釋
2. 這是網站的選單、按鈕、標題與說明文字，用語要簡潔、符合企業官網語氣
3. **保留 {{year}}、{{years}} 這類雙大括號變數，原樣不動**
4. 保留 <br> 標籤、「·」「｜」等符號的位置
5. 公司名稱 INTEPLAST、Scale Sheet、ISO 9001 等專有名詞維持原樣
6. 「臺灣營德股份有限公司」譯為 INTEPLAST TAIWAN CORPORATION（其他語言比照，保留英文商號）
7. 短標題就翻成短標題，不要擴寫成句子

原文：
${JSON.stringify(source, null, 1)}`;

    const candidates = env.AI_MODEL ? [env.AI_MODEL, ...MODELS] : MODELS;
    const errors = [];
    let obj = null;

    for (const model of candidates) {
      try {
        const res = await env.AI.run(model, {
          messages: [
            { role: "system", content: "你只輸出 JSON 物件，不輸出任何其他文字。" },
            { role: "user", content: prompt },
          ],
          max_tokens: 2400,
        });
        const parsed = parseObject(textOf(res));
        if (parsed && Object.keys(parsed).length) { obj = parsed; break; }
      } catch (err) {
        errors.push(model + "：" + String((err && err.message) || err));
      }
    }

    if (!obj) {
      return json({ error: errors.length ? "翻譯失敗：" + errors.join("｜") : "模型沒有回傳可用的結果" }, 502);
    }

    const stmts = [];
    const items = [];
    pending.forEach((r, i) => {
      const v = obj["s" + i];
      if (v == null || !String(v).trim()) return;
      const value = String(v).trim();
      stmts.push(
        DB.prepare(
          `INSERT INTO translations (entity, entity_id, field, lang, value) VALUES ('ui', ?, 'text', ?, ?)
           ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value`
        ).bind(r.id, lang, value)
      );
      items.push({ id: r.id, zh: r.zh, value: value });
    });

    if (stmts.length) await DB.batch(stmts);

    return json({
      ok: true,
      done: items.length,
      remaining: Math.max(0, totalPending - items.length),
      items,
    });
  } catch (error) {
    return fail(error);
  }
}
