# 全站導覽收成同一個（原本定義 15 次）

量測結果：11 個頁面在 1440px 下，選單左緣 480px／中心 714px／寬 469px／header 高 72px／logo 字級 18.56px —— **完全一致，中心差異 0px**。
（可用 `tools/nav-check.html` 自己重跑，它會把每頁的實際數字列出來。）

## 為什麼原本每頁看起來不一樣
1. `.header` / `.logo-text-tw` / `.nav-link-item` 這組選擇器在 repo 裡被定義 **15 次**：`navbar.css` 一份、13 個頁面 inline 各一份、`sustainability-redesign.css` 一份，值還不同（logo 中文名 `1.16rem` vs `1.05rem`，選單內距 `8px 18px` vs `10px 18px`）。logo 寬度一變，選單就位移。
2. `about.html` 與 `products/index.html` 已經改用 `navbar.js` 注入，其他 11 頁還是手寫 —— 兩種版本的 CTA 文案也不同（「聯繫我們＋信封」vs「聯絡我們＋紙飛機」），寬度不同又推動選單。
3. `.header` 原本是 `flex + space-between`，中間選單不是真的置中，而是被左右兩塊擠出來的位置。
4. 語言鈕「EN / 繁中」↔「繁中 / EN」字寬不同，切換語言時整條右側會縮放。

## 這一包做了什麼

### 黑色頂欄「每頁位置不一樣」的真正原因（本次修正）
量測後找到的是全站共通的錯位：**黑色頂欄實際高 34.71px，但 `.header` 的 `top` 硬寫 31px**，
所以頁首往上壓、蓋掉頂欄底部約 3.7px。頂欄高度是內容算出來的（`min-height: 31px` 根本沒作用），
字體渲染、瀏覽器縮放或系統字型一變，被蓋掉的量就跟著變 —— 看起來就是「每頁那條黑的位置不太一樣」。

修正：
- `--utility-h` 由 31px 改為 **34px**，且 `.top-utility-bar` 用 `height: var(--utility-h)` + `line-height: 1` 鎖死，高度不再受字體影響。
- 8 個頁面裡硬寫的 `margin-top: 31px` / `--utility-height: 31px` 全部改成 `var(--utility-h)`，以後只要改一個變數。
- 量測結果：頂欄高 34 / 頂欄底 34 / header top 34（完全貼齊）/ 頂欄文字左緣 40 / 選單中心 714 —— 各頁差異 0px。

### 頁首「慢慢才跑出來」的修正
- `navbar.js` 從 `</body>` 前移到 **`<body>` 最上方、placeholder 的下一行**：一開始解析就注入，不用等整份文件解析完。
- `navbar.js` 改為「placeholder 已存在就立刻注入」，不再一律等 `DOMContentLoaded`。
- `navbar.css` 新增 `#site-header-component:empty` 骨架：JS 還沒執行前，頂部那條就已經是實色（上深藍下白＋底線），不會先空一塊再跳出來；注入後這條規則自動失效。
  這對慢速連線特別有感 —— 使用者看到的是「頁首已經在那裡，內容陸續補上」，而不是「頁面先空一塊」。

### 共用檔（3 個）
- **src/navbar.css** — 導覽樣式唯一來源。移除全部 `!important`；`.header` 改 `grid-template-columns: 1fr auto 1fr`（選單 `justify-self: center`，真置中）；`.lang-toggle { min-width: 108px }`；新增 `--utility-h` / `--header-h`；刪掉約 170 行沒有 DOM 會套用的搜尋視窗樣式（那些由 site-search.js 自行注入）。1000px 以下改回 flex（該斷點沒有選單）。
- **src/navbar.js** — 17.7KB → 7.1KB。刪掉整套與 `site-search.js` 重複的搜尋（10 筆硬寫索引 + 自製 modal，本來就不會執行）；換頁首時一併移除殘留的頂欄；移除 Ctrl+滾輪縮放（覆寫瀏覽器原生縮放，易誤觸），Ctrl `+`/`-`/`0` 保留。
- **src/site-lang.js**（新增）— 各頁重複的 `applyLanguage` / `toggleLanguage` 收成一支，並修掉原版切換數次後圖示消失的問題。

