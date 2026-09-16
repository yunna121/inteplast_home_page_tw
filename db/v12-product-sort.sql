-- 產品自訂排序（後台「產品資料」清單可拖曳）
-- 跑完之後部署本次的 4 個檔案改動，後台就會出現拖曳握把。

-- 1) 加欄位
ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0;

-- 2) 用現在的順序（id）當初始值，這樣上線那一刻順序不會變
UPDATE products SET sort_order = id;

-- 3) 驗收：應該與後台清單順序一致
SELECT id, sort_order, name FROM products ORDER BY sort_order, id;
