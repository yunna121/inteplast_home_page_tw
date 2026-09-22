  殘留檔案與死程式碼 — 檢查結果（2026-09-22）
============================================================

這次連同「業務通知信改走 Resend」一起做的清查。
下面分三類：這包已經幫你改好的、你要自己動手刪的、確認還在用的。


一、這包已經改好（覆蓋檔案就好）
------------------------------------------------------------
assets/js/site-search.js
  · LOG_ENDPOINT 改成空字串 —— 原本每次搜尋都會送一筆到
    script.google.com/.../exec，但那支從來沒寫進 Google Sheet
    （Sheet 裡只有「聯絡表單」一個工作表，沒有搜尋記錄）。
    失敗是靜默的，所以站上看不出異常，但每次搜尋都白發一個請求。
    logSearch() 開頭本來就有 if (!LOG_ENDPOINT) 的檢查，
    改成空字串就自動跳過，其他程式一行都沒動。
  · 順手清掉指向不存在檔案的註解：
      site-search-vector-backup.js（repo 裡沒有這個檔）
      search-records.js（同上）
      products-data.js（同上，資料早就移到 D1）
    這些註解會讓下一個看程式的人去找不存在的檔案。
  · 搜尋引擎本身完全沒動 —— BM25、同義詞、介面、Ctrl+K 都一樣。

functions/api/inquiry.js、functions/api/_mail.js
  · 已在前一包處理：移除 Apps Script 呼叫，兩封信都走 Resend。


二、你要自己動手刪的
------------------------------------------------------------
1) repo：apps-script/inquiry-mailer.gs
   程式碼裡已經完全沒有呼叫，整個資料夾可以刪。

2) Cloudflare Pages 環境變數：GAS_URL
   Settings → Variables and Secrets，Production 和 Preview 都刪。

3) Google 端：那個 Apps Script 專案
   寄信和搜尋記錄用的是同一支 /exec，兩邊都已經不再呼叫，
   所以整個專案可以刪（或至少刪掉部署）。
   ※ 「聯絡表單」那個 Google Sheet 建議留著當舊資料備份 ——
     裡面 9/15～9/18 的十筆是改版前的詢價紀錄。

4) assets/js/sus-images.js（2.6KB）
   沒有任何頁面載入它，而且它要找的 img[data-db-img] 在
   全站 HTML 裡一個都沒有 —— 完全是死檔案。
   它的工作（永續頁的產品照從 D1 取圖）現在沒人在做；
   如果永續頁那兩張圖你是直接放在 assets/img/ 的，那就沒問題，刪掉即可。
   要恢復「後台改產品照、永續頁跟著變」的話跟我說，我接回去。

5) assets/img/combine.png（2.2MB）
   docs/README-paths.txt 第 70 行自己就註明「沒有任何頁面引用」。
   2.2MB 放在 repo 裡只是拖慢 clone 和部署，可以刪。
   （同一個資料夾的 sustainability-hero-green-label.png 是 2.5MB
     但有在用 —— 那張建議改天壓成 webp，不是刪。）

6) db/ 底下三個 .sql
   v12-product-sort.sql、v13-path-migration.sql、sync-ui-keys.sql
   是一次性的資料庫遷移腳本，早就跑過了。留著當歷史紀錄無妨
   （它們不會被載入、不影響部署），要精簡就刪。
   ※ 這類檔案建議留 —— 哪天要重建資料庫會用到。


三、確認還在用、不要刪
------------------------------------------------------------
assets/js/ 底下其餘 11 支都有頁面在載：
  navbar.js / mobile-nav.js / footer.js / site-lang.js / site-year.js
  cjk-nbsp.js / site-images.js / page-blocks.js / timeline-render.js
  site-info.js / site-search.js

assets/css/ 四支都有在用：
  navbar.css、responsive.css、type.css 全站；
  sustainability-redesign.css 只有 sustainability.html 載。

functions/api/ 底下的端點都有對應的呼叫端
（products、synonyms、settings、ui-strings、blocks、timeline、
  languages、site-images、inquiry、admin/*）。


四、清完之後的預期效果
------------------------------------------------------------
· 每次搜尋少一個對外請求（原本那個必定失敗）
· repo 小 2.2MB
· 沒有任何 Google 服務依賴，寄信、資料、搜尋全在 Cloudflare
· 註解不再指向不存在的檔案

以上每一項都不影響網站行為 —— 刪的都是已經沒在跑的東西。
