/* ============================================================
   中文與數字／英文之間的空白 → 不斷行空白 (U+00A0)
   ------------------------------------------------------------
   responsive.css 的 word-break: keep-all 只擋漢字之間的斷點，
   ASCII 半形空白仍然是合法斷點，所以會出現：

       容量大升級增加
       30%、乾淨不沾手

   中文排版裡「增加 30%」的空白是視覺間距，不是斷句處。
   這支腳本把這類空白換成 U+00A0（寬度一樣，但不可斷），
   斷行就會退回前面的「，」：

       一拉即可束口，減少蚊蠅孳生，
       容量大升級增加 30%、乾淨不沾手

   用法：放在 </body> 前，任何會寫入文字的腳本（site-lang.js、
   產品列渲染）之後載入即可；它也會監看後續的 DOM 變動。
   ============================================================ */
(function () {
  'use strict';

  var CJK = '\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF';
  // 中文後接 空白 + 數字/英文   例：增加 30%
  var AFTER = new RegExp('([' + CJK + '])[ \\t]+(?=[0-9A-Za-z])', 'g');
  // 數字/英文後接 空白 + 中文   例：ISO 9001 認證
  var BEFORE = new RegExp('([0-9A-Za-z%）\\)])[ \\t]+(?=[' + CJK + '])', 'g');

  /* 只處理需要排得好看的短文字；長段落不動，避免整段變成一個不可斷的字串 */
  var SELECTOR = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    '.ps-title', '.ps-highlight', '.ps-lede', '.ps-alias', '.ps-chip',
    '.hero-title', '.hero-desc', '.hero-sub-tagline',
    '.card-main-title', '.card-highlight-text',
    '.stat-label', '.stat-sub', '.stat-num',
    '.cta-banner-title', '.cta-banner-desc',
    '.concertina-title', '.concertina-sub',
    '.scenario-title', '.scenario-desc',
    '.section-head p', '.gm-features strong', '.gm-features span',
    '.mio-check-item', '.node-name', '.node-label', '.timeline-copy h3',
    '.cat-spec-title', '.scale-ramp-title', '.edm-size-pill'
  ].join(',');

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };

  function fixNode(text) {
    var v = text.nodeValue;
    if (v.indexOf(' ') === -1 && v.indexOf('\t') === -1) return;
    var out = v.replace(AFTER, '$1\u00A0').replace(BEFORE, '$1\u00A0');
    if (out !== v) text.nodeValue = out;
  }

  function fixEl(el) {
    if (!el || el.nodeType !== 1) return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return SKIP[n.parentNode && n.parentNode.nodeName]
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) fixNode(n);
  }

  function run(root) {
    var scope = root && root.nodeType === 1 ? root : document.body;
    if (!scope) return;
    if (scope.matches && scope.matches(SELECTOR)) fixEl(scope);
    var list = scope.querySelectorAll ? scope.querySelectorAll(SELECTOR) : [];
    for (var i = 0; i < list.length; i++) fixEl(list[i]);
  }

  function start() {
    run(document.body);

    /* 產品列、語言切換、搜尋結果都是後來才寫進 DOM 的，要持續補上。
       用 requestAnimationFrame 收斂，避免每個 mutation 都跑一次全樹。 */
    var pending = null;
    new MutationObserver(function (records) {
      var roots = [];
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === 'characterData') {
          if (r.target.parentNode) roots.push(r.target.parentNode);
        } else {
          for (var j = 0; j < r.addedNodes.length; j++) {
            if (r.addedNodes[j].nodeType === 1) roots.push(r.addedNodes[j]);
            else if (r.addedNodes[j].nodeType === 3 && r.target.nodeType === 1) roots.push(r.target);
          }
        }
      }
      if (!roots.length) return;
      if (pending) cancelAnimationFrame(pending);
      pending = requestAnimationFrame(function () {
        pending = null;
        for (var k = 0; k < roots.length; k++) run(roots[k]);
      });
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
