repo: yunna121/inteplast_home_page_tw
branch: main

## Last sync
date: 2026-09-09T02:56:20Z

### Updated in this project
- 導覽列：日文選單改為可折兩行，不再溢出蓋住搜尋條（src/navbar.css）
- 管理後台登入畫面改版：柔和陰影版面，左「網站管理系統」右帳號／密碼（admin/index.html）
- 兩人帳號登入：ADMIN_USERS 一人一組密碼，token 帶帳號名（login/logout/_middleware.js）
- 記錄誰改的：db/v9-audit.sql 加 updated_by / updated_at，save.js 寫入、data.js 回傳

## Screen map
| 專案畫面 | 來源檔案 |
| --- | --- |
| 導覽列日文換行修正.dc.html | src/navbar.css, src/navbar.js, src/site-search.js, src/site-lang.js, src/type.css |
| 管理後台登入畫面.dc.html | admin/index.html |
| 管理後台登入畫面 v2.dc.html | admin/index.html, functions/api/admin/login.js |
| admin/index.html（可覆蓋回 repo） | admin/index.html |
| functions/api/admin/*.js（可覆蓋回 repo） | functions/api/admin/_middleware.js, login.js, logout.js, save.js, data.js |
| db/v9-audit.sql（新檔） | db/schema-v6.sql |
| src/navbar.css（可覆蓋回 repo） | src/navbar.css |

## Sync history
- 2026-09-09T02:33:47Z — 登入畫面改版（v2 柔和陰影版面）
- 2026-09-09T00:48:41Z — 讀取 navbar/search/lang/type 樣式，重建導覽列並修正日文換行
