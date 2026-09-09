-- v10：清掉沒人在用的欄位
-- ============================================================
-- 為什麼要清：這些欄位還在，但已經沒有任何程式讀它、也沒有任何
-- 程式寫它。留著的代價不是空間，是「下一個看資料庫的人會以為
-- 那是有效資料」——例如看到 products.name_en 就去改它，
-- 結果網站上完全沒反應（真正的英文在 translations）。
--
-- 每一項都先跑「確認」再跑「刪除」。分段跑，中途停下來也安全。
-- 執行：Cloudflare D1 → Console，或
--   npx wrangler d1 execute <資料庫名> --file db/v10-cleanup.sql --remote
-- ============================================================


-- ════════════════════════════════════════════════════════════
--  1) products / timeline 的舊英文欄位（schema-v3 階段二沒跑）
--  ------------------------------------------------------------
--  現在 /api/products 的 name_en 是 _lib.js 從 translations 組出來的，
--  save.js 的白名單也不含這些欄位 → 後台改英文不會寫進去，
--  它們是凍結在搬移那天的舊值。
-- ════════════════════════════════════════════════════════════

-- 確認一：欄位還在不在（沒有列出 name_en 就是已經清掉了，跳過這段）
SELECT name FROM pragma_table_info('products');
SELECT name FROM pragma_table_info('timeline');

-- 確認二：translations 裡的英文有沒有齊（右欄不該有空的）
SELECT p.id, p.name, p.name_en AS 舊欄位, t.value AS translations裡的
  FROM products p
  LEFT JOIN translations t
    ON t.entity = 'product' AND t.entity_id = p.id AND t.field = 'name' AND t.lang = 'en'
 ORDER BY p.id;

-- 確認無誤後，把下面六行的註解拿掉再執行
-- ALTER TABLE products DROP COLUMN name_en;
-- ALTER TABLE products DROP COLUMN highlight_en;
-- ALTER TABLE products DROP COLUMN desc_en;
-- ALTER TABLE products DROP COLUMN items_en;
-- ALTER TABLE timeline DROP COLUMN title_en;
-- ALTER TABLE timeline DROP COLUMN description_en;


-- ════════════════════════════════════════════════════════════
--  2) inquiries.mailed
--  ------------------------------------------------------------
--  當初用來記「通知信是否寄出成功」。inquiry.js 已經不寄信了
--  （Microsoft Graph 那段移除，業務改成到後台看紀錄），
--  所以這欄永遠是 0，後台也沒有任何地方顯示它。
-- ════════════════════════════════════════════════════════════

-- 確認：應該全部都是 0
SELECT mailed, COUNT(*) AS 筆數 FROM inquiries GROUP BY mailed;

-- ALTER TABLE inquiries DROP COLUMN mailed;


-- ════════════════════════════════════════════════════════════
--  3) synonym_suggestions.note
--  ------------------------------------------------------------
--  待審別名的備註欄。suggest.js（產生）與 save.js（採用／退回）
--  都沒有寫過它，後台也沒有輸入的地方 → 從來沒有值。
-- ════════════════════════════════════════════════════════════

-- 確認：有值的應該是 0 筆
SELECT COUNT(*) AS 有備註的 FROM synonym_suggestions WHERE COALESCE(note, '') <> '';

-- ALTER TABLE synonym_suggestions DROP COLUMN note;


-- ════════════════════════════════════════════════════════════
--  4) media.width / media.height —— 建議留著
--  ------------------------------------------------------------
--  upload.js 會寫入（前端壓縮後回報的尺寸），但目前沒有任何地方
--  讀它。不算「誤導」，而是還沒用到的資訊（之後要在後台顯示
--  「這張圖 1600×1200」時就會用上），刪掉沒有好處。
--  真的要清就把下面兩行的註解拿掉。
-- ════════════════════════════════════════════════════════════

-- ALTER TABLE media DROP COLUMN width;
-- ALTER TABLE media DROP COLUMN height;


-- ════════════════════════════════════════════════════════════
--  不要動的：這些看起來重複，其實各有用途
--  ------------------------------------------------------------
--  ui_strings.zh 與 zh_key —— zh_key 是頁面 data-tw 的對應鍵（永不變），
--    zh 是實際顯示的中文（業務可改）。兩欄都必要（見 v6-8）。
--  settings.phone 與 phone_link —— 一個給人看（02-2712-2211 #8109），
--    一個給 tel: 撥號用（只留數字與逗號）。
--  page_blocks.visible —— 後台的「顯示／隱藏」在用。
--  synonym_suggestions.status/source —— 待審流程與來源標記在用。
-- ════════════════════════════════════════════════════════════

-- 收尾確認
SELECT 'products' AS 表, COUNT(*) AS 欄位數 FROM pragma_table_info('products')
UNION ALL SELECT 'timeline', COUNT(*) FROM pragma_table_info('timeline')
UNION ALL SELECT 'inquiries', COUNT(*) FROM pragma_table_info('inquiries')
UNION ALL SELECT 'synonym_suggestions', COUNT(*) FROM pragma_table_info('synonym_suggestions');
