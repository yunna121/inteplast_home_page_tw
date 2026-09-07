import { attachTranslations, json, fail } from "./_lib.js";

/* 頁面區塊（公開讀取）
   ------------------------------------------------------------
   GET /api/blocks?page=about

   回傳該頁面所有顯示中的區塊，依 sort_order 排序。
   各語言欄位由 translations 併入（title_en、title_ja…），
   src/page-blocks.js 負責畫出來。 */
export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const page = String(url.searchParams.get("page") || "").trim();

    const stmt = page
      ? context.env.DB.prepare(
          "SELECT * FROM page_blocks WHERE page = ? AND visible = 1 ORDER BY sort_order, id"
        ).bind(page)
      : context.env.DB.prepare(
          "SELECT * FROM page_blocks WHERE visible = 1 ORDER BY page, sort_order, id"
        );

    const { results } = await stmt.all();
    const rows = await attachTranslations(context.env.DB, "block", results || []);

    return json(rows);
  } catch (error) {
    // 資料表還沒建立時回空陣列，頁面照常顯示（只是沒有額外區塊）
    if (String(error && error.message).indexOf("no such table") > -1) return json([]);
    return fail(error);
  }
}
