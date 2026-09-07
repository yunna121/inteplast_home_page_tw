-- 圖片存進 D1（v8）
-- ============================================================
-- 不使用 R2，圖檔以 base64 存在資料庫裡，由 functions/media/[[path]].js
-- 提供出來，網址仍然是 /media/<檔名>。
--
-- 為什麼可行：D1 免費額度 5GB，而上傳時瀏覽器會先把圖縮到最長邊
-- 1600px 並轉成 WebP，一般產品照壓完 100–250KB。以你們的用量
-- （幾十張產品圖）遠遠用不完。
--
-- D1 單筆上限 1MB，所以超大原圖不能放 —— 上傳端會先壓縮，
-- 壓完還超過就會擋下來並告訴使用者。
--
-- 整份貼進 D1 Console 按 Execute
-- ============================================================

CREATE TABLE IF NOT EXISTS media (
  name       TEXT PRIMARY KEY,              -- 檔名，就是網址 /media/<name>
  mime       TEXT NOT NULL DEFAULT 'image/webp',
  data       TEXT NOT NULL,                 -- base64
  bytes      INTEGER NOT NULL DEFAULT 0,
  width      INTEGER NOT NULL DEFAULT 0,
  height     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

SELECT '圖片' AS 表, COUNT(*) AS 張數, COALESCE(SUM(bytes), 0) AS 總位元組 FROM media;
