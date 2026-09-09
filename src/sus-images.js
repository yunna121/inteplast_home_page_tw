/* 永續發展頁的產品實拍：改讀「產品資料」的圖
   ------------------------------------------------------------
   為什麼不另外做一個地方管：那兩張就是拉繩袋與清潔袋的產品照，
   後台「產品資料」已經在管它們了。再開一個上傳入口，業務就得記住
   「產品照在這裡改、永續頁的圖在那裡改」—— 同一張圖兩個地方是壞設計。

   用法：在 <img> 上加 data-db-img="拉繩袋"（產品名，比對用「包含」），
   本檔會用 GET /api/products 找到那筆，把 src 換成它的圖。

   HTML 裡原本寫的路徑保留當後備：API 掛掉、產品還沒設圖、
   或用 file:// 直接開檔時，畫面照樣有圖，不會破一個灰框。

   圖片路徑三種寫法都吃（與首頁、產品中心同一套規則）：
     /media/x.webp   後台上傳的（存在 D1，走 functions/media/）
     http(s)://…     外部網址
     只寫檔名        先試 src/product-img/，載不到再試 src/
*/
(function () {
  var slots = document.querySelectorAll('img[data-db-img]');
  if (!slots.length) return;

  function pathsOf(raw) {
    var n = String(raw || '').trim();
    if (!n) return [];
    if (/^(https?:)?\/\//.test(n) || n.charAt(0) === '/') return [n];
    if (n.indexOf('/') > -1) return ['./src/' + n];
    return ['./src/product-img/' + n, './src/' + n];
  }

  /* 依序試候選路徑，載得起來才換上去 —— 直接指過去會在載不到時
     把原本好的圖換成破圖 */
  function apply(img, candidates) {
    if (!candidates.length) return;
    var probe = new Image();
    probe.onload = function () { img.src = candidates[0]; };
    probe.onerror = function () { apply(img, candidates.slice(1)); };
    probe.src = candidates[0];
  }

  fetch('/api/products', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      if (!Array.isArray(rows) || !rows.length) return;
      slots.forEach(function (img) {
        var want = img.getAttribute('data-db-img');
        var hit = rows.filter(function (p) {
          return String(p.name || '').indexOf(want) > -1;
        })[0];
        if (!hit) return;
        apply(img, pathsOf(hit.img_home || hit.img));
      });
    })
    .catch(function () { /* 後備＝HTML 裡原本的圖，什麼都不用做 */ });
})();
