SEO 更新包（inteplasttw.com.tw）
=================================

要上傳到 GitHub 的檔案（保持相同資料夾結構）
--------------------------------------------
robots.txt              ← 放在 repo 最外層
sitemap.xml             ← 放在 repo 最外層
index.html
about.html
sustainability.html
contact.html
products/index.html

每個 html 檔改了兩處
--------------------
1) head 裡新增一段「===== SEO =====」註解包住的標籤：
   · canonical（正規網址）—— 舊的 .pages.dev 網址不會再跟新網域搶排名
   · og:/twitter: —— 貼到 LINE、FB、WhatsApp 會出現標題＋說明＋logo
   · index.html 另外多一段 Organization 結構化資料（公司名、地址、電話、logo）
2) GA4 的 LIVE_HOSTS 陣列加入 inteplasttw.com.tw 與 www.inteplasttw.com.tw
   （不加的話換網域後 Google Analytics 就收不到資料）

上傳後在 Search Console 做的事
------------------------------
1) Sitemap 頁面的「新增 Sitemap」欄位輸入：sitemap.xml  → 提交
2) 「網址審查」貼上 https://inteplasttw.com.tw/ → 要求建立索引
   五個網址各做一次（首頁、/about、/products/、/sustainability、/contact）
3) 約 3-7 天後回「產生索引 → 網頁」看收錄狀況

檢查方式
--------
· 上傳後開 https://inteplasttw.com.tw/sitemap.xml 應看到 5 個網址
· 開 https://inteplasttw.com.tw/robots.txt 應看到 Sitemap 那行
· 結構化資料用 Google「複合式搜尋結果測試」貼首頁網址驗證
· 搜尋 site:inteplasttw.com.tw 可看目前被收錄的頁面

還沒解決、需要決定的兩件事
--------------------------
A) 英文版沒有獨立網址（目前靠前端 localStorage 切換），所以英文關鍵字
   （can liner、draw tape liner…）Google 收錄不到。要做外銷 SEO 需要
   /en/ 這種實體路徑 + hreflang，這是改架構的工程。
B) 首頁產品區塊由 /api/products 前端載入，HTML 原始碼裡是空的。
   產品名稱是最重要的關鍵字，建議 products 頁面改為伺服器端輸出，
   或在 HTML 內保留一份靜態產品清單。
