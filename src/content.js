/* ============================================================
   後台內容套用層 (Content Apply)
   ------------------------------------------------------------
   把後台（admin/）存下來的 content/*.json 套用到頁面上。
   同事在後台改完存檔 → 這支負責讓網頁真的顯示新內容。

   資料來源優先順序：
   1) content/site.json + content/pages.json（線上版，需經 http 開啟）
   2) window.SITE_CONTENT（content/content.js 的備援快照，用檔案直接開也能看）

   兩種套用方式：
   A. 公司資訊（site.json）— 靠頁面上的 data-site / data-site-href 標記
        <div data-site="address">臺北市…</div>
        <a data-site-href="email" href="mailto:…">…</a>
      標記可用值：company_name / address / phone / phone_link / email / copyright
      沒有標記的頁面不會壞，只是不會被套用。

   B. 頁面文字與圖片（pages.json）— 不需要在頁面上加任何標記
      後台的「網頁上原本的字」對到頁面上的文字，「改成」有填才會替換。
      圖片同理，比對檔名。

   使用方式：在各頁面 </body> 前加這兩行（順序不可顛倒）
     <script src="./content/content.js"></script>   ← 備援快照，可省略
     <script src="./src/content.js"></script>
   products/ 底下的頁面路徑改成 ../
   ============================================================ */
(function () {
  var inSub = /\/products\//.test(location.pathname);
  var BASE = inSub ? '../' : './';

  /* ---------- 目前是哪一頁 ---------- */
  function pageId() {
    var m = location.pathname.match(/([a-z0-9-]+)\.html?$/i);
    var name = m ? m[1].toLowerCase() : 'index';
    return name === '' ? 'index' : name;
  }

  /* ---------- A. 公司資訊 ---------- */
  function applySite(site) {
    if (!site) return;

    document.querySelectorAll('[data-site]').forEach(function (el) {
      var key = el.getAttribute('data-site');
      var val = site[key];
      if (val == null || val === '') return;
      el.textContent = val;
    });

    document.querySelectorAll('[data-site-href]').forEach(function (el) {
      var key = el.getAttribute('data-site-href');
      if (key === 'email' && site.email) {
        el.setAttribute('href', 'mailto:' + site.email);
      } else if (key === 'phone' && site.phone_link) {
        el.setAttribute('href', 'tel:' + site.phone_link);
      }
    });
  }

  /* ---------- B. 頁面文字 ---------- */
  function textNodes() {
    var skip = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentNode && skip[node.parentNode.nodeName]) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var out = [], n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function applyTexts(entry) {
    if (!entry || !Array.isArray(entry.texts)) return;

    var map = {};
    entry.texts.forEach(function (t) {
      var from = String(t.from == null ? '' : t.from).trim();
      var to = String(t.to == null ? '' : t.to).trim();
      if (from && to && from !== to) map[from] = to;
    });
    if (!Object.keys(map).length) return;

    /* 語言切換會重寫 innerHTML，所以套用完的字也記在 data-tw 上，切回中文才不會被蓋掉 */
    textNodes().forEach(function (node) {
      var key = node.nodeValue.trim();
      if (!map[key]) return;
      node.nodeValue = node.nodeValue.replace(key, map[key]);
      var host = node.parentElement;
      if (host && host.getAttribute('data-tw') === key) {
        host.setAttribute('data-tw', map[key]);
      }
    });
  }

  /* ---------- B. 頁面圖片 ---------- */
  function fileName(path) {
    return String(path || '').split(/[?#]/)[0].split('/').pop();
  }

  function applyImages(entry) {
    if (!entry || !Array.isArray(entry.images)) return;

    var map = {};
    entry.images.forEach(function (i) {
      var from = fileName(i.from);
      var to = String(i.to == null ? '' : i.to).trim();
      if (from && to) map[from] = to;
    });
    if (!Object.keys(map).length) return;

    function resolve(to) {
      /* 後台存的是 /src/product-img/x.png 這種絕對路徑，換成相對於本頁的路徑 */
      return BASE + to.replace(/^\/+/, '');
    }

    document.querySelectorAll('img[src]').forEach(function (img) {
      var hit = map[fileName(img.getAttribute('src'))];
      if (hit) img.setAttribute('src', resolve(hit));
    });

    /* 寫在 style 屬性裡的背景圖 */
    document.querySelectorAll('[style*="url("]').forEach(function (el) {
      var css = el.getAttribute('style');
      Object.keys(map).forEach(function (from) {
        if (css.indexOf(from) === -1) return;
        css = css.split(from).join(fileName(map[from]));
        el.setAttribute('style', css);
      });
    });
  }

  /* ---------- 套用 ---------- */
  function apply(data) {
    applySite(data.site);

    var pages = (data.pages && data.pages.pages) || [];
    var id = pageId();
    var entry = null;
    pages.forEach(function (p) { if (String(p.id).toLowerCase() === id) entry = p; });
    if (!entry) return;

    applyTexts(entry);
    applyImages(entry);
  }

  /* ---------- 讀資料 ---------- */
  function getJson(path) {
    return fetch(BASE + path, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error(path + ' ' + res.status);
      return res.json();
    });
  }

  function fromSnapshot() {
    var s = window.SITE_CONTENT;
    if (!s) throw new Error('no snapshot');
    return { site: s.site, pages: s.pages };
  }

  function start() {
    Promise.all([getJson('content/site.json'), getJson('content/pages.json')])
      .then(function (r) { return { site: r[0], pages: r[1] }; })
      .catch(function (err) {
        if (window.console) {
          console.info('[content] 改用 content/content.js 的備援快照（' + err.message + '）');
        }
        return fromSnapshot();
      })
      .then(apply)
      .catch(function (err) {
        if (window.console) console.warn('[content] 內容套用失敗：' + err.message);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
