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

  /* ------------------------------------------------------------
     專有名詞不拆行（Keep brand phrases on one line）
     ------------------------------------------------------------
     英文版標題會出現：

         Professional Manufacturer of Formosa
         Plastics-Branded Plastic Bags

     「Formosa Plastics」是一個品牌名，中間的空白不是斷句處。
     這裡不寫死「在哪裡換行」，而是宣告「哪些詞不可拆」——
     詞內空白換成 U+00A0，瀏覽器就會自己把整個品牌名推到下一行，
     任何螢幕寬度、任何語系、之後新增的文字都一樣適用。

     維護時只改下面這份清單。 */
  var KEEP_PHRASES = [
    'Formosa Plastics',
    'INTEPLAST TAIWAN',
    'INTEPLAST USA',
    'Chang Gung Biotechnology',
    'Chang Gung',
    'Scale Sheet',
    'Scale Sheets',
    'Tare Sheet',
    'ISO 9001',
    'Green Mark'
  ];

  /* 依長度排序，先鎖長詞（Chang Gung Biotechnology 要贏過 Chang Gung） */
  var PHRASE_RES = KEEP_PHRASES
    .slice()
    .sort(function (a, b) { return b.length - a.length; })
    .map(function (p) {
      return new RegExp(
        p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[ \\t\\u00A0]+'),
        'gi'
      );
    });

  function keepPhrases(v) {
    for (var i = 0; i < PHRASE_RES.length; i++) {
      v = v.replace(PHRASE_RES[i], function (m) {
        return m.replace(/[ \t]+/g, '\u00A0');
      });
    }
    return v;
  }

  var CJK = '\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF';
  // 中文後接 空白 + 數字/英文   例：增加 30%
  var AFTER = new RegExp('([' + CJK + '])[ \\t]+(?=[0-9A-Za-z])', 'g');
  // 數字/英文後接 空白 + 中文   例：ISO 9001 認證
  var BEFORE = new RegExp('([0-9A-Za-z%）\\)])[ \\t]+(?=[' + CJK + '])', 'g');

  /* 只處理需要排得好看的短文字；長段落不動，避免整段變成一個不可斷的字串 */
  var SELECTOR = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    '.ps-title', '.ps-highlight', '.ps-lede', '.ps-alias', '.ps-chip',
    '.hero-title', '.hero-big-title', '.hero-desc', '.hero-sub-tagline',
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

  /* ------------------------------------------------------------
     短號字不留在行尾（只用於內文段落）
     ------------------------------------------------------------
     英文版內文會出現：

         … at facilities in Taiwan and
         Vietnam. Our product portfolio …

     「and」留在行尾、它帶的名詞掉到下一行，讀起來就是断句。
     這是排版惯例（不讓介系詞、連接詞孤立在行尾），
     同樣不指定任何固定換行位置 —— 只是把這類詞跟後面那個字綁在一起。

     標題不套這條：標題字很大，綁在一起反而會多擠出一行。 */
  var TIE = /\b(a|an|and|the|of|in|on|at|to|or|by|for|as|is|are|its|our|with|from|into)[ \t]+(?=[0-9A-Za-z“"'(])/gi;

  /* 只有這些「一整段內文」額外套上面那條規則。
     .ps-highlight / .card-highlight-text 是重點句（兩三行），
     一樣會出現「with」「of」留在行尾的情況，所以一併納入。 */
  var BODY_SELECTOR = [
    '.hero-sub-tagline', '.hero-desc', '.ps-lede', '.ps-desc',
    '.ps-highlight', '.card-highlight-text', '.card-desc-text',
    '.section-head p', '.cta-banner-desc', '.scenario-desc',
    '.intro-p', '.stat-sub', '.gm-features span', '.timeline-copy p'
  ].join(',');

  function fixNode(text, tie) {
    var v = text.nodeValue;
    var out = fixText(v, tie);
    if (out !== v) text.nodeValue = out;
  }

  /* 供其他腳本在「寫進 DOM 之前」先過一次（見 site-lang.js）。
     這比事後追著改可靠：site-lang 會整段覆寫 innerHTML，
     由它先處理好就不會有先錯一下再跳回來的閃動。 */
  function fixText(v, tie) {
    if (!v) return v;
    if (v.indexOf(' ') === -1 && v.indexOf('\t') === -1) return v;
    var out = keepPhrases(v).replace(AFTER, '$1\u00A0').replace(BEFORE, '$1\u00A0');
    if (tie) out = out.replace(TIE, '$1\u00A0');
    return out;
  }

  function fixEl(el, tie) {
    if (!el || el.nodeType !== 1) return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return SKIP[n.parentNode && n.parentNode.nodeName]
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) fixNode(n, tie);
  }

  function isBody(el) {
    return !!(el.matches && el.matches(BODY_SELECTOR));
  }

  function run(root) {
    var scope = root && root.nodeType === 1 ? root : document.body;
    if (!scope) return;
    if (scope.matches && scope.matches(SELECTOR)) fixEl(scope, isBody(scope));
    var list = scope.querySelectorAll ? scope.querySelectorAll(SELECTOR) : [];
    for (var i = 0; i < list.length; i++) fixEl(list[i], isBody(list[i]));
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

  window.CJKNbsp = {
    fixText: fixText,
    /* 給得到元素時用這支：內文段落會多套一條「短虛字不留行尾」 */
    fixFor: function (el, s) { return fixText(s, !!(el && isBody(el))); },
    fixEl: fixEl,
    run: run
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
