臺灣營德網站 — 內容編輯頁 安裝說明
============================================================
編輯頁網址：https://你的網域/admin/

同事看到的畫面：左邊六個項目（產品資料、產品別名、待審別名、
時間軸、公司資訊、語言），改完按「儲存」網站立即更新。
不需要 GitHub、不需要 Excel、不需要重新部署。


⚠ 先做這件事：登入保護
------------------------------------------------------------
新增的寫入 API 沒有內建密碼。**在設定 Access 之前，任何知道
網址的人都能改或刪你的網站內容。** 編輯頁上會顯示紅色警告，
直到保護生效為止。

Cloudflare Dashboard → Zero Trust → Access → Applications
  → Add an application → Self-hosted

  Application name：INTEPLAST 網站管理
  Session duration：24 hours

  Public hostname（要加兩筆，缺一不可）：
    你的網域 / 路徑 admin
    你的網域 / 路徑 api/admin

  Policy：
    Name    ：公司同事
    Action  ：Allow
    Include ：Emails ending in  @wpjk.inteplast.com
              （或 Emails → 逐一列出業務同事的信箱）

設定完成後開 /admin/ 會先跳轉到 Cloudflare 的登入畫面，
輸入公司 email 收驗證碼即可。紅色警告會自動消失。

註：/api/admin 那筆一定要加。只保護 /admin 的話，網頁被擋住了，
    但 API 還是公開的 —— 直接對 API 送請求一樣能改資料。


步驟 1｜建立資料表
------------------------------------------------------------
D1 Console 或 wrangler 執行 db/schema-v3.sql 的「階段一」。
（階段二先不要跑，說明寫在檔案裡）

新增的東西：
  languages           語言清單（繁中、英文）
  translations        所有非基準語言的內容
  settings            公司資訊（原本的 content/site.json）
  synonym_suggestions LLM 產生的別名候選，待人工核准

現有的 name_en、desc_en 等欄位會被複製進 translations，
但欄位保留不動 —— 所以這一步不會改變網站的任何顯示。


步驟 2｜綁定 R2（圖片上傳）
------------------------------------------------------------
Cloudflare Dashboard → R2 → Create bucket
  名稱隨意，例如 inteplast-media

Pages → 你的專案 → Settings → Bindings → Add → R2 bucket
  Variable name：MEDIA      ← 一定要叫這個
  R2 bucket    ：剛建立的那個

Production 與 Preview 兩個環境都要綁（只綁 Production，
預覽分支上傳會失敗）。

上傳後的圖網址是 /media/<檔名>，由 functions/media/[[path]].js
提供。原本放在 src/product-img/ 的舊圖不受影響，兩種都能用。


步驟 3｜綁定 Workers AI（自動產生別名）
------------------------------------------------------------
Pages → 你的專案 → Settings → Bindings → Add → Workers AI
  Variable name：AI         ← 一定要叫這個

用的模型是 @cf/qwen/qwen1.5-14b-chat-awq（中文表現比 Llama 好）。
在「產品別名」頁按「產生建議」，候選會進入「待審別名」。

**候選一律要人工核准才會進搜尋。** 機器一定會產出看起來合理
但錯的別名（清潔袋 → 保鮮袋），而錯的別名比缺別名更糟 ——
客戶會被導到錯的產品，而且沒人會發現。


步驟 4｜上傳檔案並部署
------------------------------------------------------------
新增：
  admin/index.html                  編輯頁
  db/schema-v3.sql                  資料表
  src/site-info.js                  公司資訊套用層
  functions/api/_lib.js             共用：把 translations 併回資料列
  functions/api/settings.js         公司資訊（公開讀取）
  functions/api/languages.js        語言清單（公開讀取）
  functions/api/admin/data.js       編輯頁的資料來源
  functions/api/admin/save.js       唯一的寫入端點
  functions/api/admin/upload.js     圖片上傳到 R2
  functions/api/admin/suggest.js    LLM 產生別名候選
  functions/media/[[path]].js       提供 R2 上的圖片

修改：
  functions/api/products.js         英文改由 translations 併入
  functions/api/timeline.js         同上
  functions/api/synonyms.js         回傳一併帶上產品名稱
  src/navbar.js                     注入 src/site-info.js
  index.html                        圖片路徑支援 /media/…
  products/index.html               圖片路徑支援 /media/…

functions/ 有變動，一定要重新部署。


步驟 5｜驗證
------------------------------------------------------------
1. 開 /admin/ → 有沒有紅色警告？有就回去做 Access
2. 產品資料 → 隨便改一個字 → 儲存 → 開網站確認變了
3. 產品資料 → 編輯任一產品 → 切到 English 頁籤 → 英文有帶進來
   （表示 translations 搬移成功）
4. 上傳一張圖 → 儲存 → 網站上那張圖換了（表示 R2 通了）
5. 產品別名 → 按「產生建議」→ 待審別名有候選（表示 AI 通了）
6. 網站首頁按 Ctrl+K 搜「垃圾袋」→ 找到清潔袋
7. 公司資訊 → 改電話 → 儲存 → 網站頁尾的電話變了


之後要加日文
------------------------------------------------------------
編輯頁 → 語言 → 新增（代碼 ja、名稱 日本語）→ 送出。

產品與時間軸的編輯畫面就會多一個「日本語」頁籤，填完存檔即可。
不需要改資料表、不需要改程式碼、不需要我出手。

這是為什麼採用一張 translations 表、而不是一個語言一張表 ——
一個語言一張表的話，每加一種語言都要新增資料表、寫新的 API、
改前端程式碼。


目前還沒做的
------------------------------------------------------------
- 詢價紀錄與搜尋紀錄還在 Google Sheet（Apps Script），
  Cloudflare 這邊讀不到。搬進 D1 之後，編輯頁就能顯示
  「這個詞被搜過 18 次都是 0 筆」並直接一鍵加成別名。
- 產品的規格表（尺寸、厚度、每箱入數）目前網站上沒有這種資料。
  要做的話是 products 底下再開一張 product_specs 表。
