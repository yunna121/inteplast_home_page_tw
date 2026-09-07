-- 新增「服務時間」欄位（v5）
-- ============================================================
-- 顯示在聯繫我們的電話下方，內容由編輯頁的「公司資訊」維護。
-- translatable = 1，所以英文版可以有自己的寫法（含時區）。
--
-- 執行：整份貼進 D1 Console，或
--       npx wrangler d1 execute company-website --remote --file=schema-v5.sql
-- ============================================================

INSERT OR IGNORE INTO settings (key, value, label, hint, translatable, sort_order) VALUES
  ('office_hours',
   '服務時間：週一至週五 08:30–17:30（國定假日休息）',
   '服務時間',
   '顯示在聯繫我們的電話下方。客戶看到號碼的當下就知道現在打有沒有人接',
   1, 8);

INSERT OR IGNORE INTO translations (entity, entity_id, field, lang, value)
SELECT 'setting', id, 'value', 'en',
       'Office hours: Mon–Fri 08:30–17:30 (GMT+8), closed on national holidays'
  FROM settings WHERE key = 'office_hours';

-- 確認
SELECT key, value FROM settings WHERE key = 'office_hours';
