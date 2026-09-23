-- v15：證書編號／有效期限 → 後台「圖片與檔案」；證書圖說明 → 後台「介面文字」
-- 在 Cloudflare D1 Console 貼上執行；可重複執行

-- 1) 證書編號與有效期限（放在「圖片與檔案」，跟產品資料 PDF 放一起）
INSERT INTO site_images (key, label, hint, path, fallback)
SELECT 'cert_drawtape_no_text', '台塑環保拉繩清潔袋 證書編號', '永續發展頁該卡片的證書編號，只填數字', '25987', '25987'
WHERE NOT EXISTS (SELECT 1 FROM site_images WHERE key = 'cert_drawtape_no_text');

INSERT INTO site_images (key, label, hint, path, fallback)
SELECT 'cert_drawtape_expiry_text', '台塑環保拉繩清潔袋 有效期限', '格式 YYYY/MM/DD', '2029/06/15', '2029/06/15'
WHERE NOT EXISTS (SELECT 1 FROM site_images WHERE key = 'cert_drawtape_expiry_text');

INSERT INTO site_images (key, label, hint, path, fallback)
SELECT 'cert_garbage_no_text', '台塑環保清潔袋 證書編號', '永續發展頁該卡片的證書編號，只填數字', '23645', '23645'
WHERE NOT EXISTS (SELECT 1 FROM site_images WHERE key = 'cert_garbage_no_text');

INSERT INTO site_images (key, label, hint, path, fallback)
SELECT 'cert_garbage_expiry_text', '台塑環保清潔袋 有效期限', '格式 YYYY/MM/DD', '2027/12/08', '2027/12/08'
WHERE NOT EXISTS (SELECT 1 FROM site_images WHERE key = 'cert_garbage_expiry_text');

-- 2) 證書圖說明、「證書編號」「有效期限至」、永續頁資料來源 → 介面文字（含英文、日文）
INSERT INTO ui_strings (zh, zh_key)
SELECT '環保標章使用證書，由環境部核發。', '環保標章使用證書，由環境部核發。' WHERE NOT EXISTS (SELECT 1 FROM ui_strings WHERE zh_key = '環保標章使用證書，由環境部核發。');
INSERT INTO translations (entity, entity_id, field, lang, value)
SELECT 'ui', id, 'text', 'en', 'Green Mark certificates issued by the Ministry of Environment.' FROM ui_strings WHERE zh_key = '環保標章使用證書，由環境部核發。'
ON CONFLICT(entity, entity_id, field, lang) DO NOTHING;
INSERT INTO translations (entity, entity_id, field, lang, value)
SELECT 'ui', id, 'text', 'ja', 'グリーンマーク使用証明書（環境部発行）。' FROM ui_strings WHERE zh_key = '環保標章使用證書，由環境部核發。'
ON CONFLICT(entity, entity_id, field, lang) DO NOTHING;

INSERT INTO ui_strings (zh, zh_key)
SELECT '證書編號', '證書編號' WHERE NOT EXISTS (SELECT 1 FROM ui_strings WHERE zh_key = '證書編號');
INSERT INTO translations (entity, entity_id, field, lang, value)
SELECT 'ui', id, 'text', 'en', 'Certificate No.' FROM ui_strings WHERE zh_key = '證書編號'
ON CONFLICT(entity, entity_id, field, lang) DO NOTHING;
INSERT INTO translations (entity, entity_id, field, lang, value)
SELECT 'ui', id, 'text', 'ja', '証明書番号' FROM ui_strings WHERE zh_key = '證書編號'
ON CONFLICT(entity, entity_id, field, lang) DO NOTHING;

INSERT INTO ui_strings (zh, zh_key)
SELECT '有效期限至', '有效期限至' WHERE NOT EXISTS (SELECT 1 FROM ui_strings WHERE zh_key = '有效期限至');
INSERT INTO translations (entity, entity_id, field, lang, value)
SELECT 'ui', id, 'text', 'en', 'Valid until' FROM ui_strings WHERE zh_key = '有效期限至'
ON CONFLICT(entity, entity_id, field, lang) DO NOTHING;
INSERT INTO translations (entity, entity_id, field, lang, value)
SELECT 'ui', id, 'text', 'ja', '有効期限' FROM ui_strings WHERE zh_key = '有效期限至'
ON CONFLICT(entity, entity_id, field, lang) DO NOTHING;

INSERT INTO ui_strings (zh, zh_key)
SELECT '資料來源：環境部「綠色生活資訊網」環保標章介紹（greenlifestyle.moenv.gov.tw），2026 年 9 月擷取。', '資料來源：環境部「綠色生活資訊網」環保標章介紹（greenlifestyle.moenv.gov.tw），2026 年 9 月擷取。' WHERE NOT EXISTS (SELECT 1 FROM ui_strings WHERE zh_key = '資料來源：環境部「綠色生活資訊網」環保標章介紹（greenlifestyle.moenv.gov.tw），2026 年 9 月擷取。');
INSERT INTO translations (entity, entity_id, field, lang, value)
SELECT 'ui', id, 'text', 'en', 'Source: Ministry of Environment, Green Lifestyle Information Platform (greenlifestyle.moenv.gov.tw), retrieved Sep 2026.' FROM ui_strings WHERE zh_key = '資料來源：環境部「綠色生活資訊網」環保標章介紹（greenlifestyle.moenv.gov.tw），2026 年 9 月擷取。'
ON CONFLICT(entity, entity_id, field, lang) DO NOTHING;
INSERT INTO translations (entity, entity_id, field, lang, value)
SELECT 'ui', id, 'text', 'ja', '出典：環境部「グリーンライフ情報ネット」グリーンマーク紹介（greenlifestyle.moenv.gov.tw）、2026年9月取得。' FROM ui_strings WHERE zh_key = '資料來源：環境部「綠色生活資訊網」環保標章介紹（greenlifestyle.moenv.gov.tw），2026 年 9 月擷取。'
ON CONFLICT(entity, entity_id, field, lang) DO NOTHING;

-- 3) 移除上一版（v14）放在「公司資訊」的欄位（沒跑過 v14 也沒關係）
DELETE FROM translations WHERE entity = 'setting' AND entity_id IN (SELECT id FROM settings WHERE key IN ('eco_cert_caption','cert_drawtape_no','cert_drawtape_expiry','cert_garbage_no','cert_garbage_expiry'));
DELETE FROM settings WHERE key IN ('eco_cert_caption','cert_drawtape_no','cert_drawtape_expiry','cert_garbage_no','cert_garbage_expiry');

-- 驗收：第一個應回 4 列、第二個 4 列
SELECT key, path FROM site_images WHERE key IN ('cert_drawtape_no_text','cert_drawtape_expiry_text','cert_garbage_no_text','cert_garbage_expiry_text');
SELECT id, zh FROM ui_strings WHERE zh_key IN ('環保標章使用證書，由環境部核發。','證書編號','有效期限至','資料來源：環境部「綠色生活資訊網」環保標章介紹（greenlifestyle.moenv.gov.tw），2026 年 9 月擷取。');
