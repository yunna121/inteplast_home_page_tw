專案路徑整理更新包
============================================================
你已經把檔案搬到 assets/css、assets/js、assets/img、docs、db，
但頁面裡的路徑還全部指著舊的 src/ —— 這一包就是把路徑改好的版本。

※ 重要：搬完到現在，網站的 CSS 與 JS 全部是 404（版面會壞掉）。
  這包上傳後才會恢復正常。

要上傳的檔案（21 個，照相同結構覆蓋）
------------------------------------------------------------
_headers                      ← 新增，放 repo 最外層（沒有副檔名）
index.html
about.html
contact.html
sustainability.html
products/index.html
admin/index.html
assets/css/navbar.css
assets/css/responsive.css
assets/css/type.css
assets/css/sustainability-redesign.css
assets/js/footer.js
assets/js/mobile-nav.js
assets/js/navbar.js
assets/js/page-blocks.js
assets/js/site-images.js
assets/js/site-info.js
assets/js/site-lang.js
assets/js/site-search.js
assets/js/site-year.js
assets/js/sus-images.js

沒有列到的檔案不用動（cjk-nbsp.js、timeline-render.js、functions/、db/、docs/
裡面沒有任何舊路徑）。

改了什麼
------------------------------------------------------------
1) 所有 src/ 開頭的路徑改成 assets/css、assets/js、assets/img、assets/video
   包含 JS 裡動態組出來的後備路徑（'./src/' + 檔名 這種）
2) 順手修掉一個 404：about.html 的頁尾 logo 寫成
   src/INTEPLAST-logo-blue.svg（大寫），但檔案是小寫 inteplast-logo-blue.svg。
   Cloudflare Pages 的路徑分大小寫，所以那個 logo 本來就一直是破圖。
3) og:image 與結構化資料的 logo 網址改成 /assets/img/itc-logo.png
4) 新增 _headers（你 docs/README-upload.txt 標【必須】但一直不在 repo）：
   · assets/js、assets/css → 不快取，改完部署立刻生效
   · assets/img、assets/video → 快取一年
   沒有它，沒帶 ?v= 的檔案（footer.js、site-search.js、type.css）
   會被瀏覽器快取好幾天，就是之前手機語言選單只顯示中英的原因。

還缺的檔案（有頁面引用，但 repo 裡沒有）
------------------------------------------------------------
這些路徑我已經指到新位置，但檔案本身要你上傳：

assets/video/hero.mp4               ← 首頁封面影片（原 src/首頁video.mp4）
assets/video/factory-xingang.mp4    ← about 廠區影片（原 src/新港.mp4）

  ※ GitHub 單檔上限 100MB。超過的話不要放 repo，改放
    Cloudflare R2 或 Stream，我可以幫你改成那種載入方式。

下面這些是「後台沒設圖時的後備圖」，D1 有資料就不影響顯示，
所以不上傳也不會壞，只是後備會空：

assets/img/opt/combine.jpg          （首頁＋永續頁 環保標章證書）
assets/img/opt/drawtape.jpg
assets/img/opt/cleaning.jpg
assets/img/excellence-awards.jpg    （about 獎項）
assets/img/scale-sheet-patent.jpg   （about 專利證書）
assets/img/製袋區.jpeg               （about hero 底圖）

順便一提：assets/img/combine.png（2.2MB）沒有任何頁面引用，
可以刪掉，或壓成 WebP 後改名 opt/combine.jpg 補上面那個缺口。

上傳後怎麼確認
------------------------------------------------------------
1) 開首頁，版面正常、字級正常（不是瀏覽器預設字體）
2) F12 → Network，重新整理，不應該有紅色 404
   （影片和上面列的後備圖除外）
3) 手機開語言選單，五種語言都在
4) 開 /about，捲到頁尾，INTEPLAST logo 要看得到（之前是破的）
