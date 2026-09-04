/* ============================================================
   公司時間軸渲染器 (Cloudflare D1 API 版本)
   ------------------------------------------------------------
   透過 /api/timeline 從 D1 資料庫抓取資料，並畫成 about.html
   的時間軸。頁面上只留一個空容器：

     <div class="timeline" data-timeline></div>

   注意：時間軸節點是 fetch 回來才建立的，about.html 的
   IntersectionObserver 在載入時已經掃完一次 .reveal，不會看到
   它們 —— 所以本檔插完內容後要自己補上觀察，否則會停在
   opacity:0（看起來像「資料沒抓到」）。
   ============================================================ */
(function () {
  /* D1 裡有些 year 存的是字面 "\n" 兩個字元（匯入時 JS 跳脫序列被當純文字），
     不是真換行。兩種都正規化成真換行，才切得出多行年份。 */
  function normalizeYear(value) {
    return String(value == null ? '' : value).replace(/\\r\\n|\\n|\r\n/g, '\n');
  }

  function renderTimeline(items) {
    var host = document.querySelector('[data-timeline]');
    if (!host) return;

    if (!Array.isArray(items) || !items.length) {
      if (window.console) console.warn('[timeline] D1 資料庫沒有時間軸資料');
      return;
    }

    host.innerHTML = '';

    items.forEach(function (item) {
      // 對應資料庫欄位：year, title, title_en, description, description_en, future_outlook
      var isFuture = Boolean(item.future_outlook);

      var article = document.createElement('article');
      article.className = 'timeline-item reveal' + (isFuture ? ' future' : '');

      var year = document.createElement('div');
      year.className = 'timeline-year';
      normalizeYear(item.year).split('\n').forEach(function (line, i) {
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

      // 未來展望（future_outlook）一併渲染出來
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

    /* 補上進場動畫的觀察（見檔頭說明） */
    var fresh = host.querySelectorAll('.reveal');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      fresh.forEach(function (el) { el.classList.add('visible'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: .12 });
      fresh.forEach(function (el) { io.observe(el); });
    }

    /* 語言切換是掃描 DOM 的，插完內容後再叫一次 */
    if (typeof window.applyLanguage === 'function') window.applyLanguage();
  }

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
