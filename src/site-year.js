/* Inteplast Taiwan — 年份自動更新（單一來源）
   ------------------------------------------------------------
   頁面裡跟「今年」有關的數字不要再寫死，改寫成兩個代號：
     {{year}}   → 今年（例如 2027）
     {{years}}  → 從 FOUNDED 算到今年的年數（例如 44）
   例：
     <span>© {{year}} INTEPLAST TAIWAN CORPORATION. All Rights Reserved.</span>
     <small data-tw="年 (1983-{{year}})" data-en="Yrs (1983-{{year}})">年 (1983-{{year}})</small>
     <span class="counter-num" data-target="{{years}}">0</span>

   本檔會把整份文件的文字節點、以及 data-tw / data-en / data-target / title / alt / content
   裡的代號換成實際數字。跨年不用改任何檔案。

   里程碑年份（例如 about.html 時間軸的 1983、2014、2026）請照舊寫死 —— 那是歷史事件，不該跟著今年跑。
*/
(function () {
  var FOUNDED = 1983;                      // Inteplast USA 創立年，改這裡就好
  var now = new Date();
  var year = now.getFullYear();
  var years = year - FOUNDED;

  window.SITE_YEARS = { founded: FOUNDED, year: year, years: years };

  function fill(s) {
    return String(s).split('{{year}}').join(year).split('{{years}}').join(years);
  }
  var HAS = /\{\{years?\}\}/;
  var ATTRS = ['data-tw', 'data-en', 'data-target', 'title', 'alt', 'content', 'aria-label', 'placeholder'];

  function apply(root) {
    if (!root) return;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var texts = [], n;
    while ((n = walker.nextNode())) { if (HAS.test(n.nodeValue)) texts.push(n); }
    texts.forEach(function (t) { t.nodeValue = fill(t.nodeValue); });

    var sel = ATTRS.map(function (a) { return '[' + a + ']'; }).join(',');
    Array.prototype.forEach.call(root.querySelectorAll(sel), function (el) {
      ATTRS.forEach(function (a) {
        var v = el.getAttribute(a);
        if (v && HAS.test(v)) el.setAttribute(a, fill(v));
      });
    });
  }

  window.applyYearTokens = apply;

  apply(document.documentElement);        // 已解析的部分先處理（頁首等）
  if (document.readyState === 'loading') {
    // 整份文件解析完再補一次（頁尾、統計數字），並且早於各頁的計數動畫
    document.addEventListener('DOMContentLoaded', function () { apply(document.documentElement); });
  }
})();
