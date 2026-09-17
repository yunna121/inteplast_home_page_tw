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

// const MODELS = [
//   "@cf/meta/llama-4-scout-17b-16e-instruct",
//   "@cf/qwen/qwen3-30b-a3b",
//   "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
//   "@cf/mistralai/mistral-small-3.1-24b-instruct",
//   "@cf/meta/llama-3.1-8b-instruct",
// ];

const MODELS = [
  "@cf/qwen/qwen3-30b-a3b",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
  "@cf/meta/llama-4-scout-17b-16e-instruct",
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
  block: {
    table: "page_blocks",
    fields: {
      eyebrow: "小標（英文短句風格，簡短）",
      title: "段落標題",
      body: "段落內文（保留原本的分段）",
      caption: "圖說（簡短）",
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

/** 翻一筆，回傳 { field: 譯文 }；翻不出來回 null */
async function translateRow(env, conf, row, lang) {
  const source = {};
  Object.keys(conf.fields).forEach((f) => {
    const v = row[f];
    if (v != null && String(v).trim()) source[f] = String(v);
  });
  if (!Object.keys(source).length) return null;

  const target = LANG_NAMES[lang.toLowerCase()] || lang;
  const spec = Object.keys(source).map((f) => `- ${f}：${conf.fields[f]}`).join("\n");

  const prompt = `You are a professional B2B website translator and localization editor for a Taiwanese plastics manufacturer.

Translate the following Traditional Chinese content into ${target}.

IMPORTANT:
This is NOT a literal or word-for-word translation task.

First understand the meaning, context, intent, and business message of the Traditional Chinese source. Then rewrite it naturally in ${target} as if it had originally been written by a native professional copywriter for a B2B manufacturing company's official website.

Do NOT preserve the Chinese sentence structure when doing so would make the translation sound unnatural.

The priority is:
1. Preserve the original meaning and factual information.
2. Use natural expressions, grammar, sentence structure, and terminology appropriate for ${target}.
3. Match the communication style of a professional B2B corporate website.
4. Make the result sound native and professionally written, not translated from Chinese.
5. Adapt the wording and sentence structure to the conventions of the target language and market.

About the website:
- This is the official website of a Taiwanese plastics manufacturer.
- The primary audience includes business customers, procurement professionals, distributors, and international customers.
- The tone should be professional, clear, trustworthy, concise, and appropriate for B2B communication.
- Product and technical information must remain accurate.
- Marketing copy may be naturally rewritten to fit ${target}, but must not introduce claims or benefits that are not present in the source.

Translation principles:
- Do not translate word by word.
- Do not mechanically preserve Chinese word order.
- Do not produce Chinese-style sentences in the target language.
- If a direct translation sounds unnatural in ${target}, rewrite the sentence using the natural expression a native B2B company would use.
- You may restructure, combine, or split sentences when necessary to make the result natural, as long as the original meaning is preserved.
- Do not add information, claims, specifications, certifications, product functions, or marketing promises that are not present in the source.
- Do not omit important information from the source.
- Do not add generic marketing phrases such as "We are committed to...", "We are proud to...", "We provide exceptional quality..." unless the source explicitly expresses that meaning.

Terminology:
- "Green Mark" refers specifically to Taiwan's official environmental label. Keep the name "Green Mark" unchanged.
- "Eco" must remain "Eco" when it is part of an official product name.
- "Scale Sheet" must remain "Scale Sheet".
- "INTEPLAST" must remain "INTEPLAST".
- Preserve official company names, product names, model numbers, certifications, standards, numbers, measurements, and units unless there is an established target-language name provided by the source terminology.
- Do not invent translations for official product names.

Formatting:
- Return ONLY a JSON object.
- The keys must exactly match the field names provided below.
- Do not include explanations, comments, Markdown, or code fences.
- Preserve meaningful line breaks and formatting such as "｜" and "・" when they are part of the source structure.
- Keep short headings short. Do not turn headings into full sentences.
- For product specifications, accuracy takes priority over stylistic rewriting.
- For marketing and brand copy, naturalness and B2B tone take priority over literal sentence structure.

Fields to translate:
${spec}

Source:
${JSON.stringify(source, null, 2)}`;

//   const prompt = `你是台灣塑膠製品製造商的專業 B2B 企業網站翻譯與在地化編輯。

// 請將以下繁體中文內容翻譯成${target}。

// 重要原則：
// 這不是逐字翻譯任務，而是「理解原文意思後，以目標語言自然且符合當地商業溝通習慣的方式重新表達」。

// 請先完整理解繁體中文原文的：
// - 實際意思
// - 商業情境
// - 產品用途
// - 企業想傳達的訊息
// - 目標讀者

// 再用${target}的母語者在正式 B2B 企業網站上會使用的自然表達方式撰寫。

// 這是一個塑膠製品製造商的官方 B2B 網站，因此文字應：
// - 專業、可信、清楚
// - 適合企業客戶、採購人員、海外客戶閱讀
// - 自然符合${target}的商業網站語氣
// - 避免翻譯腔與中文句型
// - 不要逐字對應中文語序
// - 不要使用一般機器翻譯常見的生硬表達
// - 必要時可以重新組織句子結構，只要完整保留原文的實際意思
// - 如果中文表達在${target}中不自然，應改用當地最自然的商業表達方式

// 要翻譯的欄位：
// ${spec}

// 翻譯規則：
// 1. 只輸出 JSON 物件，鍵必須是欄位名稱，值是翻譯後的文字，不要任何解釋。
// 2. 不要逐字翻譯。優先考慮「意思、語氣與商業目的」而不是中文的字面結構。
// 3. 不要自行增加原文沒有的產品功能、規格、認證、數據或承諾。
// 4. 可以重新組織句子、合併或拆分句子，使目標語言自然，但不得改變原意。
// 5. 保留產品名稱、品牌名稱、公司名稱、型號、數字、單位、標準與認證名稱等正式資訊。
// 6. 專有名詞依網站既有 terminology 使用。例如：
//    - Green Mark = 台灣環保標章
//    - Scale Sheet = Scale Sheet
//    - INTEPLAST = INTEPLAST
// 7. 「Eco」如果是正式產品名稱的一部分，必須保留，不要自行改成 Green Mark 或其他名稱。
// 8. 保留原文必要的換行、｜、・等格式結構。
// 9. 對於產品規格與技術資訊，精確性優先；對於行銷與品牌文案，自然度與 B2B 商業語氣優先。
// 10. 不要把中文的「我們」等詞語機械地全部翻出來；如果目標語言的企業網站通常會省略主語，可以自然省略。
// 11. 不要加入「我們很榮幸」、「致力於」、「提供卓越品質」等原文沒有的行銷套話。
// 12. 最終結果必須像是${target}母語企業直接撰寫的官方網站內容，而不是翻譯過來的中文。

// 原文：
// ${JSON.stringify(source, null, 2)}`;

  const candidates = env.AI_MODEL ? [env.AI_MODEL, ...MODELS] : MODELS;
  for (const model of candidates) {
    try {
      const res = await env.AI.run(model, {
        messages: [
          {
              role: "system",
              content: `You are a professional B2B website translation and localization editor.

            Your task is to produce natural, native-quality ${target} for a Taiwanese plastics manufacturer's official B2B website.

            Do not translate literally.
            Understand the source meaning first, then express it naturally in the target language.

            Preserve factual accuracy, terminology, product information, and the original intent.
            Do not add unsupported information.

            Return ONLY the requested JSON object.`
            },
          { role: "user", content: prompt },
        ],
        max_tokens: 900,
      });
      const obj = parseObject(textOf(res));
      if (!obj) continue;
      const out = {};
      Object.keys(source).forEach((f) => {
        if (obj[f] != null && String(obj[f]).trim()) out[f] = String(obj[f]).trim();
      });
      if (Object.keys(out).length) return out;
    } catch (err) { /* 換下一個模型 */ }
  }
  return null;
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
    if (!lang) return json({ error: "缺少語言" }, 400);

    /* ── 一鍵翻譯整份清單 ──
       與單筆的「草稿不存檔」不同：整批逐筆確認才存不切實際，
       這裡直接寫進資料庫，清單上每一筆都能再進去改。
       只翻「還沒有這個語言」的欄位，已經翻好或人工改過的不會被蓋掉。 */
    if (body.all) {
      const rows = (await env.DB.prepare(`SELECT * FROM ${conf.table} ORDER BY id`).all()).results || [];
      const existing = (await env.DB.prepare(
        "SELECT entity_id, field FROM translations WHERE entity = ? AND lang = ? AND value <> ''"
      ).bind(String(body.entity), lang).all()).results || [];

      const has = new Set(existing.map((t) => t.entity_id + "\u0000" + t.field));
      const stmts = [];
      let doneRows = 0;
      let doneFields = 0;

      for (const row of rows) {
        const need = Object.keys(conf.fields).filter((f) => {
          const v = row[f];
          return v != null && String(v).trim() && !has.has(row.id + "\u0000" + f);
        });
        if (!need.length) continue;

        const out = await translateRow(env, conf, row, lang);
        if (!out) continue;

        let wrote = 0;
        need.forEach((f) => {
          if (!out[f]) return;
          stmts.push(
            env.DB.prepare(
              `INSERT INTO translations (entity, entity_id, field, lang, value) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value`
            ).bind(String(body.entity), row.id, f, lang, out[f])
          );
          wrote++;
        });
        if (wrote) { doneRows++; doneFields += wrote; }
      }

      if (stmts.length) await env.DB.batch(stmts);
      return json({ ok: true, rows: doneRows, fields: doneFields });
    }

    if (!id) return json({ error: "缺少 id" }, 400);

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
