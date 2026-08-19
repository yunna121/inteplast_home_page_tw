repo: yunna121/inteplast_home_page_tw
branch: main

## Sync history
- 2026-08-18T08:58:40Z（詳見下方項目）

## Last sync
date: 2026-08-19T01:45:00Z

### Updated in this project
- 新增 tools/update-specs.html：無伺服器環境下的 Excel 轉檔工具（拖入 products_specs.xlsx → 驗證版型與尺寸格式 → 下載 specs.js 覆蓋）。架上伺服器後即不需此步驟。
- 規格表改為 Excel 驅動：新增 src/data/products_specs.xlsx（工作表「規格總表」82 列＋「說明」頁）作為唯一資料來源；src/spec-render.js 於載入時以 SheetJS 直接讀取 xlsx 並渲染四種版型（edm 橫列卡片／card 等比例大卡／ramp 對比牆／table 表格），讀不到時改用 src/data/specs.js 備援快照。
- 六大分類頁的規格列全部移出 HTML，改為空容器 + data-spec-block / data-spec-layout / data-spec-series；詢價單品名由系統自動組成。
- 搜尋索引的規格內文改由規格資料即時組成，Excel 改完搜尋結果同步更新。
- 全站搜尋改為全文檢索：產品資料抽出為 src/data/search-data.js（window.SITE_SEARCH_DATA，含各品項規格內文與同義詞字典，一般 script 載入，file:// 也能跑）；src/site-search.js 改為倒排索引 + BM25 排序 + 欄位加權 + 錯字容錯，命中規格時直接顯示該段規格片段並高亮。
- 支援尺寸查詢（86x100 → 寬86×長100）、號數（0號）、容量（45L）與英文錯字（ziplok → 夾鏈袋）。
- 專案內檔案再次遺失，已自 repo (main) 還原全部頁面與素材，並重做首頁分類卡 04/05 連結、產品中心夾鏈袋按鈕、資料檔 page_url、拉繩袋兩張攝影圖與圖說。
- 修正清潔袋頁「環保清潔袋」版面錯亂；「環保拉繩清潔袋」移至拉繩袋頁。
- 有尺寸的品項改為等比例對比牆（依真實公分換算，同頁共用一個比例尺），移除重複長表格；無尺寸品項保留表格並補上批量詢價欄。
- foodservice.html 依大類拆為 heat-bags / sealed-packaging / accessories 三頁，舊網址保留轉向；選單與搜尋索引一併更新。
- 新增跨頁詢價籃 src/quote-basket.js（購物車模式，可清空），並移除各產品頁首圖的「針對此產品線上詢價」按鈕。
- 新增內部報告投影片 website-progress-report.dc.html（14 頁，可匯出 PPTX）。
- 新增網站介紹投影片 website-introduction.dc.html（12 頁，含產品實拍，可匯出 PPTX）。
- 詢價籃按鈕文字改為「填寫詢價資料」；移除耐熱袋卡片的「嚴選台塑食品級原料 · 絕無塑化劑添加」文案（含 products.csv / products.json 資料來源）。
- products/index.html 與資料檔的 page_url 改指向 heat-bags / sealed-packaging / accessories。

- 全站選單連結（首頁、關於、聯繫、永續、產品中心與各分類頁）改指向拆分後的新分類頁；舊 foodservice.html 改為三選一導引頁。

- 其他類頁（手套、遮蔽防塵膠帶）改為圖左表右版型，使用 src/螢幕擷取畫面 2026-08-13 160650.png 與 160829.png 兩張產品實拍。

- 新增全站模糊搜尋 src/site-search.js：同義詞字典（垃圾袋→清潔袋、束口袋→拉繩袋、保鮮袋→冷凍袋…）、異體字與全形正規化、雙字組相似度與英文錯字容錯、索引到子分類並可直接跳至規格區塊；各頁面補上搜尋按鈕。

- 分類改名：「密封包裝類」→「夾鏈袋」、「耐熱袋」→「蔬果袋類」（子品項平裝／卷裝耐熱袋名稱不變），全站選單、篩選列、卡片標題、meta 與搜尋索引一併更新。
- 蔬果袋新增為蔬果袋類第三項品項（heat-bags.html#cat-produce），含產品說明與詢價入口；規格數字待客戶提供，頁面明確標示整理中。

- 新增全站響應式：src/responsive.css（1024/768/480 三個斷點，修正首圖多欄、規格表、等比例對比牆、篩選列、浮動詢價籃、3D 折疊卡片在窄螢幕的破版）與 src/mobile-nav.js（1000px 以下顯示漢堡側滑抽屜，選單內容直接複製頁首 .nav-menu 自動同步）。
- 除公司名「臺灣營德」外，全站「臺灣」統一改為「台灣」。

- 「美商營德／美商營德集團」與頁首「USA Division 美國總部」改為 Inteplast USA。
- 手機響應式加強：圖文左右並排的區塊（產品首圖、產品卡、圖左表右、永續證書）在 1024px 以下改為上下堆疊且圖片置上。
- 本次曾自 repo (main) 還原 products/ 與 src/（專案內檔案一度遺失），還原後重做品牌用字修正。

## Screen map
| Screen | Repo files |
| --- | --- |
| products/can-liners.html（清潔袋） | products/can-liners.html |
| products/draw-tape.html（拉繩袋） | products/draw-tape.html |
| products/heat-bags.html（耐熱袋，由 foodservice 拆出） | products/foodservice.html, src/formosa_heat_bag_real.png |
| products/sealed-packaging.html（密封包裝類，由 foodservice 拆出） | products/foodservice.html, src/ai_zipper_bag.png |
| products/accessories.html（其他類，由 foodservice 拆出） | products/foodservice.html, src/ai_specialty.png |
| products/foodservice.html（舊網址轉向頁） | products/foodservice.html |
| products/zipper-bags.html（舊夾鏈袋頁，尚無連結指向） | products/zipper-bags.html |
| products/index.html（產品中心） | products/index.html, src/data/products.csv, src/data/products.json |
| index.html / about.html / contact.html / sustainability.html（選單連結修正） | 同名 repo 檔案 |
| 全站搜尋／導覽／詢價籃／響應式 | src/site-search.js, src/navbar.js, src/navbar.css, src/mobile-nav.js, src/responsive.css |
| website-progress-report.dc.html（內部報告投影片） | — 依專案現況彙整 |
| website-introduction.dc.html（網站介紹投影片） | src/inteplast-logo-blue.svg, src/formosa_canliner_official.png, src/Can-Liners-Draw-Tape-Draw-Tape-2.jpg, src/formosa_heat_bag_real.png, src/ai_zipper_bag.png, src/ai_specialty.png, src/scale sheet.png |
