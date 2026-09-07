-- 讓中文文案也能在後台修改
-- ============================================================
-- 原本用中文原文當索引鍵，所以中文一改就對不到頁面了。
-- 這裡把「鍵」和「內容」分開：
--
--   zh_key  頁面上 data-tw 寫的那句，對應用，永遠不變
--   zh      實際顯示的中文，業務可以隨時改
--
-- 改中文之後，網站上的中文、以及各語言的對照都跟著更新，
-- 不需要改任何程式碼。
--
-- 整份貼進 D1 Console 按 Execute
-- ============================================================

-- 已經加過會報 duplicate column，忽略即可
ALTER TABLE ui_strings ADD COLUMN zh_key TEXT;

UPDATE ui_strings SET zh_key = zh WHERE zh_key IS NULL OR zh_key = '';

-- 確認：兩欄現在應該一模一樣
SELECT COUNT(*) AS 總筆數,
       SUM(CASE WHEN zh = zh_key THEN 1 ELSE 0 END) AS 尚未改過的
  FROM ui_strings;
