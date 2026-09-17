/* 舊網址一律 301 導到正式網域
   ------------------------------------------------------------
   為什麼要這個：
   inteplast-home-page-tw.pages.dev 與 inteplasttw.com.tw 內容完全相同，
   Google 會視為兩個網站互相稀釋排名，後台的「前往網站」也會跟著跑到舊網址。
   301（永久轉移）會把舊網址累積的分數整份轉給新網域。

   只導「正式的」pages.dev 網址。分支預覽（例如
   abc123.inteplast-home-page-tw.pages.dev）保持原樣，測試才不會被踢走。

   Pages 的根目錄 _middleware.js 會接到所有請求（含靜態檔案），
   不符合條件的一律 next() 放行，不影響 /api/ 與 /media/。 */

const PRIMARY = 'inteplasttw.com.tw';
const LEGACY = ['inteplast-home-page-tw.pages.dev', 'yunna121.github.io'];

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (LEGACY.includes(url.hostname)) {
    url.hostname = PRIMARY;
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }

  /* www 也收斂到不帶 www 的版本，兩者只留一個給 Google */
  if (url.hostname === 'www.' + PRIMARY) {
    url.hostname = PRIMARY;
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
