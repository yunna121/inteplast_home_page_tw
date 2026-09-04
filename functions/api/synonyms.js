export async function onRequest(context) {
  try {
    // say = 客戶會打的詞、mean = 我們資料裡真正有的詞（多個用「、」分隔）。
    // 依 say 排序，方便日後在編輯頁上以固定順序呈現。
    const { results } = await context.env.DB.prepare(
      "SELECT id, say, mean FROM synonyms ORDER BY say"
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
