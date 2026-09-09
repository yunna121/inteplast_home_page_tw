-- 網站圖片（v11）
-- ============================================================
-- 頁面上「不是產品照」的那些圖：永續頁的環保標章產品照、環保標章
-- 使用證書、關於營德的頁首與獎項照片。它們原本寫死在 HTML 裡，
-- 要換得找工程師。
--
-- 設計重點：一列＝「網站上的一個圖片位置」，不是一個檔案。
--   key        程式用的位置代號（永不變）
--   label      後台顯示的名稱
--   hint       說明這張圖出現在哪、建議尺寸
--   path       目前用的圖：/media/xxx.webp（後台上傳）或 repo 裡的檔案路徑
--   fallback   預設值（repo 裡原本那張），要還原時照著填回 path
--
-- 版型不會壞：位置與尺寸由 CSS 決定，業務只能換那個位置的圖。
-- 影片不放這裡也不放資料庫 —— D1 單筆上限 1MB，影片走 repo 靜態檔。
--
-- 整份貼進 D1 Console 按 Execute
-- ============================================================

CREATE TABLE IF NOT EXISTS site_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL DEFAULT '',
  hint       TEXT NOT NULL DEFAULT '',
  path       TEXT NOT NULL DEFAULT '',
  fallback   TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TEXT
);

INSERT OR IGNORE INTO site_images (key, label, hint, path, fallback, sort_order) VALUES
  ('sus_product_drawtape',
   '永續頁：台塑環保拉繩清潔袋',
   '永續發展頁「環保標章認證產品」左邊那張。橫幅裁切，建議 1600×1000 以上',
   'src/opt/drawtape.jpg', 'src/opt/drawtape.jpg', 1),

  ('sus_product_cleaning',
   '永續頁：台塑環保清潔袋',
   '永續發展頁「環保標章認證產品」右邊那張。橫幅裁切，建議 1600×1000 以上',
   'src/opt/cleaning.jpg', 'src/opt/cleaning.jpg', 2),

  ('eco_certificate',
   '環保標章使用證書',
   '首頁與永續發展頁都用這一張。換掉前請確認是最新版證書',
   'src/opt/combine.jpg', 'src/opt/combine.jpg', 3),

  ('about_hero',
   '關於營德：頁首背景照',
   '關於營德最上方的全幅背景（製袋區）。以右下角為基準裁切，建議 2000px 寬以上的橫幅',
   'src/製袋區.jpeg', 'src/製袋區.jpeg', 4),

  ('about_awards',
   '關於營德：卓越獎項照片',
   '「連續五年獲頒卓越獎」旁邊的獎座照。白底棚拍，建議 1200×900 以上',
   'src/excellence-awards.jpg', 'src/excellence-awards.jpg', 5);

-- 確認
SELECT key, label, path FROM site_images ORDER BY sort_order;
