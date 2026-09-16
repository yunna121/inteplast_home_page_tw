-- 讓 ui_strings.zh_key 與 zh 一致，消除「先顯示 HTML、再被資料庫覆寫」的閃爍
-- 前提：先部署本次的 HTML 改動（data-tw 已同步為 zh 的文字）
-- translations 表以 entity_id 關聯，改 zh_key 不會影響英文／日文譯文

-- 1) 先備份（把結果複製起來，萬一要還原）
SELECT id, zh_key, zh FROM ui_strings WHERE zh <> zh_key;

-- 2) 檢查會不會撞到別列的 key（有結果就先處理那幾列，不要直接跑步驟 3）
SELECT a.id, a.zh FROM ui_strings a
 JOIN ui_strings b ON b.zh_key = a.zh AND b.id <> a.id
WHERE a.zh <> a.zh_key;

-- 3) 同步（id 171 排除：它的 zh 尾端多一個半形句點，先修那筆再說）
UPDATE ui_strings SET zh_key = zh WHERE zh <> zh_key AND id <> 171;

-- 3b) id 171 的多餘句點（確認後再跑）
-- UPDATE ui_strings SET zh = '台灣塑膠工業股份有限公司' WHERE id = 171;

-- 4) 驗收：應該回 0 列
SELECT COUNT(*) AS 還沒同步 FROM ui_strings WHERE zh <> zh_key;
