/* 網站圖片：把頁面上的圖換成後台設定的那張
   ------------------------------------------------------------
   資料來自 D1 的 site_images 表（GET /api/site-images），
   由後台的「網站圖片」頁維護。

   兩種掛法：

   1) <img data-site-img="eco_certificate" src="./src/opt/combine.jpg">
      直接換 src。HTML 裡原本的路徑是後備 —— API 掛掉、還沒設定、
      或用 file:// 直接開檔時，畫面照樣有圖。

   2) <section class="story-hero" data-site-bg="about_hero">
      背景圖（含 ::before 這種偽元素）不能直接改 src，所以改設
      CSS 變數 --site-img，CSS 那邊寫成
        background: var(--site-img, url("./src/原本那張.jpeg")) …
      偽元素會繼承父層的自訂屬性，所以掛在區塊本身就夠。

   載不到新圖時不換 —— 先用 Image() 試載，成功才指過去，
   否則會把原本好的圖換成破圖框。 */
(function () {
  var imgSlots = document.querySelectorAll('img[data-site-img]');
  var bgSlots = document.querySelectorAll('[data-site-bg]');
  if (!imgSlots.length && !bgSlots.length) return;

  // products/ 子目錄的頁面要往上一層找 src/
  var root = /\/products\//.test(location.pathname) ? '../' : './';

  function urlOf(raw) {
    var p = String(raw || '').trim();
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
    })
    .catch(function () { /* 後備＝HTML 裡原本的圖，什麼都不用做 */ });
})();
