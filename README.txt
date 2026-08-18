臺灣營德官網更新檔（2026-08-18）
================================
請將本資料夾內的檔案，依相同路徑覆蓋到
C:/Users/lyanc/VScodeProgram/inteplast_home_page_tw/

本次變更：
1. 選單連結修正
   - 手套 / 台塑遮蔽防塵膠帶 → products/accessories.html
   - 平裝 / 卷裝耐熱袋 → products/heat-bags.html
   - 夾鏈袋 / 密實袋 / 立體密實袋 / 冷凍袋 → products/sealed-packaging.html
   （原本全部指向 products/foodservice.html，才會跳錯頁）

2. 新增三個分類頁（取代原 foodservice.html 一頁塞三大類）
   - products/heat-bags.html（耐熱袋）
   - products/sealed-packaging.html（密封包裝類）
   - products/accessories.html（其他類：手套、遮蔽防塵膠帶）
   - products/foodservice.html 改為三選一導引頁，舊書籤不會跳錯

3. 產品頁調整
   - 有尺寸的品項改為等比例對比牆（依真實公分換算），移除重複長表格
   - 密實袋、冷凍袋、膠帶、手套補上「勾選詢價」
   - 清潔袋頁「環保清潔袋」版面錯亂修正；環保拉繩清潔袋移至拉繩袋頁
   - 膠帶表格移除「長度換算 Length」欄

4. 詢價籃改為購物車模式
   - 勾選的規格跨頁累積，右下角常駐顯示數量，可清空
   - 按鈕文字改為「填寫詢價資料」
   - 各產品頁首圖的「針對此產品線上詢價」按鈕已移除

5. 資料檔
   - src/data/products.csv、products.json：更新 page_url，移除耐熱袋的
     「嚴選台塑食品級原料 · 絕無塑化劑添加」文案
   - 注意：src/data/products.xlsx 未更新，請自行同步上述兩項

未包含的檔案（未變更）：src/ 內的圖片、navbar.css 等