### 12 個頁面（全部改為引用共用檔）
index / about / contact / sustainability / products/index / can-liners / draw-tape / heat-bags / sealed-packaging / accessories / specialty / stretch-films

每頁的改動一律是：
- 刪掉頁內導覽 CSS（共刪 316 條規則）
- 手寫的頂欄＋頁首 HTML（每頁約 2.5KB）換成 `<div id="site-header-component"></div>`
- 頁內的語言切換與 mega menu hover 程式碼刪除（同一個 `<script>` 裡的其他頁面邏輯完整保留，例如首頁的 `resizeGridItem` / `animateCounters` / `checkRailVisibility`）
- `navbar.css` 的 `<link>` 補上 `id="site-navbar-css"`（navbar.js 才不會再注入第二份）
- 末尾補 `navbar.js` 與 `site-lang.js`
- `products/stretch-films.html` 另外刪掉 SheetJS（~300KB）與不存在的 `src/data/products.xlsx` fetch

檔案總共小了約 66KB。**文案與視覺一字未改。**

### sustainability-redesign.css
刪掉它那份 `.header` / `.logo-text-tw` / `.lang-toggle`（17 條規則）。

## 首頁：影片載入前的廠區照已移除
那張照片有兩個來源，都是同一張 `src/plant.png`（3.9MB）：
1. `<video poster="./src/plant.png">`
2. `.hero-bg-layer` 的 `background: #071627 url('./src/plant.png')`

兩處都移除，改為：
- `.hero-bg-layer` 用品牌深藍漸層（不必等圖片下載，第一時間就是實色）
- 影片 `opacity: 0` + `onloadeddata` 淡入，載好才出現，不再有「先照片後換影片」的突兀感

順帶少掉首頁 3.9MB 的圖片下載。

## 年份自動更新（新增 src/site-year.js）
原本完全是手動的 —— repo 裡沒有任何 `getFullYear()`，2026 寫死在 12 個地方（10 個頁尾版權 + 首頁「43 年 (1983-2026)」+ content/site.json）。

現在頁面裡改寫成兩個代號，載入時自動換成實際數字：
- `{{year}}` → 今年
- `{{years}}` → 從 1983 算起的年數（起始年寫在 `site-year.js` 最上面的 `FOUNDED`，只有這一處）

已改的地方：12 個頁尾的 `© {{year}}`、首頁 `data-target="{{years}}"`、`年 (1983-{{year}})`、`{{years}} 年全球品牌資歷`（中英文都改）。
明年 1 月 1 日不用動任何檔案。

替換範圍包含文字節點與 `data-tw` / `data-en` / `data-target` / `title` / `alt` 等屬性，所以語言切換後也是正確年份。
`site-year.js` 載入位置在 `navbar.js` 之後、各頁計數動畫之前，計數動畫讀到的已經是數字。

**刻意沒動的**：`about.html` 時間軸的 1983 / 2014 / 2026 是歷史里程碑，不該跟著今年跑。

**`content/site.json` 的 copyright 欄位**沒改 —— 那是 CMS 欄位，由 `content/content.js` 注入。若你要它也自動化，把欄位值改成 `© {{year}} INTEPLAST TAIWAN CORPORATION. All Rights Reserved.`，並在 content.js 注入完成後呼叫一次 `window.applyYearTokens(document.body)`。要我改的話跟我說。

## 上傳注意
`src/` 有 3 個檔案要換，請把整個 `src` 資料夾拖進 GitHub（上次只上傳到 `src/data` 那層，導致 repo 缺檔）。

## 還沒動的
- 各頁 `.footer` 樣式仍是每頁一份，可比照抽成 `src/footer.css`。
- 資料檔重複：`products-data.js`（來自 products-data.xlsx）與 `website-data.js`（來自 website-data.xlsx）並存，另有 `content/products.json`、`content/content.js`、`src/content.js`。要先確認哪一個是真來源。
- 圖片瘦身（`src/` 約 30MB）、檔名去中文與空白、把來源 xlsx 放進版控。
