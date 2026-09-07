import { json, fail } from "./_lib.js";

/* 介面文字（公開讀取）
   ------------------------------------------------------------
   回傳 { "首頁": { "en": "Home", "ja": "ホーム" }, … }

   鍵是繁體中文原文 —— 也就是頁面上 data-tw 的值。
   src/site-lang.js 拿這份對照表去覆蓋 data-en 等屬性，
   所以新增語言不必改任何 HTML。

   繁中本身不在回傳裡：它就是鍵，也是頁面上的預設顯示。 */
export async function onRequest(context) {
  try {
    const { results } = await context.env.DB.prepare(
      `SELECT u.zh, t.lang, t.value
         FROM ui_strings u
         JOIN translations t
           ON t.entity = 'ui' AND t.entity_id = u.id AND t.field = 'text'
        WHERE t.value <> ''`
    ).all();

    const out = {};
    (results || []).forEach((r) => {
      if (!out[r.zh]) out[r.zh] = {};
      out[r.zh][r.lang] = r.value;
    });

    return json(out);
  } catch (error) {
    return fail(error);
  }
}
