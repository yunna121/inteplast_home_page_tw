-- v9：記錄「誰改的、什麼時候改的」
-- ------------------------------------------------------------
-- 只加兩欄，不做完整變更歷程 —— 兩三個人維護的後台，需要的是
-- 「這段文案上次被誰改」，不是可以還原到任一版本的稽核系統。
-- 真的改壞了，D1 有 Time Travel 可以整庫回溯。
--
-- updated_by 存的是登入帳號（ADMIN_USERS 裡的名字，或 Cloudflare
-- Access 的 Email），由 functions/api/admin/save.js 寫入。
-- updated_at 是 ISO 8601 字串（UTC），與 inquiries.created_at 一致。
--
-- 執行方式：Cloudflare 後台 D1 → Console 貼上，或
--   npx wrangler d1 execute <資料庫名> --file db/v9-audit.sql --remote
--
-- SQLite 沒有 ADD COLUMN IF NOT EXISTS：已經加過的表會報
-- "duplicate column name"，那是預期的，跳過那一行繼續即可。

ALTER TABLE products      ADD COLUMN updated_by TEXT;
ALTER TABLE products      ADD COLUMN updated_at TEXT;

ALTER TABLE timeline      ADD COLUMN updated_by TEXT;
ALTER TABLE timeline      ADD COLUMN updated_at TEXT;

ALTER TABLE synonyms      ADD COLUMN updated_by TEXT;
ALTER TABLE synonyms      ADD COLUMN updated_at TEXT;

ALTER TABLE settings      ADD COLUMN updated_by TEXT;
ALTER TABLE settings      ADD COLUMN updated_at TEXT;

ALTER TABLE ui_strings    ADD COLUMN updated_by TEXT;
ALTER TABLE ui_strings    ADD COLUMN updated_at TEXT;

ALTER TABLE page_blocks   ADD COLUMN updated_by TEXT;
ALTER TABLE page_blocks   ADD COLUMN updated_at TEXT;

-- 詢價：客戶送來的內容不可編輯，這兩欄記的是「誰處理的」
ALTER TABLE inquiries     ADD COLUMN updated_by TEXT;
ALTER TABLE inquiries     ADD COLUMN updated_at TEXT;
