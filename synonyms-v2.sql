-- 同義詞改為掛在產品上（重建 synonyms 表）
-- ============================================================
-- 舊版是 (say, mean)：mean 是人手打的對應詞，跟 products 沒有關聯，
-- 而且編輯頁只能列出一張沒有分類的長清單。
--
-- 新版是 (product_id, say)：一列＝一個別名掛在一個產品上。
--   - 產品改名時同義詞不會失效（目標是 id，不是字面）
--   - 編輯頁可按產品分組：清潔袋底下就是它自己的 10 個別名
--   - 命中後注入的是該產品自己的品名，不可能打錯字
--
-- 同一個別名可以掛給多個產品（塑膠袋 → 清潔袋、蔬果袋），寫成兩列。
--
-- 執行：npx wrangler d1 execute <你的資料庫名> --remote --file=synonyms-v2.sql
-- （或整份貼進 Cloudflare D1 Console）
-- ============================================================

-- 舊表建立不到一小時、且還沒有人編輯過，直接重建
DROP TABLE IF EXISTS synonyms;

CREATE TABLE synonyms (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  say        TEXT NOT NULL,
  UNIQUE (product_id, say)
);

-- 依產品分組查詢會用到（別名數量不大，但編輯頁會很常照 product_id 取）
CREATE INDEX IF NOT EXISTS idx_synonyms_product ON synonyms (product_id);

-- ============================================================
-- 資料：用品名比對取得 product_id，不寫死 id
-- （所以不必先查你的 products 是 1~7 還是別的編號）
-- ============================================================

-- 清潔袋（10 個別名）
INSERT INTO synonyms (product_id, say) SELECT id, '垃圾袋' FROM products WHERE name LIKE '%清潔袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '垃圾桶袋' FROM products WHERE name LIKE '%清潔袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '廚餘袋' FROM products WHERE name LIKE '%清潔袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '大型垃圾袋' FROM products WHERE name LIKE '%清潔袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '環保袋' FROM products WHERE name LIKE '%清潔袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '塑膠袋' FROM products WHERE name LIKE '%清潔袋%';
INSERT INTO synonyms (product_id, say) SELECT id, 'trash bag' FROM products WHERE name LIKE '%清潔袋%';
INSERT INTO synonyms (product_id, say) SELECT id, 'garbage bag' FROM products WHERE name LIKE '%清潔袋%';
INSERT INTO synonyms (product_id, say) SELECT id, 'bin liner' FROM products WHERE name LIKE '%清潔袋%';
INSERT INTO synonyms (product_id, say) SELECT id, 'can liner' FROM products WHERE name LIKE '%清潔袋%';

-- 拉繩袋（5 個別名）
INSERT INTO synonyms (product_id, say) SELECT id, '束口袋' FROM products WHERE name LIKE '%拉繩袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '抽繩袋' FROM products WHERE name LIKE '%拉繩袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '穿繩袋' FROM products WHERE name LIKE '%拉繩袋%';
INSERT INTO synonyms (product_id, say) SELECT id, 'drawstring' FROM products WHERE name LIKE '%拉繩袋%';
INSERT INTO synonyms (product_id, say) SELECT id, 'draw tape' FROM products WHERE name LIKE '%拉繩袋%';

-- 夾鏈袋（10 個別名）
INSERT INTO synonyms (product_id, say) SELECT id, '密封袋' FROM products WHERE name LIKE '%夾鏈袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '封口袋' FROM products WHERE name LIKE '%夾鏈袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '拉鍊袋' FROM products WHERE name LIKE '%夾鏈袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '自封袋' FROM products WHERE name LIKE '%夾鏈袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '收納袋' FROM products WHERE name LIKE '%夾鏈袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '保鮮袋' FROM products WHERE name LIKE '%夾鏈袋%';
INSERT INTO synonyms (product_id, say) SELECT id, 'ziplock' FROM products WHERE name LIKE '%夾鏈袋%';
INSERT INTO synonyms (product_id, say) SELECT id, 'zip lock' FROM products WHERE name LIKE '%夾鏈袋%';
INSERT INTO synonyms (product_id, say) SELECT id, 'zipper' FROM products WHERE name LIKE '%夾鏈袋%';
INSERT INTO synonyms (product_id, say) SELECT id, 'freezer' FROM products WHERE name LIKE '%夾鏈袋%';

