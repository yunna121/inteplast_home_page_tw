import { attachTranslations, json, fail } from "./_lib.js";

export async function onRequest(context) {
  try {
    // 卡片編號（001、002…）與篩選鈕順序都看這個順序，所以要明確排序，
    // 不能靠 SELECT * 的預設回傳順序。
    // sort_order 由後台拖曳排序寫入；同值或舊資料（都是 0）時退回按 id。
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM products ORDER BY sort_order, id"
    ).all();

    // 英文（以及日後新增的語言）由 translations 併進來，見 _lib.js
    const rows = await attachTranslations(context.env.DB, "product", results || []);

    return json(rows);
  } catch (error) {
    return fail(error);
  }
}
