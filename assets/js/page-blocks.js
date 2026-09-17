/* 頁面區塊 — 前端渲染
   ------------------------------------------------------------
   把 /api/blocks?page=xxx 的內容畫進頁面上的 <div data-blocks="about">。

   版型只有四種，樣式寫在這裡由程式碼決定 —— 業務只填內容與排順序，
   所以版面壞不掉。要新增版型是改這支，不是開放自由編輯。

   多語言：每個文字都掛 data-tw（中文原文），其他語言由
   src/site-lang.js 依 /api/ui-strings 查表替換。這裡另外把
   API 帶回來的 title_en / title_ja 直接寫成 data-en / data-ja，
   兩條路都通，先到先套。
*/
(function () {
  var LAYOUTS = ['image-right', 'image-left', 'full-image', 'text', 'quote'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 把某欄位的各語言版本組成 data-tw / data-en / data-ja 屬性字串 */
  function langAttrs(row, field) {
    var zh = row[field];
    if (!zh) return '';
    var out = ' data-tw="' + esc(zh) + '"';
    Object.keys(row).forEach(function (k) {
      if (k.indexOf(field + '_') !== 0) return;
      var suffix = k.slice(field.length + 1);
      if (!suffix || !row[k]) return;
      out += ' data-' + suffix.replace(/_/g, '-') + '="' + esc(row[k]) + '"';
    });
    return out;
  }

  function imageSrc(value, root) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(https?:)?\/\//.test(raw) || raw.charAt(0) === '/') return raw;
    // 裸檔名是舊資料；後台上傳的圖都是 /media/…（src/product-img/ 已刪除）
    return '/media/' + encodeURIComponent(raw);
  }

  function styles() {
    return [
      '.pb-section{padding:clamp(56px,8vw,110px) 0;}',
      '.pb-section+.pb-section{padding-top:0;}',
      '.pb-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(28px,5vw,72px);align-items:center;}',
      '.pb-grid.is-left .pb-media{order:-1;}',
      '.pb-media img{display:block;width:100%;height:auto;border-radius:14px;}',
      '.pb-caption{margin-top:10px;font-size:.82rem;color:#5f7182;}',
      '.pb-eyebrow{display:block;margin-bottom:12px;font-size:.78rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#0877ba;}',
      '.pb-title{margin:0 0 16px;font-size:clamp(1.5rem,3vw,2.3rem);line-height:1.25;letter-spacing:-.02em;color:#0b2338;}',
      '.pb-body{margin:0;font-size:1rem;line-height:1.95;color:#42566a;white-space:pre-line;}',
      '.pb-full{position:relative;border-radius:16px;overflow:hidden;}',
      '.pb-full img{display:block;width:100%;height:auto;}',
      '.pb-full-copy{position:absolute;left:0;right:0;bottom:0;padding:clamp(24px,4vw,56px);',
      'background:linear-gradient(to top,rgba(6,28,48,.86),rgba(6,28,48,0));color:#fff;}',
      '.pb-full-copy .pb-title,.pb-full-copy .pb-body{color:#fff;}',
      '.pb-full-copy .pb-eyebrow{color:#9fd3f2;}',
      '.pb-text{max-width:780px;}',
      '.pb-quote{max-width:900px;margin:0 auto;padding:clamp(28px,4vw,52px);text-align:center;',
      'background:#f4f7fa;border-radius:16px;}',
      '.pb-quote .pb-title{font-size:clamp(1.6rem,3.4vw,2.6rem);margin-bottom:12px;}',
      '.pb-quote .pb-body{font-size:1.05rem;}',
      '@media(max-width:820px){.pb-grid{grid-template-columns:1fr;}.pb-grid.is-left .pb-media{order:0;}}'
    ].join('');
  }

  function blockHtml(row, root) {
    var layout = LAYOUTS.indexOf(row.layout) > -1 ? row.layout : 'image-right';
    var src = imageSrc(row.image, root);

    var eyebrow = row.eyebrow
      ? '<span class="pb-eyebrow"' + langAttrs(row, 'eyebrow') + '>' + esc(row.eyebrow) + '</span>' : '';
    var title = row.title
      ? '<h2 class="pb-title"' + langAttrs(row, 'title') + '>' + esc(row.title) + '</h2>' : '';
    var body = row.body
      ? '<p class="pb-body"' + langAttrs(row, 'body') + '>' + esc(row.body) + '</p>' : '';
    var caption = row.caption
      ? '<figcaption class="pb-caption"' + langAttrs(row, 'caption') + '>' + esc(row.caption) + '</figcaption>' : '';
    var copy = eyebrow + title + body;

    if (layout === 'text') {
      return '<section class="pb-section"><div class="container"><div class="pb-text reveal">' + copy + '</div></div></section>';
    }

    if (layout === 'quote') {
      return '<section class="pb-section"><div class="container"><div class="pb-quote reveal">' + copy + '</div></div></section>';
    }

    if (layout === 'full-image') {
      if (!src) return '<section class="pb-section"><div class="container"><div class="pb-text reveal">' + copy + '</div></div></section>';
      return '<section class="pb-section"><div class="container"><figure class="pb-full reveal">' +
        '<img src="' + esc(src) + '" alt="' + esc(row.title || '') + '" loading="lazy">' +
        (copy ? '<div class="pb-full-copy">' + copy + '</div>' : '') +
        '</figure>' + (caption ? '<div class="pb-caption">' + esc(row.caption) + '</div>' : '') + '</div></section>';
    }

    // 圖文並排：沒有圖就退化成純文字，不要留一個空格子
    if (!src) {
      return '<section class="pb-section"><div class="container"><div class="pb-text reveal">' + copy + '</div></div></section>';
    }

    return '<section class="pb-section"><div class="container">' +
      '<div class="pb-grid reveal' + (layout === 'image-left' ? ' is-left' : '') + '">' +
      '<figure class="pb-media"><img src="' + esc(src) + '" alt="' + esc(row.title || '') + '" loading="lazy">' + caption + '</figure>' +
      '<div class="pb-copy">' + copy + '</div>' +
      '</div></div></section>';
  }

  function render(host, rows, root) {
    if (!rows.length) { host.innerHTML = ''; return; }
    host.innerHTML = rows.map(function (r) { return blockHtml(r, root); }).join('');

    // 語言是掃描 DOM 的，插入後要再叫一次
    if (typeof window.applyLanguage === 'function') window.applyLanguage();

    /* 進場動畫：頁面自己的 IntersectionObserver 在載入時就掃描完了，
       之後插入的元素不會被觀察到 —— 不自己接一個的話，這些區塊會
       永遠停在 opacity:0（看起來像一大塊空白）。 */
    var targets = host.querySelectorAll('.reveal');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('visible');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });

    targets.forEach(function (el) { io.observe(el); });
  }

  function start() {
    var hosts = document.querySelectorAll('[data-blocks]');
    if (!hosts.length) return;

    if (!document.getElementById('pb-style')) {
      var st = document.createElement('style');
      st.id = 'pb-style';
      st.textContent = styles();
      document.head.appendChild(st);
    }

    hosts.forEach(function (host) {
      var page = host.getAttribute('data-blocks');
      var root = host.getAttribute('data-root') || './';
      fetch('/api/blocks?page=' + encodeURIComponent(page), { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) { render(host, Array.isArray(rows) ? rows : [], root); })
        .catch(function () { /* 拿不到就不顯示額外區塊，頁面其餘照常 */ });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
