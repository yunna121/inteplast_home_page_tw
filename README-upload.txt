要上傳的檔案
============================================================

【必須】_headers          ← repo 根目錄（跟 index.html 同一層）
  沒有這個檔案，瀏覽器會把 src/site-search.js、footer.js、
  navbar.js、type.css 這幾支「沒有 ?v= 版本號」的檔案快取好幾天。
  你改了程式碼、部署了，使用者卻拿到舊版 —— 之前手機語言選單
  只顯示中英，就是這個原因。

  這個檔案沒有副檔名，就叫 _headers。

【建議】about.html        ← 那張 Scale Sheet 產品圖原本寫死
  ./src/product-img/封面-Scale Sheet.png，資料夾已刪除必定 404。
  改成完全交給 site-images.js 從 D1 取。

【可有可無】其餘檔案
  index.html / products/index.html / admin/index.html /
  src/site-images.js / src/page-blocks.js / src/sus-images.js
  只是把已經死掉的後備路徑 src/product-img/ 改指 /media/。
  你的資料庫已確認沒有裸檔名，所以不影響顯示，
  純粹避免後面接手的人被誤導。

【repo 裡可以刪掉的】
  src/patent-sync.js        沒有任何頁面引用（被 site-images.js 取代）
  admin/index-v1.html       舊備份
