/* 共用：把 translations 併回資料列，並回傳 JSON
   ------------------------------------------------------------
   基準語言（繁中）住在 products／timeline／settings 本表，
   其他語言住在 translations。這裡把翻譯攤平成 `欄位_語言` 的形式：

     name  = 繁中（本表）
     name_en = translations 裡 lang='en' 的 name
     name_ja = translations 裡 lang='ja' 的 name

   所以前端程式碼不用改就能繼續讀 name_en，
   而且新增語言時 API 自動多出 name_ja 這種鍵，同樣不必改這支。 */

export function langSuffix(code) {
  return String(code || '').toLowerCase().replace(/-/g, '_');
}

export async function attachTranslations(DB, entity, rows) {
  if (!rows.length) return rows;

  const { results } = await DB.prepare(
    "SELECT entity_id, field, lang, value FROM translations WHERE entity = ?"
  ).bind(entity).all();

  const byId = new Map(rows.map((r) => [String(r.id), r]));
  (results || []).forEach((t) => {
    const row = byId.get(String(t.entity_id));
    if (!row) return;
    row[t.field + "_" + langSuffix(t.lang)] = t.value;
  });

  return rows;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "cache-control": "no-store",
    },
  });
}

export function fail(error, status = 500) {
  return json({ error: String(error && error.message ? error.message : error) }, status);
}
