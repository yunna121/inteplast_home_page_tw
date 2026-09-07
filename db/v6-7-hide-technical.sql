-- 技術性字串：改由程式碼維護，不出現在後台
-- ============================================================
-- 含 {{變數}} 或 <br> 的字串，業務不該需要處理。
-- 這裡把中英日都填好，並標記為 hidden —— 後台的「介面文字」
-- 清單不會顯示它們，網站照常運作。
--
-- 之後如果需要改這幾句，跟工程師講一聲改這份 SQL 即可。
--
-- 整份貼進 D1 Console 按 Execute
-- ============================================================

-- 1) 加一個隱藏欄位（已經加過會報 duplicate column，忽略即可）
ALTER TABLE ui_strings ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;

-- 2) 標記這四條
UPDATE ui_strings SET hidden = 1 WHERE zh IN (
  '年 (1983-{{year}})',
  '{{years}} 年全球品牌資歷',
  '讓每一次選擇，<br>更靠近綠色生活。',
  '以綠葉環抱地球，<br>辨識更友善的選擇。'
);

-- 3) 填入翻譯（已有的會被覆蓋成這裡的版本）
INSERT INTO translations (entity, entity_id, field, lang, value)
  SELECT 'ui', id, 'text', 'en', 'Yrs (1983-{{year}})' FROM ui_strings WHERE zh = '年 (1983-{{year}})'
  ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value;
INSERT INTO translations (entity, entity_id, field, lang, value)
  SELECT 'ui', id, 'text', 'ja', '年 (1983-{{year}})' FROM ui_strings WHERE zh = '年 (1983-{{year}})'
  ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value;
INSERT INTO translations (entity, entity_id, field, lang, value)
  SELECT 'ui', id, 'text', 'en', '{{years}} Years Group History' FROM ui_strings WHERE zh = '{{years}} 年全球品牌資歷'
  ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value;
INSERT INTO translations (entity, entity_id, field, lang, value)
  SELECT 'ui', id, 'text', 'ja', 'グローバルブランド {{years}} 年の実績' FROM ui_strings WHERE zh = '{{years}} 年全球品牌資歷'
  ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value;
INSERT INTO translations (entity, entity_id, field, lang, value)
  SELECT 'ui', id, 'text', 'en', 'Every choice you make,<br>a step closer to green living.' FROM ui_strings WHERE zh = '讓每一次選擇，<br>更靠近綠色生活。'
  ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value;
INSERT INTO translations (entity, entity_id, field, lang, value)
  SELECT 'ui', id, 'text', 'ja', '一つひとつの選択が、<br>グリーンな暮らしへ。' FROM ui_strings WHERE zh = '讓每一次選擇，<br>更靠近綠色生活。'
  ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value;
INSERT INTO translations (entity, entity_id, field, lang, value)
  SELECT 'ui', id, 'text', 'en', 'Green leaves around the Earth,<br>the mark of a kinder choice.' FROM ui_strings WHERE zh = '以綠葉環抱地球，<br>辨識更友善的選擇。'
  ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value;
INSERT INTO translations (entity, entity_id, field, lang, value)
  SELECT 'ui', id, 'text', 'ja', '地球を包む緑の葉が、<br>やさしい選択の目印に。' FROM ui_strings WHERE zh = '以綠葉環抱地球，<br>辨識更友善的選擇。'
  ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value;

-- 確認：後台會顯示的條數（應該是 174）
SELECT COUNT(*) AS 後台顯示 FROM ui_strings WHERE hidden = 0;
SELECT zh FROM ui_strings WHERE hidden = 1;
