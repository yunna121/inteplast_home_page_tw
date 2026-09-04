import { json, fail } from "./_lib.js";

export async function onRequest(context) {
  try {
    // 一列＝一個別名掛在一個產品上。product_id 指向 products.id。
    // 依產品分組回傳，編輯頁可以直接照這個順序把別名列在各產品底下。
    const { results } = await context.env.DB.prepare(
      `SELECT s.id, s.product_id, s.say, p.name AS product_name
         FROM synonyms s
         JOIN products p ON p.id = s.product_id
        ORDER BY s.product_id, s.say`
    ).all();

    return json(results || []);
  } catch (error) {
    return fail(error);
  }
}
