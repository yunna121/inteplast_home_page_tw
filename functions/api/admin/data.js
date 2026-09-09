import { json, fail } from "../_lib.js";

/* 編輯頁的資料來源 —— 一次把所有內容撈回來，頁面只發一個請求。
   ------------------------------------------------------------
   access.user 是目前登入的帳號（ADMIN_USERS 裡的名字，或 Cloudflare
   Access 的 Email），編輯頁會顯示在側欄，也是 save.js 寫進
   updated_by 的那個值。

   settings / ui_strings / inquiries 改用 SELECT *，這樣 db/v9-audit.sql
   加的 updated_by / updated_at 會自動跟著出現；還沒跑那支 SQL 時
   也不會因為選了不存在的欄位而整頁讀不到資料。

   ⚠ 這支與 /api/admin/* 底下所有端點都會寫入或讀取後台資料，
     保護在 functions/api/admin/_middleware.js。回傳的 access.protected
     會告訴頁面有沒有被保護，沒有的話頁面上會顯示紅色警告。 */
export async function onRequest(context) {
  try {
    const { DB } = context.env;
    const auth = (context.data && context.data.auth) || "none";
    const protectedByAuth = auth !== "none";

    const [languages, products, translations, synonyms, suggestions, timeline, settings, inquiries, uiStrings, blocks] =
      await DB.batch([
        DB.prepare("SELECT code, label, is_base, sort_order FROM languages ORDER BY sort_order, code"),
        DB.prepare("SELECT * FROM products ORDER BY id"),
        DB.prepare("SELECT entity, entity_id, field, lang, value FROM translations"),
        DB.prepare("SELECT * FROM synonyms ORDER BY product_id, say"),
        DB.prepare(
          `SELECT s.id, s.product_id, s.say, s.source, s.status, s.created_at, p.name AS product_name
             FROM synonym_suggestions s
             JOIN products p ON p.id = s.product_id
            WHERE s.status = 'pending'
            ORDER BY s.product_id, s.say`
        ),
        DB.prepare("SELECT * FROM timeline ORDER BY CAST(year AS INTEGER), id"),
        DB.prepare("SELECT * FROM settings ORDER BY sort_order, id"),
        DB.prepare("SELECT * FROM inquiries ORDER BY id DESC LIMIT 200"),
        DB.prepare("SELECT * FROM ui_strings WHERE COALESCE(hidden, 0) = 0 ORDER BY id"),
        DB.prepare("SELECT * FROM page_blocks ORDER BY page, sort_order, id"),
      ]);

    return json({
      access: {
        protected: !!protectedByAuth,
        mode: auth,
        user: (context.data && context.data.user) || "",
      },
      languages: languages.results || [],
      products: products.results || [],
      translations: translations.results || [],
      synonyms: synonyms.results || [],
      suggestions: suggestions.results || [],
      timeline: timeline.results || [],
      settings: settings.results || [],
      inquiries: inquiries.results || [],
      uiStrings: uiStrings.results || [],
      blocks: blocks.results || [],
    });
  } catch (error) {
    return fail(error);
  }
}