-- 蔬果袋（7 個別名）
INSERT INTO synonyms (product_id, say) SELECT id, '市場袋' FROM products WHERE name LIKE '%蔬果袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '生鮮袋' FROM products WHERE name LIKE '%蔬果袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '食物袋' FROM products WHERE name LIKE '%蔬果袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '手扒雞袋' FROM products WHERE name LIKE '%蔬果袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '微波袋' FROM products WHERE name LIKE '%蔬果袋%';
INSERT INTO synonyms (product_id, say) SELECT id, '塑膠袋' FROM products WHERE name LIKE '%蔬果袋%';
INSERT INTO synonyms (product_id, say) SELECT id, 'produce' FROM products WHERE name LIKE '%蔬果袋%';

-- 多功能手套（4 個別名）
INSERT INTO synonyms (product_id, say) SELECT id, '塑膠手套' FROM products WHERE name LIKE '%手套%';
INSERT INTO synonyms (product_id, say) SELECT id, '拋棄式手套' FROM products WHERE name LIKE '%手套%';
INSERT INTO synonyms (product_id, say) SELECT id, '一次性手套' FROM products WHERE name LIKE '%手套%';
INSERT INTO synonyms (product_id, say) SELECT id, 'glove' FROM products WHERE name LIKE '%手套%';

-- 遮蔽防塵膠帶（7 個別名）
INSERT INTO synonyms (product_id, say) SELECT id, '養生膠帶' FROM products WHERE name LIKE '%膠帶%';
INSERT INTO synonyms (product_id, say) SELECT id, '防塵膜' FROM products WHERE name LIKE '%膠帶%';
INSERT INTO synonyms (product_id, say) SELECT id, '遮蔽膠帶' FROM products WHERE name LIKE '%膠帶%';
INSERT INTO synonyms (product_id, say) SELECT id, '油漆膠帶' FROM products WHERE name LIKE '%膠帶%';
INSERT INTO synonyms (product_id, say) SELECT id, '裝潢膠帶' FROM products WHERE name LIKE '%膠帶%';
INSERT INTO synonyms (product_id, say) SELECT id, 'masking' FROM products WHERE name LIKE '%膠帶%';
INSERT INTO synonyms (product_id, say) SELECT id, 'tape' FROM products WHERE name LIKE '%膠帶%';

-- Scale Sheet（3 個別名）
INSERT INTO synonyms (product_id, say) SELECT id, '秤重紙' FROM products WHERE name LIKE '%Scale Sheet%';
INSERT INTO synonyms (product_id, say) SELECT id, '墊紙' FROM products WHERE name LIKE '%Scale Sheet%';
INSERT INTO synonyms (product_id, say) SELECT id, '包裝紙' FROM products WHERE name LIKE '%Scale Sheet%';

-- ============================================================
-- 確認
-- ============================================================
-- 應該是 46 列
SELECT COUNT(*) AS 別名總數 FROM synonyms;

-- 每個產品各有幾個別名（若某個產品是 0，表示上面的品名比對沒對上）
SELECT p.id, p.name, COUNT(s.id) AS 別名數
  FROM products p LEFT JOIN synonyms s ON s.product_id = p.id
 GROUP BY p.id, p.name
 ORDER BY p.id;

-- 逐列看
SELECT s.id, p.name AS 產品, s.say AS 別名
  FROM synonyms s JOIN products p ON p.id = s.product_id
 ORDER BY s.product_id, s.say;
