-- 檢查：還有沒有指向已刪除的 src/product-img/ 的裸檔名
-- ============================================================
-- 圖片欄位現在應該都是 /media/xxx（後台上傳）或完整網址。
-- 只寫檔名的舊資料會指向 src/product-img/，那個資料夾已經不存在，
-- 所以那些圖現在是破的。
--
-- 貼進 D1 Console 按 Execute
-- ============================================================

SELECT 'products.img'      AS 欄位, id, name AS 資料, img      AS 值 FROM products WHERE img      <> '' AND img      NOT LIKE '/%' AND img      NOT LIKE 'http%'
UNION ALL
SELECT 'products.img_home', id, name, img_home FROM products WHERE img_home <> '' AND img_home NOT LIKE '/%' AND img_home NOT LIKE 'http%'
UNION ALL
SELECT 'products.patent',   id, name, patent   FROM products WHERE patent   <> '' AND patent   NOT LIKE '/%' AND patent   NOT LIKE 'http%'
UNION ALL
SELECT 'page_blocks.image', id, title, image   FROM page_blocks WHERE image <> '' AND image NOT LIKE '/%' AND image NOT LIKE 'http%'
UNION ALL
SELECT 'site_images.path',  id, key,  path     FROM site_images WHERE path  <> '' AND path  NOT LIKE '/%' AND path  NOT LIKE 'http%';

-- 沒有任何列 = 全部都是 /media/ 或網址，程式碼裡的後備路徑是死碼，刪掉即可。
-- 有列出來 = 那幾張圖現在破的，要到後台重新上傳。
