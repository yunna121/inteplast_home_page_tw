
-- 既有英文搬進 translations

-- 確認
SELECT '介面文字' AS 表, COUNT(*) AS 筆數 FROM ui_strings
UNION ALL SELECT '其中已有英文', COUNT(*) FROM translations WHERE entity = 'ui' AND lang = 'en';

-- 還沒有英文的（應該只有兩筆）
SELECT u.zh FROM ui_strings u
  LEFT JOIN translations t ON t.entity='ui' AND t.entity_id=u.id AND t.lang='en'
 WHERE t.id IS NULL;
