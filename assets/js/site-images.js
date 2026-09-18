/* 網站圖片：把頁面上的圖換成後台設定的那張
   ------------------------------------------------------------
   資料來自 D1 的 site_images 表（GET /api/site-images），
   由後台的「網站圖片」頁維護。

   兩種掛法：

   1) <img data-site-img="eco_certificate" src="./assets/img/opt/combine.jpg">
      直接換 src。HTML 裡原本的路徑是後備 —— API 掛掉、還沒設定、
      或用 file:// 直接開檔時，畫面照樣有圖。

   2) <img data-product-img="Scale Sheet::patent" src="./assets/img/scale-sheet-patent.jpg">
      讀「產品資料」裡那筆產品的指定欄位（產品名::欄位名，產品名用「包含」比對）。
      用於「同一張圖在兩頁出現」的情況：專利証書在產品中心與關於營德都有，
      讀同一個欄位，後台上傳一次兩邊一起更新，不會發生「改了一邊忘了另一邊」。

   3) <section class="story-hero" data-site-bg="about_hero">
      背景圖（含 ::before 這種偽元素）不能直接改 src，所以改設
      CSS 變數 --site-img，CSS 那邊寫成
        background: var(--site-img, url("./assets/img/原本那張.jpeg")) …
      偽元素會繼承父層的自訂屬性，所以掛在區塊本身就夠。

   4) <a data-site-file="cert_drawtape_pdf" href="https://原本的外部連結">
      文件（PDF）連結。後台欄位有值就改指到那份檔，留空就沒動 ——
      所以 HTML 裡原本的網址仍然是後備。

   載不到新圖時不換 —— 先用 Image() 試載，成功才指過去，
   否則會把原本好的圖換成破圖框。 */
(function () {
  var imgSlots = document.querySelectorAll('img[data-site-img]');
  var bgSlots = document.querySelectorAll('[data-site-bg]');
  var productSlots = document.querySelectorAll('img[data-product-img]');
  var fileSlots = document.querySelectorAll('[data-site-file]');
  if (!imgSlots.length && !bgSlots.length && !productSlots.length && !fileSlots.length) return;

  // products/ 子目錄的頁面要往上一層找 assets/img/
  var root = /\/products\//.test(location.pathname) ? '../' : './';

  /* 舊資料相容：site_images 裡還有 src/… 開頭的路徑（檔案已搬到 assets/img/） */
  function unSrc(p) {
    return String(p || '').replace(/^\.?\/?src\//, 'assets/img/');
  }

  function urlOf(raw) {
    var p = unSrc(String(raw || '').trim());
    if (!p) return '';
    if (/^(https?:)?\/\//.test(p) || p.charAt(0) === '/') return p;
    return root + p.replace(/^\.\//, '');
  }

  function whenLoaded(url, ok) {
    var probe = new Image();
    probe.onload = function () { ok(); };
    probe.src = url;
  }

  fetch('/api/site-images', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (map) {
      if (!map || typeof map !== 'object') return;

      imgSlots.forEach(function (img) {
        var url = urlOf(map[img.getAttribute('data-site-img')]);
        if (!url || img.getAttribute('src') === url) return;
        whenLoaded(url, function () { img.src = url; });
      });

      bgSlots.forEach(function (box) {
        var url = urlOf(map[box.getAttribute('data-site-bg')]);
        if (!url) return;
        whenLoaded(url, function () {
          box.style.setProperty('--site-img', 'url("' + url + '")');
        });
      });

      /* 文件連結：不先試載（PDF 沒辦法用 Image() 探測）。
         欄位留空就不動，頁面上原本的網址維持有效。 */
      fileSlots.forEach(function (node) {
        var url = urlOf(map[node.getAttribute('data-site-file')]);
        if (url) node.setAttribute('href', url);
      });
    })
    .catch(function () { /* 後備＝HTML 裡原本的圖，什麼都不用做 */ });

  /* 讀產品欄位的那些圖（data-product-img="產品名::欄位"）。
     裪欄名沒寫時預設拿 img_home，它空的話退回 img。 */
  if (productSlots.length) {
    fetch('/api/products', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows.length) return;
        productSlots.forEach(function (img) {
          var spec = String(img.getAttribute('data-product-img') || '').split('::');
          var want = (spec[0] || '').trim();
          var field = (spec[1] || 'img_home').trim();
          if (!want) return;

          var hit = rows.filter(function (row) {
            return String(row.name || '').indexOf(want) > -1;
          })[0];
          if (!hit) return;

          var value = unSrc(String(hit[field] || '').trim());
          if (!value && field === 'img_home') value = String(hit.img || '').trim();
          if (!value) return;

          /* 裸檔名是舊資料：先試 /media/（後台上傳的都在那），
             載不到再試 assets/img/ 根目錄。assets/img/product-img/ 已刪除。 */
          var candidates;
          if (/^(https?:)?\/\//.test(value) || value.charAt(0) === '/') candidates = [value];
          else if (value.indexOf('/') > -1) candidates = [root + value.replace(/^\.\//, '')];
          else candidates = ['/media/' + encodeURIComponent(value), root + 'assets/img/' + value];

          (function next(list) {
            if (!list.length) return;
            var probe = new Image();
            probe.onload = function () { img.src = list[0]; };
            probe.onerror = function () { next(list.slice(1)); };
            probe.src = list[0];
          })(candidates);
        });
      })
      .catch(function () { /* 後備＝HTML 裡原本的圖 */ });
  }
})();
