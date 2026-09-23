-- v16：補上「證書編號」「有效期限至」的英文、日文（已存在就覆寫）
-- 在 Cloudflare D1 Console 貼上執行；可重複執行

INSERT INTO ui_strings (zh, zh_key)
SELECT '證書編號', '證書編號' WHERE NOT EXISTS (SELECT 1 FROM ui_strings WHERE zh_key = '證書編號');
INSERT INTO ui_strings (zh, zh_key)
SELECT '有效期限至', '有效期限至' WHERE NOT EXISTS (SELECT 1 FROM ui_strings WHERE zh_key = '有效期限至');

INSERT INTO translations (entity, entity_id, field, lang, value)
SELECT 'ui', id, 'text', 'en', 'Certificate No.' FROM ui_strings WHERE zh_key = '證書編號'
ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value;
INSERT INTO translations (entity, entity_id, field, lang, value)
SELECT 'ui', id, 'text', 'ja', '認証番号' FROM ui_strings WHERE zh_key = '證書編號'
ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value;

INSERT INTO translations (entity, entity_id, field, lang, value)
SELECT 'ui', id, 'text', 'en', 'Valid until' FROM ui_strings WHERE zh_key = '有效期限至'
ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value;
INSERT INTO translations (entity, entity_id, field, lang, value)
SELECT 'ui', id, 'text', 'ja', '有効期限' FROM ui_strings WHERE zh_key = '有效期限至'
ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value;

-- 驗收：應回 4 列
SELECT u.zh, t.lang, t.value FROM ui_strings u
JOIN translations t ON t.entity = 'ui' AND t.entity_id = u.id AND t.field = 'text'
WHERE u.zh_key IN ('證書編號', '有效期限至') AND t.lang IN ('en', 'ja');
