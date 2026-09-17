/* 舊網址 301 導到正式網域（安全版）
   ------------------------------------------------------------
   與前一版的差別：

   1) 完全不碰 /api/ 與 /media/
      根目錄的 _middleware.js 會接到每一個請求。前一版對 API 也做了
      判斷，只要這支程式有任何意外，整個 /api/ 就一起掛掉
      （症狀：頁面上後台設定的圖全部不見，Console 出現 Failed to fetch）。
      現在第一件事就是把這兩條路徑原封不動放行。

   2) 整段包 try/catch
      真的出錯時就當作沒事發生、照常放行，絕不讓轉址程式
      把網站弄掛。

   只導「正式的」pages.dev 網址；分支預覽（開頭一串亂碼的那種）
   保持原樣，測試才不會被踢走。 */

const PRIMARY = 'inteplasttw.com.tw';
const LEGACY = ['inteplast-home-page-tw.pages.dev', 'yunna121.github.io'];

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);

    // API 與媒體檔一律直接放行，不做任何判斷
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) {
      return context.next();
    }

    if (LEGACY.includes(url.hostname)) {
      url.hostname = PRIMARY;
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    if (url.hostname === 'www.' + PRIMARY) {
      url.hostname = PRIMARY;
      return Response.redirect(url.toString(), 301);
    }

    return context.next();
  } catch (e) {
    // 轉址失敗不能連帶把網站弄壞
    return context.next();
  }
}
