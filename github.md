repo: yunna121/inteplast_home_page_tw
branch: main

## Last sync
date: 2026-09-14T05:58:18Z

### Updated in this project
- 後台儲存列改為黏在視窗底部（`.formfoot` sticky），長表單不必再滾到最下面
- 後台新增 Ctrl/Cmd + S 快速儲存，按鈕上顯示對應快速鍵
- 五個前台頁面的 `data-en` / `data-ph-en` 一律清空，英文改由 D1 供應（`data-desc-en` 保留給 SEO）
- `src/site-lang.js` 取消「英文不等網路」捷徑，英文與日文同樣等 D1 對照表

## Screen map
| 畫面 | 來源檔 |
|---|---|
| 後台 | admin/index.html |
| 首頁 | index.html, src/site-lang.js |
| 關於營德 | about.html |
| 產品 | products/index.html |
| 永續發展 | sustainability.html |
| 聯絡我們 | contact.html |
