/* ============================================================
   公司資訊套用層（Cloudflare D1）
   ------------------------------------------------------------
   把 /api/settings 的內容套到頁面上有 data-site 標記的元素：

     <span data-site="address">…</span>
     <a data-site-href="email" href="mailto:…">…</a>
     <a data-site-href="phone" href="tel:…">…</a>

   可用的 key：company_name / address / phone / phone_link /
             email / email_cc / copyright

   多語言：API 會同時回傳 address 與 address_en（以及日後新增的
   address_ja…）。這裡把各語言寫進 data-tw / data-en 等屬性，
   再交給 src/site-lang.js 依當前語言顯示 —— 所以切語言時
   公司資訊也會跟著換。

   本檔由 src/navbar.js 注入，五個頁面都不必改 <head> 或 <body>。
   （原本這件事由 src/content.js 做，資料來自 content/site.json；
     JSON 後台已移除，資料改存 D1。）
   ============================================================ */
(function () {
  var LANG_ATTR = { 'zh-tw': 'data-tw', 'en': 'data-en' };

  /** 語言代碼 → 頁面上用的屬性名（zh-TW → data-tw、ja → data-ja） */
  function attrFor(code) {
    var key = String(code || '').toLowerCase();
    return LANG_ATTR[key] || ('data-' + key.replace(/-/g, '-'));
  }

  /* 頁尾的服務時間
     ------------------------------------------------------------
     五個頁面的 <footer> 結構各不相同（有的是 flex 排版、有的只是
     一行文字），所以不在 HTML 裡各寫一次 —— 統一在這裡插到
     footer 最前面，五頁一致，之後改版型也只改這一處。
     頁面上已經有這個欄位的（聯繫我們的資訊卡）不受影響。 */
  function ensureFooterLine(hasValue) {
    if (!hasValue) return;
    var footer = document.querySelector('footer');
    if (!footer) return;
    if (footer.querySelector('[data-site="office_hours"]')) return;

    var line = document.createElement('div');
    line.setAttribute('data-site', 'office_hours');
    line.style.cssText = 'text-align:center; font-size:.88em; opacity:.75; margin-bottom:14px;';
    footer.insertBefore(line, footer.firstChild);
  }

  function apply(settings) {
    if (!settings || typeof settings !== 'object') return;

    /* settings 是扁平的：{ address: '台北…', address_en: '6F…' }
       先整理成 { address: { 'zh-TW': '台北…', en: '6F…' } } */
    var byKey = {};
    Object.keys(settings).forEach(function (raw) {
      var m = raw.match(/^(.+?)_([a-z]{2}(?:_[a-z]{2})?)$/);
      if (m && Object.prototype.hasOwnProperty.call(settings, m[1])) {
        byKey[m[1]] = byKey[m[1]] || {};
        byKey[m[1]][m[2].replace(/_/g, '-')] = settings[raw];
      } else {
        byKey[raw] = byKey[raw] || {};
        byKey[raw]['zh-TW'] = settings[raw];
      }
    });

    ensureFooterLine(!!String(settings.office_hours || '').trim());

    document.querySelectorAll('[data-site]').forEach(function (node) {
      var key = node.getAttribute('data-site');
      var bag = byKey[key];
      if (!bag) return;

      var base = bag['zh-TW'];
      if (base == null || base === '') return;

      Object.keys(bag).forEach(function (code) {
        var value = bag[code];
        if (value == null || value === '') return;
        node.setAttribute(attrFor(code), value);
      });
      /* 沒有翻譯的語言就沿用繁中，免得切語言時變空白 */
      if (!node.getAttribute('data-en')) node.setAttribute('data-en', base);

      node.textContent = base;
    });

    document.querySelectorAll('[data-site-href]').forEach(function (node) {
      var key = node.getAttribute('data-site-href');
      if (key === 'email' && settings.email) {
        node.setAttribute('href', 'mailto:' + settings.email);
      } else if (key === 'phone' && settings.phone_link) {
        node.setAttribute('href', 'tel:' + settings.phone_link);
      }
    });

    /* 語言切換是掃描 DOM 的，套用完再叫一次才會顯示正確語言 */
    if (typeof window.applyLanguage === 'function') window.applyLanguage();
  }

  function start() {
    fetch('/api/settings', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('API 狀態錯誤: ' + res.status);
        return res.json();
      })
      .then(apply)
      .catch(function (err) {
        /* 拿不到就沿用頁面上原本寫的值 —— 不影響瀏覽 */
        if (window.console) console.info('[site-info] 沿用頁面預設值（' + err.message + '）');
      });
  }

  /* 頁尾是 src/footer.js 注入的，等 DOM 齊全再套用 */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.applySiteInfo = start;
})();
