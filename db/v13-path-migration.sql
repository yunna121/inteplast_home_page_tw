-- 把資料庫裡還指著舊 src/ 的圖片路徑改到 assets/img/
-- ------------------------------------------------------------
-- 檔案已經搬到 assets/img/，但 D1 裡存的路徑還是 src/…，
-- 所以後台設過的圖（永續頁 hero、環保標章證書…）全部 404。
--
-- 程式端我已經加了相容處理，不跑這段也會正常顯示；
-- 跑完可以讓資料庫本身也乾淨，之後接手的人不會困惑。
--
-- 執行位置：Cloudflare → Workers & Pages → D1 → 你的資料庫 → Console

UPDATE site_images
   SET path = 'assets/img/' || substr(path, 5)
 WHERE path LIKE 'src/%';

UPDATE products
   SET img = 'assets/img/' || substr(img, 5)
 WHERE img LIKE 'src/%';

UPDATE products
   SET img_home = 'assets/img/' || substr(img_home, 5)
 WHERE img_home LIKE 'src/%';

UPDATE products
   SET patent = 'assets/img/' || substr(patent, 5)
 WHERE patent LIKE 'src/%';

-- 跑完確認一下還有沒有殘留：
-- SELECT key, path FROM site_images WHERE path LIKE '%src/%';
