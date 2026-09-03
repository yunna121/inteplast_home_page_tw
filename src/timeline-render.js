// /* ============================================================
//    公司時間軸渲染器
//    ------------------------------------------------------------
//    把 content/timeline.js（window.TIMELINE.items）畫成 about.html
//    的時間軸。頁面上只留一個空容器：

//      <div class="timeline" data-timeline></div>

//    載入順序（放在該區塊之後、頁尾其他 script 之前）：
//      <script src="content/timeline.js"></script>      ← 資料
//      <script src="src/timeline-render.js"></script>   ← 這支

//    兩支都是一般 script（不是 fetch），所以用 file:// 直接開檔也能顯示。
//    文字要改請改 content/timeline.js，不要改這裡。
//    ============================================================ */
// (function () {
//   function render() {
//     var host = document.querySelector('[data-timeline]');
//     if (!host) return;

//     var data = window.TIMELINE;
//     var items = (data && Array.isArray(data.items)) ? data.items : [];
//     if (!items.length) {
//       if (window.console) console.warn('[timeline] 找不到 content/timeline.js 的資料');
//       return;
//     }

//     host.innerHTML = '';

//     items.forEach(function (item) {
//       var article = document.createElement('article');
//       article.className = 'timeline-item reveal' + (item.future ? ' future' : '');

//       var year = document.createElement('div');
//       year.className = 'timeline-year';
//       String(item.year == null ? '' : item.year).split('\n').forEach(function (line, i) {
//         if (i) year.appendChild(document.createElement('br'));
//         year.appendChild(document.createTextNode(line));
//       });

//       var copy = document.createElement('div');
//       copy.className = 'timeline-copy';

//       var h3 = document.createElement('h3');
//       if (item.title_tw) h3.setAttribute('data-tw', item.title_tw);
//       if (item.title_en) h3.setAttribute('data-en', item.title_en);
//       h3.textContent = item.title_tw || item.title_en || '';

//       var p = document.createElement('p');
//       if (item.desc_tw) p.setAttribute('data-tw', item.desc_tw);
//       if (item.desc_en) p.setAttribute('data-en', item.desc_en);
//       p.textContent = item.desc_tw || item.desc_en || '';

//       copy.appendChild(h3);
//       if (p.textContent) copy.appendChild(p);
//       article.appendChild(year);
//       article.appendChild(copy);
//       host.appendChild(article);
//     });

//     /* 語言切換與進場動畫都是掃描 DOM 的，插完內容後再叫一次 */
//     if (typeof window.applyLanguage === 'function') window.applyLanguage();
//   }

//   render();
// })();


/* ============================================================
   公司時間軸渲染器 (Cloudflare D1 API 版本)
   ------------------------------------------------------------
   透過 /api/timeline 從 D1 資料庫抓取資料，並畫成 about.html
   的時間軸。頁面上只留一個空容器：

     <div class="timeline" data-timeline></div>
   ============================================================ */
(function () {
  function renderTimeline(items) {
    var host = document.querySelector('[data-timeline]');
    if (!host) return;

    if (!Array.isArray(items) || !items.length) {
      if (window.console) console.warn('[timeline] D1 資料庫沒有時間軸資料');
      return;
    }

    host.innerHTML = '';

    items.forEach(function (item) {
      // 支援從 D1 傳回來的欄位名稱（對應資料庫欄位：year, title, title_en, description, description_en, future_outlook）
      var isFuture = Boolean(item.future_outlook);
      
      var article = document.createElement('article');
      article.className = 'timeline-item reveal' + (isFuture ? ' future' : '');

      var year = document.createElement('div');
      year.className = 'timeline-year';
      var yearStr = String(item.year == null ? '' : item.year);
      yearStr.split('\n').forEach(function (line, i) {
        if (i) year.appendChild(document.createElement('br'));
        year.appendChild(document.createTextNode(line));
      });

      var copy = document.createElement('div');
      copy.className = 'timeline-copy';

      var h3 = document.createElement('h3');
      var titleTw = item.title || '';
      var titleEn = item.title_en || titleTw;
      if (titleTw) h3.setAttribute('data-tw', titleTw);
      if (titleEn) h3.setAttribute('data-en', titleEn);
      h3.textContent = titleTw;

      var p = document.createElement('p');
      var descTw = item.description || '';
      var descEn = item.description_en || descTw;
      if (descTw) p.setAttribute('data-tw', descTw);
      if (descEn) p.setAttribute('data-en', descEn);
      p.textContent = descTw;

      copy.appendChild(h3);
      if (p.textContent) copy.appendChild(p);

      // 如果有未來展望（future_outlook），一併渲染出來
      if (item.future_outlook) {
        var pFuture = document.createElement('p');
        pFuture.className = 'future-outlook';
        pFuture.setAttribute('data-tw', item.future_outlook);
        pFuture.textContent = item.future_outlook;
        copy.appendChild(pFuture);
      }

      article.appendChild(year);
      article.appendChild(copy);
      host.appendChild(article);
    });

    /* 語言切換與進場動畫都是掃描 DOM 的，插完內容後再叫一次 */
    if (typeof window.applyLanguage === 'function') window.applyLanguage();
  }

  // 改用 fetch 透過我們剛建好的 D1 後端 API 取得時間軸資料
  document.addEventListener('DOMContentLoaded', function () {
    fetch('/api/timeline', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('API 狀態錯誤: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        renderTimeline(data);
      })
      .catch(function (err) {
        if (window.console) console.error('[timeline] 無法從 API 取得資料：', err);
      });
  });
})();