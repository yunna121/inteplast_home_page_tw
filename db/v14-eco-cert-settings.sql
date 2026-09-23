-- v14：環保標章證書資訊改由後台「公司資訊」維護
-- 在 Cloudflare D1 Console 貼上執行；可重複執行（已存在的 key 會跳過）

INSERT INTO settings (key, value, label, hint, translatable, sort_order)
SELECT 'eco_cert_caption', '環保標章使用證書，由環境部核發。', '環保標章：證書圖說明', '首頁與永續頁證書圖片下方的小字', 1, 900
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'eco_cert_caption');

INSERT INTO settings (key, value, label, hint, translatable, sort_order)
SELECT 'cert_drawtape_no', '25987', '環保標章：拉繩清潔袋 證書編號', '只填數字，例如 25987', 0, 901
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'cert_drawtape_no');

INSERT INTO settings (key, value, label, hint, translatable, sort_order)
SELECT 'cert_drawtape_expiry', '2029/06/15', '環保標章：拉繩清潔袋 有效期限', '格式 YYYY/MM/DD', 0, 902
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'cert_drawtape_expiry');

INSERT INTO settings (key, value, label, hint, translatable, sort_order)
SELECT 'cert_garbage_no', '23645', '環保標章：清潔袋 證書編號', '只填數字，例如 23645', 0, 903
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'cert_garbage_no');

INSERT INTO settings (key, value, label, hint, translatable, sort_order)
SELECT 'cert_garbage_expiry', '2027/12/08', '環保標章：清潔袋 有效期限', '格式 YYYY/MM/DD', 0, 904
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'cert_garbage_expiry');

-- 驗收：應該回 5 列
SELECT id, key, value FROM settings WHERE key IN
  ('eco_cert_caption','cert_drawtape_no','cert_drawtape_expiry','cert_garbage_no','cert_garbage_expiry');
