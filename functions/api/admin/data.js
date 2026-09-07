import { json, fail } from "../_lib.js";

/* 編輯頁的資料來源 —— 一次把所有內容撈回來，頁面只發一個請求。
   ------------------------------------------------------------
   ⚠ 這支與 /api/admin/* 底下所有端點都會寫入或讀取後台資料，
     必須用 Cloudflare Access 保護 /api/admin* 這個路徑。
     回傳的 access.protected 會告訴頁面有沒有被保護，
     沒有的話頁面上會顯示紅色警告。 */
export async function onRequest(context) {
  try {
    const { DB } = context.env;
    const protectedByAccess = context.data && context.data.auth && context.data.auth !== "none";

    const [languages, products, translations, synonyms, suggestions, timeline, settings, inquiries, uiStrings] =
      await DB.batch([
        DB.prepare("SELECT code, label, is_base, sort_order FROM languages ORDER BY sort_order, code"),
        DB.prepare("SELECT * FROM products ORDER BY id"),
        DB.prepare("SELECT entity, entity_id, field, lang, value FROM translations"),
        DB.prepare("SELECT id, product_id, say FROM synonyms ORDER BY product_id, say"),
        DB.prepare(
          `SELECT s.id, s.product_id, s.say, s.source, s.status, s.created_at, p.name AS product_name
             FROM synonym_suggestions s
             JOIN products p ON p.id = s.product_id
            WHERE s.status = 'pending'
            ORDER BY s.product_id, s.say`
        ),
        DB.prepare("SELECT * FROM timeline ORDER BY CAST(year AS INTEGER), id"),
        DB.prepare(
          "SELECT id, key, value, label, hint, translatable, sort_order FROM settings ORDER BY sort_order, id"
        ),
        DB.prepare(
          `SELECT id, company, email, phone, product, message, lang, page, status, note, mailed, created_at
             FROM inquiries ORDER BY id DESC LIMIT 200`
        ),
        DB.prepare("SELECT id, zh, page, note FROM ui_strings WHERE COALESCE(hidden, 0) = 0 ORDER BY id"),
      ]);

    return json({
      access: { protected: !!protectedByAccess, mode: (context.data && context.data.auth) || "none" },
      languages: languages.results || [],
      products: products.results || [],
      translations: translations.results || [],
      synonyms: synonyms.results || [],
      suggestions: suggestions.results || [],
      timeline: timeline.results || [],
      settings: settings.results || [],
      inquiries: inquiries.results || [],
      uiStrings: uiStrings.results || [],
    });
  } catch (error) {
    return fail(error);
  }
}
