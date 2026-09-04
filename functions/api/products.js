export async function onRequest(context) {
  try {
    // 卡片編號（001、002…）與篩選鈕順序都看這個順序，所以要明確排序，
    // 不能靠 SELECT * 的預設回傳順序。
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM products ORDER BY id"
    ).all();

    // 將撈出來的資料轉換成 JSON 格式，回傳給前端網頁
    return new Response(JSON.stringify(results), {
      headers: {
        "content-type": "application/json;charset=UTF-8",
      },
    });
  } catch (error) {
    // 如果發生錯誤，回傳錯誤訊息
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { "content-type": "application/json;charset=UTF-8" }
    });
  }
}