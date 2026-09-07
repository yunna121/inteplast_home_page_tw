-- 客戶詢價紀錄（v4）
-- ============================================================
-- 原本表單只送到 Google Apps Script，寫進 Google Sheet ——
-- Cloudflare 這邊讀不到，所以網站上查不到任何詢價紀錄。
-- 這張表讓詢價成為網站自己的資料：編輯頁看得到、可標記處理狀態。
--
-- 執行：npx wrangler d1 execute company-website --remote --file=schema-v4.sql
-- （或整份貼進 D1 Console）
-- ============================================================

CREATE TABLE IF NOT EXISTS inquiries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  company    TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',
  product    TEXT NOT NULL DEFAULT '',   -- 詢問的產品類別
  message    TEXT NOT NULL DEFAULT '',   -- 需求內容
  lang       TEXT NOT NULL DEFAULT '',   -- 送出時的網站語言
  page       TEXT NOT NULL DEFAULT '',   -- 從哪一頁送出
  status     TEXT NOT NULL DEFAULT 'new',-- new｜done
  note       TEXT NOT NULL DEFAULT '',   -- 內部備註（誰跟進、結果）
  mailed     INTEGER NOT NULL DEFAULT 0, -- 通知信是否寄出成功
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 編輯頁預設看「未處理」，所以照 status + 時間查
CREATE INDEX IF NOT EXISTS idx_inq_status ON inquiries (status, id);

-- 確認
SELECT COUNT(*) AS 詢價筆數 FROM inquiries;
