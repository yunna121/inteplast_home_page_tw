import { json } from "./_lib.js";

/* 網站圖片（公開讀取）
   ------------------------------------------------------------
   GET /api/site-images  →  { "sus_product_drawtape": "/media/x.webp", … }

   頁面上的 <img data-site-img="key"> 會由 src/site-images.js 依這份
   對照表換掉 src。回傳只有 key → path，前端不需要其他欄位。

   表還沒建立（沒跑 db/v11-site-images.sql）時回空物件而不是錯誤 ——
   頁面就繼續用 HTML 裡寫死的那張圖，不會破圖。 */
export async function onRequest(context) {
  try {
    const { results } = await context.env.DB
      .prepare("SELECT key, path FROM site_images")
      .all();

    const out = {};
    (results || []).forEach((row) => {
      const path = String(row.path || "").trim();
      if (row.key && path) out[row.key] = path;
    });
    return json(out);
  } catch (error) {
    return json({});
  }
}
