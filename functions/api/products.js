export async function onRequest(context) {
  try {
    // 透過我們剛剛設定的變數 DB，去資料庫撈取 products 表格的所有資料
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM products"
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