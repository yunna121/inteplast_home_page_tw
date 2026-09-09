repo: yunna121/inteplast_home_page_tw
branch: main

## Last sync
date: 2026-09-09T04:10:00Z

### Updated in this project
- 新增後台「網站圖片」頁：永續頁兩張產品照、環保標章證書、關於頁首與獎項照可自行更換
- 導覽列日文換行（navbar.css + responsive.css 的 nowrap 衝突）
- 兩人帳號登入（ADMIN_USERS）與修改紀錄（updated_by / updated_at）
- 大圖壓縮到 src/opt/（2.2–2.7MB → 130–160KB）、GA 網域清單、移除重複樣式載入

## Screen map
| 專案畫面 | 來源檔案 |
| --- | --- |
| 導覽列日文換行修正.dc.html | src/navbar.css, src/responsive.css, src/navbar.js |
| 管理後台登入畫面 v2.dc.html | admin/index.html, functions/api/admin/login.js |
| index.html / sustainability.html / about.html | 同名檔案 + src/site-images.js, src/opt/* |
| contact.html / products/index.html | 同名檔案（GA 網域、重複樣式） |
| admin/index.html | admin/index.html（登入畫面、修改紀錄、網站圖片頁） |
| functions/api | admin/_middleware.js, login.js, logout.js, save.js, data.js, site-images.js |
| db | v9-audit.sql, v10-cleanup.sql, v11-site-images.sql |

## Sync history
- 2026-09-09T04:00:30Z — 四頁修正、圖片壓縮、資料庫欄位清查
- 2026-09-09T02:56:20Z — 兩人帳號登入與修改紀錄
- 2026-09-09T00:48:41Z — 導覽列日文換行修正
