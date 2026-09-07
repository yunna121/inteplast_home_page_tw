-- 頁面區塊（v7）
-- ============================================================
-- 讓業務在「關於營德」「永續發展」自行新增內容段落。
--
-- 為什麼不是自由畫布：版型固定成四種，樣式由程式碼決定，
-- 業務只填內容與排順序 —— 版面壞不掉。
--
-- 現有的九個區段不動：它們的文字已經能在「介面文字」修改，
-- 而合作網絡圖、能力卡、工廠影片這些是為特定內容做的排版，
-- 轉成通用區塊會失去現在的設計。
--
-- 整份貼進 D1 Console 按 Execute
-- ============================================================

CREATE TABLE IF NOT EXISTS page_blocks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page       TEXT NOT NULL,                    -- about｜sustainability
  layout     TEXT NOT NULL DEFAULT 'image-right',
  -- image-right  圖右文左
  -- image-left   圖左文右
  -- full-image   全寬大圖 + 標題
  -- text         純文字段落
  -- quote        引言／數據強調
  eyebrow    TEXT NOT NULL DEFAULT '',         -- 小標（英文短句，選填）
  title      TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  image      TEXT NOT NULL DEFAULT '',         -- /media/xxx.png 或既有圖檔名
  caption    TEXT NOT NULL DEFAULT '',         -- 圖說（選填）
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_blocks_page ON page_blocks (page, sort_order);

-- 各語言的內容存在既有的 translations（entity='block'，
-- field = eyebrow｜title｜body｜caption），所以新增語言一樣不必改結構。

SELECT '頁面區塊' AS 表, COUNT(*) AS 筆數 FROM page_blocks;
