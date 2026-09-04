export async function onRequest(context) {
  try {
    // year 是 TEXT（"1989"、"1990s\n-2000s"），字串排序會亂 ——
    // CAST 取開頭數字來排，同年再用 id 維持資料庫原始順序。
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM timeline ORDER BY CAST(year AS INTEGER), id"
    ).all();

    return new Response(JSON.stringify(results), {
      headers: {
        "content-type": "application/json;charset=UTF-8",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json;charset=UTF-8" }
    });
  }
}
