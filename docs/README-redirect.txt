舊網址 301 導到 inteplasttw.com.tw
============================================================

要上傳的檔案（1 個）
------------------------------------------------------------
functions/_middleware.js     ← 放在 functions/ 資料夾最外層
                                （跟 api/、media/ 同一層，不要放進 api/ 裡）

上傳後結構長這樣：
  functions/
  ├── _middleware.js      ← 新增這個
  ├── api/
  └── media/


在 Cloudflare 後台要先確認的事
------------------------------------------------------------
1) Cloudflare Dashboard → Workers & Pages → 你的 Pages 專案
2) 上方分頁 → Custom domains（自訂網域）
3) 確認清單裡有 inteplasttw.com.tw，狀態是 Active（綠色）
   · 如果也有 www.inteplasttw.com.tw，一起留著（程式會把它導到不帶 www 的）
   · 如果沒有 www，建議加上去 —— 有人會手動打 www，沒設定會開不了
4) 等部署完成（Deployments 頁面最新一筆變綠）


怎麼確認生效
------------------------------------------------------------
開無痕視窗，貼這個舊網址：

  https://inteplast-home-page-tw.pages.dev/

網址列應該會自動變成 https://inteplasttw.com.tw/

再測一次帶路徑的，確認路徑有被保留：

  https://inteplast-home-page-tw.pages.dev/products/
  → 應變成 https://inteplasttw.com.tw/products/

後台也測一次：
  https://inteplasttw.com.tw/admin/ 登入 → 左下「前往網站」
  滑過去看狀態列，應該顯示 inteplasttw.com.tw


注意事項
------------------------------------------------------------
· 分支預覽網址（開頭有一串亂碼的 xxxx.inteplast-home-page-tw.pages.dev）
  刻意不導，這樣你要測試改版時還是進得去。

· 301 是「永久」轉移，瀏覽器會記住。如果之後要改回來，
  自己的瀏覽器可能要清快取才看得到變化（無痕視窗最快）。

· 要改網域時，只需要改 _middleware.js 最上面那兩行：
    const PRIMARY = 'inteplasttw.com.tw';
    const LEGACY  = [...];

· Search Console 那邊不用重新設定。Google 下次爬到舊網址時
  會讀到 301，自動把索引轉到新網域，通常幾週內完成。
