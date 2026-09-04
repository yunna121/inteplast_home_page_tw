臺灣營德網站 — 完全改用 D1（一次做完）
============================================================
這一包含前面幾批的所有修改，直接照下面順序做就好。
src/site-search.js 以這一包為準（含「改讀 API」＋「同義詞改讀 D1」兩項改動）。


步驟 1｜先在 D1 建同義詞表
------------------------------------------------------------
Cloudflare Dashboard → Workers & Pages → D1 → 你的資料庫 → Console
把 synonyms.sql 的內容整份貼進去執行。

會建立 synonyms 表並寫入目前程式碼裡的 45 組同義詞。
最後兩行 SELECT 會顯示結果，確認是 45 筆。

（順序很重要：表要先存在，網站部署後才不會噴 500）


步驟 2｜上傳修改過的檔案
------------------------------------------------------------
把這一包的檔案覆蓋到 repo 對應位置：

  src/site-search.js            ← 【最重要】改讀 /api/products 與 /api/synonyms
  functions/api/synonyms.js     ← 新增
  about.html                    ← 移除 content/timeline.js 載入
  contact.html                  ← 移除 JSON 後台套用層載入
  sustainability.html           ← 修正封面標題「先大後縮」
  tools/i18n-audit.html         ← 改讀 /api/products
  github.md                     ← 同步紀錄

注意：about.html 這一包的版本同時含「移除時間軸快照」與
      「修正封面標題先大後縮」兩項改動。


步驟 3｜刪除不要的檔案
------------------------------------------------------------
■ 資料快照（已全部搬進 D1）
  content/timeline.js
  content/site.json
  content/pages.json
  src/data/products-data.js
  src/data/products-data-en.csv
  src/data/embeddings.json
  → content/ 與 src/data/ 刪完就空了，資料夾可一併刪除

■ 只為產生那些快照而存在的工具
  tools/products-excel.html
  tools/timeline-excel.html
  tools/build-embeddings.html
  src/search-records.js

■ 舊的語意搜尋引擎（依賴 embeddings.json，沒有頁面載入它）
  src/site-search-vector-backup.js

■ JSON 編輯後台
  admin/                        ← 整個資料夾（index.html 與 config.yml）
  src/content.js

不要刪：
  頁面上的 data-site / data-site-href 標記
    → contact.html 的通知信箱是從 [data-site="email"] 元素讀的，
      刪掉會壞；日後 D1 編輯頁也會沿用這些標記。


步驟 4｜部署
------------------------------------------------------------
functions/ 有變動，一定要重新部署（Pages Function 不會熱更新）。


步驟 5｜驗證這四件事
------------------------------------------------------------
1. 全站搜尋：任一頁按 Ctrl+K，打「垃圾袋」→ 應出現清潔袋
   （這一項最關鍵：同義詞改讀 D1 了，能命中就表示兩支 API 都通）
2. 關於營德：時間軸有資料、會淡入、年份多行的那筆沒有出現「\n」
3. 首頁與產品中心：七張產品卡片都在，順序 001→007
4. 聯繫我們：頁面正常，Console 沒有 content.js 的 404

若搜尋打「垃圾袋」搜不到但打「清潔袋」可以 → synonyms 表沒建好或沒部署。
若兩者都搜不到 → /api/products 有問題，開 DevTools 看那條的狀態碼。


注意：搜尋現在需要 API 才有資料，用 file:// 直接開會搜不到東西。
      本機測試請用：npx wrangler pages dev .
