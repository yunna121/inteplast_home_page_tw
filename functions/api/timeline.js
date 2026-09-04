import { attachTranslations, json, fail } from "./_lib.js";

export async function onRequest(context) {
  try {
    // year 是 TEXT（"1989"、"1990s\n-2000s"），字串排序會亂 ——
    // CAST 取開頭數字來排，同年再用 id 維持資料庫原始順序。
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM timeline ORDER BY CAST(year AS INTEGER), id"
    ).all();

    const rows = await attachTranslations(context.env.DB, "timeline", results || []);

    return json(rows);
  } catch (error) {
    return fail(error);
  }
}
