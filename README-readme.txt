產品排序功能 — 更新包
====================================

順序：先跑 SQL，再上傳檔案。

1) Cloudflare 後台 → Workers & Pages → D1 → 你的資料庫 → Console
   貼上 db/v12-product-sort.sql 的內容執行。
   （或 npx wrangler d1 execute <DB名稱> --remote --file db/v12-product-sort.sql）

2) 把以下 4 個檔案上傳覆蓋到 GitHub，等 Pages 部署完成：
   admin/index.html
   functions/api/products.js
   functions/api/admin/save.js
   functions/api/admin/data.js

3) 開後台「產品資料」，每列左邊會出現拖曳握把與順序編號（001、002…）。
   按住整列拖曳，放手自動存檔。手機用右側的 ↑ ↓ 按鈕。

改了什麼
--------
- products 表新增 sort_order 欄位
- 前台 /api/products 與後台 /api/admin/data 改為 ORDER BY sort_order, id
- save.js 的 reorder 動作從「只支援頁面區塊」改為也支援產品
- 後台產品清單加入拖曳排序、順序編號、上下移動鈕

注意
----
- 首頁與產品中心的卡片編號（001、002…）與篩選鈕順序會跟著這個順序跑。
  想讓某個產品永遠排第一，就把它拖到最上面。
- 搜尋框有輸入文字時不能拖曳（看不到全貌，拖出來的順序會錯），
  清空搜尋才會出現握把。
- 備份指令：npx wrangler d1 export <DB名稱> --remote --output backup.sql
