/* ============================================================
   全站搜尋 — 臺灣營德
   ------------------------------------------------------------
   兩層架構（原本那套本地 BM25 ＋ 人工同義詞表已整段移除）：

   1. Algolia（inteplast_tw）— 分詞、錯字容錯、規格層命中，約 100ms 回應
   2. 語意層（transformers.js，在瀏覽器內跑）— 補上「意思相近但字面不同」
      的結果，例如「可以裝熱湯的袋子」對到耐熱袋。不需要人工同義詞。

   索引由 tools/algolia-upload.html 上傳；
   語意向量由 tools/build-embeddings.html 產生成 src/data/embeddings.json。
   兩者都讀 src/search-records.js 的同一份記錄定義。

   介面是頁首常駐搜尋條（不是彈出視窗），結果以下拉面板貼在輸入框下方。
   ============================================================ */
(function () {
  var inProducts = /\/products\//.test(location.pathname);
  var ROOT = inProducts ? '../' : '';

  /* 記錄裡的網址一律用 @root: 前綴表示「相對站台根目錄」 */
  function resolveUrl(u) {
    u = String(u || '');
    if (u.indexOf('@root:') === 0) return ROOT + u.slice(6);
    return (inProducts ? '' : 'products/') + u;
  }

  /* ---------- Algolia ----------
     這裡的 Search-Only Key 是唯讀的，設計上就可以公開；
     有寫入權的 Admin Key 只留在 tools/algolia-upload.html 使用者的瀏覽器裡。 */
  var ALGOLIA = {
    appId: 'YRQS01JBND',
    searchKey: '86d243489a6c083a51f3fd4f0a222ef0',
    index: 'inteplast_tw'
  };

  var seqNo = 0;
  var cache = {};

  function remoteSearch(query) {
    var q = String(query || '').trim();
    if (!q) return Promise.resolve({ results: [] });
    if (cache[q]) return Promise.resolve(cache[q]);

    return fetch('https://' + ALGOLIA.appId + '-dsn.algolia.net/1/indexes/' + ALGOLIA.index + '/query', {
      method: 'POST',
      headers: {
        'X-Algolia-Application-Id': ALGOLIA.appId,
        'X-Algolia-API-Key': ALGOLIA.searchKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: q, hitsPerPage: 12 })
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (j) {
        if (!j || !j.hits) return { results: [] };
        var out = { results: j.hits.map(function (h) {
          var hl = h._highlightResult || {};
          var sn = h._snippetResult || {};
          return {
            title: h.title,
            category: h.category || '',
            icon: h.icon || 'fa-cube',
            desc: h.desc || '',
            url: resolveUrl(h.url),
            snippet: (sn.desc && sn.desc.value) || (hl.desc && hl.desc.value) || h.desc || ''
          };
        }) };
        cache[q] = out;
        return out;
      })
      .catch(function () { return { results: [] }; });
  }

  /* ============================================================
     搜尋記錄 — 送到 Apps Script（同一支 /exec，action=search）
     ------------------------------------------------------------
     目的：知道客戶在找什麼，尤其是「搜尋了但我們沒有的東西」（結果 0 筆）。
     Sheet 的「有無結果」欄篩選＝無，就是新產品開發的線索。

     用 sendBeacon 送出、不等回應也不擋畫面；送不出去就安靜放棄。
     debounce 900ms，所以只記使用者停下來的那一次，不會記成 清/清潔/清潔袋 三筆。
     ============================================================ */
  var LOG_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz1hF2WW-easWE11AHvlnzvOXMG8qDSElR_IYcVx6vj0TWoXHrA-Mzuu78qcTJS7GMX/exec';
  var logTimer = null;
  var logged = {};

  function logSearch(query, hits) {
    var q = String(query || '').trim();
    if (!LOG_ENDPOINT || q.length < 2) return;
    // 去重只看查詢字串：同一個查詢會渲染多次（Algolia、語意各一次），筆數不同不該記兩列
    var key = q.toLowerCase();
    if (logged[key]) return;
    logged[key] = true;

    var body = new URLSearchParams({
      action: 'search',
      q: q,
      hits: String(hits),
      page: location.pathname + location.hash,
      lang: document.documentElement.lang || '',
      ref: document.referrer || ''
    });

    try {
      if (navigator.sendBeacon) navigator.sendBeacon(LOG_ENDPOINT, body);
      else fetch(LOG_ENDPOINT, { method: 'POST', body: body, mode: 'no-cors', keepalive: true });
    } catch (err) { /* 記錄失敗不影響使用 */ }
  }

  function queueLog(query, hits) {
    clearTimeout(logTimer);
    logTimer = setTimeout(function () { logSearch(query, hits); }, 900);
  }

  /* ============================================================
     語意搜尋（transformers.js，完全在瀏覽器內執行）
     ------------------------------------------------------------
     產品向量離線算好放在 src/data/embeddings.json，
     網站只需把「使用者打的那一句」轉成向量 → 只有查詢端要跑模型。

     模型約 40MB，第一次搜尋才下載、之後瀏覽器快取；
     在它就緒前搜尋照常運作（Algolia 結果先出來），載好後結果自動升級。
     任何一步失敗就安靜跳過。
     ============================================================ */
  var SEM = {
    ready: false,
    loading: false,
    items: null,
    extractor: null,
    threshold: 0.80,   // e5 模型相似度普遍偏高，門檻要拉高才不會塞雜訊
    max: 4
  };

  function loadSemantic() {
    if (SEM.loading || SEM.ready) return;
    SEM.loading = true;

    fetch(ROOT + 'src/data/embeddings.json')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.items || !data.items.length) throw new Error('no embeddings');
        SEM.items = data.items;
        return import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2');
      })
      .then(function (mod) {
        mod.env.allowLocalModels = false;
        return mod.pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { dtype: 'q8' });
      })
      .then(function (ex) {
        SEM.extractor = ex;
        SEM.ready = true;
        SEM.loading = false;
        // 模型晚到：把使用者已經打好的字重跑一次，結果自動升級
        var input = document.getElementById('omSearchInput');
        if (input && input.value.trim()) render(input.value);
      })
      .catch(function () { SEM.loading = false; });
  }

  function semanticHits(query) {
    if (!SEM.ready) { loadSemantic(); return Promise.resolve([]); }
    return SEM.extractor('query: ' + query, { pooling: 'mean', normalize: true })
      .then(function (out) {
        var qv = out.tolist()[0];
        var scored = [];
        SEM.items.forEach(function (it) {
          var s = 0;
          for (var i = 0; i < qv.length; i++) s += qv[i] * it.vec[i];
          if (s >= SEM.threshold) scored.push({ it: it, s: s });
        });
        scored.sort(function (a, b) { return b.s - a.s; });
        return scored.slice(0, SEM.max).map(function (x) {
          return {
            title: x.it.title,
            category: x.it.category || '',
            icon: x.it.icon || 'fa-cube',
            desc: x.it.desc || '',
            url: resolveUrl(x.it.url),
            snippet: x.it.desc || '',
            semantic: true
          };
        });
      })
      .catch(function () { return []; });
  }

  /** 語意結果補在關鍵字結果後面，已出現過的不重複 */
  function mergeSemantic(query, base) {
    return semanticHits(query).then(function (extra) {
      if (!extra.length) return base;
      var seen = {};
      base.results.forEach(function (r) { seen[r.url + '|' + r.title] = true; });
      var add = extra.filter(function (r) { return !seen[r.url + '|' + r.title]; });
      return add.length ? { results: base.results.concat(add) } : base;
    });
  }

  /* ---------- 介面 ---------- */
  var EXTRA_CSS = `
  /* 頁首常駐搜尋條：輸入框一直在，結果以下拉面板貼在下方（不遮擋整頁） */
  .om-searchbar { position: relative; display: flex; align-items: center; gap: 8px;
    width: 240px; margin-right: 10px; padding: 0 12px; height: 38px;
    background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 9999px;
    transition: width 0.22s ease, background 0.2s ease, border-color 0.2s ease; }
  .om-searchbar:focus-within { width: 320px; background: #FFFFFF; border-color: #00529B;
    box-shadow: 0 0 0 3px rgba(0,82,155,0.12); }
  .om-searchbar > i { color: #64748B; font-size: 0.88rem; flex: 0 0 auto; }
  .om-searchbar:focus-within > i { color: #00529B; }
  .om-searchbar input { flex: 1; min-width: 0; border: none; outline: none; background: transparent;
    font-family: inherit; font-size: 0.88rem; font-weight: 600; color: #1E293B; }
  .om-searchbar input::placeholder { color: #94A3B8; font-weight: 600; }
  .om-sb-clear { display: none; background: none; border: none; padding: 0; cursor: pointer;
    color: #94A3B8; font-size: 0.85rem; flex: 0 0 auto; }
  .om-sb-clear:hover { color: #00529B; }
  .om-searchbar.has-text .om-sb-clear { display: block; }

  .om-panel { position: absolute; top: calc(100% + 10px); right: 0; width: 520px; max-width: calc(100vw - 32px);
    background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px;
    box-shadow: 0 24px 50px -18px rgba(10,37,64,0.35); overflow: hidden; z-index: 12000; display: none; }
  .om-panel.active { display: block; }
  .om-search-tags { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 12px 16px;
    background: #F8FAFC; border-bottom: 1px solid #E2E8F0; }
  .om-search-tags .lbl { font-size: 0.74rem; font-weight: 800; color: #64748B; margin-right: 2px; }
  .om-tag { background: #FFFFFF; border: 1px solid #CBD5E1; color: #334155; font-size: 0.76rem; font-weight: 700;
    padding: 4px 10px; border-radius: 9999px; cursor: pointer; }
  .om-tag:hover { border-color: #00529B; color: #00529B; background: #EFF6FF; }
  .om-search-list { max-height: 58vh; overflow-y: auto; overflow-x: hidden; }
  .om-result { display: flex; align-items: center; gap: 12px; padding: 12px 16px; text-decoration: none;
    border-bottom: 1px solid #F1F5F9; }
  .om-result:hover { background: #EFF6FF; }
  .om-result-icon { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 9px; background: #0A2540; color: #FFFFFF;
    display: grid; place-items: center; font-size: 0.85rem; }
  .om-result-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .om-result-title { display: block; font-size: 0.92rem; font-weight: 800; color: #0A2540; }
  .om-result-desc { display: block; font-size: 0.78rem; font-weight: 500; color: #64748B; margin-top: 2px; line-height: 1.5;
    overflow-wrap: anywhere; text-wrap: pretty; }
  .om-result-desc mark { background: #FEF08A; color: #0A2540; padding: 0 2px; border-radius: 3px; }
  .om-result-cat { font-size: 0.7rem; font-weight: 800; color: #00529B; background: #EFF6FF; border: 1px solid #DBEAFE;
    padding: 3px 9px; border-radius: 6px; white-space: nowrap; }
  .om-empty { padding: 28px 18px; text-align: center; color: #64748B; }
  .om-empty .t { font-size: 0.92rem; font-weight: 800; color: #0A2540; margin-bottom: 6px; }
  .om-empty .s { font-size: 0.8rem; }
  .om-empty a { color: #00529B; font-weight: 800; }

  @media (max-width: 1200px) {
    .om-searchbar { width: 190px; }
    .om-searchbar:focus-within { width: 250px; }
  }
  /* 1000px 以下頁首交給漢堡選單，搜尋條攤成整列 */
  @media (max-width: 1000px) {
    .om-searchbar, .om-searchbar:focus-within { width: 100%; margin: 0; }
    .om-panel { width: 100%; right: auto; left: 0; }
    .om-result-cat { display: none; }
  }
  `;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function ensureUI() {
    if (!document.getElementById('omSearchStyle')) {
      var st = document.createElement('style');
      st.id = 'omSearchStyle';
      st.textContent = EXTRA_CSS;
      document.head.appendChild(st);
    }
    var legacy = document.getElementById('searchModalOverlay');
    if (legacy) legacy.remove();
    if (document.getElementById('omSearchBar')) return;

    // 頁首那顆放大鏡按鈕換成常駐搜尋條
    var trigger = document.getElementById('globalSearchTrigger') || document.querySelector('.search-trigger-btn');
    if (!trigger || !trigger.parentNode) return;

    var bar = document.createElement('div');
    bar.className = 'om-searchbar';
    bar.id = 'omSearchBar';
    bar.innerHTML =
      '<i class="fa-solid fa-magnifying-glass"></i>' +
      '<input id="omSearchInput" type="text" autocomplete="off" aria-label="全站搜尋" ' +
        'data-ph-tw="搜尋產品、尺寸或規格" data-ph-en="Search products, sizes or specs" ' +
        'placeholder="搜尋產品、尺寸或規格">' +
      '<button class="om-sb-clear" id="omSearchClear" type="button" aria-label="清除"><i class="fa-solid fa-xmark"></i></button>' +
      '<div class="om-panel" id="omSearchPanel">' +
        '<div class="om-search-tags">' +
          '<span class="lbl">熱門：</span>' +
          '<button class="om-tag" type="button" data-q="垃圾袋">垃圾袋</button>' +
          '<button class="om-tag" type="button" data-q="束口袋">束口袋</button>' +
          '<button class="om-tag" type="button" data-q="耐熱袋">耐熱袋</button>' +
          '<button class="om-tag" type="button" data-q="夾鏈袋">夾鏈袋</button>' +
          '<button class="om-tag" type="button" data-q="45L">45L</button>' +
        '</div>' +
        '<div id="omSearchList" class="om-search-list"></div>' +
      '</div>';

    trigger.parentNode.replaceChild(bar, trigger);

    var input = document.getElementById('omSearchInput');
    input.addEventListener('input', function () {
      bar.classList.toggle('has-text', !!this.value);
      openPanel();
      render(this.value);
    });
    input.addEventListener('focus', function () { openPanel(); });
    document.getElementById('omSearchClear').addEventListener('click', function () {
      input.value = '';
      bar.classList.remove('has-text');
      input.focus();
      render('');
    });
  }

  function openPanel() {
    var p = document.getElementById('omSearchPanel');
    if (p) p.classList.add('active');
  }
  function closePanel() {
    var p = document.getElementById('omSearchPanel');
    if (p) p.classList.remove('active');
  }

  var queryTimer = null;
  var lastQuery = '';

  /** preset 有值＝拿已經算好的結果直接畫；沒有＝發動查詢 */
  function render(query, preset) {
    var list = document.getElementById('omSearchList');
    if (!list) return;
    var q = (query || '').trim();
    lastQuery = q;

    if (!preset) {
      if (!q) { list.innerHTML = ''; return; }
      if (q.length >= 2) loadSemantic();
      // 延後 160ms：連續打字時只打最後一次，否則畫面會被較舊的回應反覆覆蓋
      clearTimeout(queryTimer);
      var seq = ++seqNo;
      queryTimer = setTimeout(function () { runQuery(q, seq); }, 160);
      return;
    }

    if (!preset.results.length) {
      list.innerHTML = '<div class="om-empty">' +
        '<div class="t">找不到與「' + esc(q) + '」相符的產品</div>' +
        '<div class="s">我們的品項持續增加中，歡迎<a href="' + ROOT + 'contact.html">直接與專員聯繫</a>詢問。</div>' +
        '</div>';
      return;
    }

    list.innerHTML = preset.results.map(function (x) {
      return '<a class="om-result" href="' + x.url + '">' +
        '<span class="om-result-icon"><i class="fa-solid ' + x.icon + '"></i></span>' +
        '<span class="om-result-info">' +
          '<span class="om-result-title">' + esc(x.title) + '</span>' +
          '<span class="om-result-desc">' + (x.snippet || esc(x.desc)) + '</span>' +
        '</span>' +
        '<span class="om-result-cat">' + esc(x.category) + '</span>' +
      '</a>';
    }).join('');
  }

  function runQuery(q, seq) {
    if (seq !== seqNo) return;
    remoteSearch(q).then(function (base) {
      if (seq !== seqNo) return;
      render(q, base);
      return mergeSemantic(q, base).then(function (merged) {
        if (seq !== seqNo) return;
        if (merged !== base) render(q, merged);
        queueLog(q, merged.results.length);
      });
    });
  }

  // 保留這兩個名字：漢堡選單與舊頁面仍在呼叫
  window.openSearchModal = function () {
    ensureUI();
    var i = document.getElementById('omSearchInput');
    if (!i) return;
    openPanel();
    i.focus();
  };
  window.closeSearchModal = closePanel;

  document.addEventListener('click', function (e) {
    var t = e.target;
    var bar = document.getElementById('omSearchBar');
    if (bar && !bar.contains(t)) closePanel();

    var tag = t.closest && t.closest('.om-tag');
    if (tag) {
      e.preventDefault();
      var q = tag.getAttribute('data-q');
      var input = document.getElementById('omSearchInput');
      if (input) {
        input.value = q;
        input.focus();
        if (bar) bar.classList.add('has-text');
      }
      openPanel();
      render(q);
    }
  });

  document.addEventListener('keydown', function (e) {
    var input = document.getElementById('omSearchInput');
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
      e.preventDefault();
      if (input) { openPanel(); input.focus(); input.select(); }
    } else if (e.key === 'Escape') {
      closePanel();
      if (input) input.blur();
    } else if (e.key === 'Enter' && input && document.activeElement === input) {
      var first = document.querySelector('#omSearchList .om-result');
      if (first) { e.preventDefault(); location.href = first.getAttribute('href'); }
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI);
  else ensureUI();
})();
