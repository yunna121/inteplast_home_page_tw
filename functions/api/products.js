import { attachTranslations, json, fail } from "./_lib.js";

export async function onRequest(context) {
  try {
    // 卡片編號（001、002…）與篩選鈕順序都看這個順序，所以要明確排序，
    // 不能靠 SELECT * 的預設回傳順序。
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM products ORDER BY id"
    ).all();

    // 英文（以及日後新增的語言）由 translations 併進來，見 _lib.js
    const rows = await attachTranslations(context.env.DB, "product", results || []);

    return json(rows);
  } catch (error) {
    return fail(error);
  }
}
