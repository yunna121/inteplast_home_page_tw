/* ============================================================
   全站搜尋 — 臺灣營德
   ------------------------------------------------------------
   三層架構：

   1. Algolia（inteplast_tw）— 分詞、錯字容錯，約 100ms 回應。
      查詢帶 removeWordsIfNoResults: 'allOptional'：中文分詞把「束口袋」切成
      束口＋袋 時，預設要「全部命中」會變成 0 筆（打「束口」有、打「束口袋」沒有
      就是這個原因）；改成找不到時逐字放寬，長詞不會比短詞更難找。
   2. 本地索引（同一份 search-records.js）— 中文雙字組（bigram）比對 ＋ 口語同義詞表。
      Algolia 沒回、離線、用 file:// 直接開檔時都能用，是保底層。
   3. 語意層（transformers.js，在瀏覽器內跑）— 補上「意思相近但字面不同」
      的結果，例如「可以裝熱湯的袋子」對到蔬果袋。

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
      body: JSON.stringify({
        query: q,
        hitsPerPage: 12,
        // 中文分詞：找不到時把詞逐一改為選擇性（束口袋 → 束口 OR 袋），避免長詞 0 筆
        removeWordsIfNoResults: 'allOptional',
        queryLanguages: ['zh'],
        indexLanguages: ['zh'],
        ignorePlurals: true,
        typoTolerance: true,
        attributesToSnippet: ['desc:30']
      })
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
     本地索引（保底層）
     ------------------------------------------------------------
     資料來源就是 Algolia 與語意向量共用的那份 src/search-records.js，
     第一次查詢時才動態載入（一般頁面沒有引入 products-data.js）。

     比對方式：中文切雙字組（束口袋 → 束口、口袋），latin 與數字整段當一個詞；
     再加一層口語同義詞（垃圾袋→清潔袋、束口袋→拉繩袋…），
     讓客戶用日常說法也找得到正式品名。
     ============================================================ */
  var SYNONYMS = {
    '垃圾袋': '清潔袋', '垃圾': '清潔袋', '塑膠袋': '清潔袋',
    '束口袋': '拉繩袋', '束口': '拉繩袋', '抽繩袋': '拉繩袋', '綁繩袋': '拉繩袋',
    '保鮮袋': '夾鏈袋', '密封袋': '夾鏈袋', '冷凍袋': '夾鏈袋', '密實袋': '夾鏈袋',
    'ziplock': '夾鏈袋', 'ziploc': '夾鏈袋', 'zipper': '夾鏈袋',
    '耐熱袋': '蔬果袋', '市場袋': '蔬果袋', '食品袋': '蔬果袋', '蔬菜袋': '蔬果袋',
    '手套': '多功能手套', 'glove': '多功能手套', 'gloves': '多功能手套',
    '膠帶': '遮蔽防塵膠帶', '防塵': '遮蔽防塵膠帶', '遮蔽': '遮蔽防塵膠帶',
    '磅秤紙': 'Scale Sheet', '秤紙': 'Scale Sheet', 'tare sheet': 'Scale Sheet',
    '環保標章': '環保', '報價': '聯繫我們', '詢價': '聯繫我們'
  };

  var LOCAL = { ready: false, loading: false, recs: null, docs: null };

  function normText(s) {
    return String(s || '').toLowerCase()
      .replace(/[\uFF01-\uFF5E]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); })
      .replace(/[\s\u3000、，,。．.\-_/（）()「」【】]+/g, ' ')
      .trim();
  }

  /** 中文雙字組 ＋ latin/數字整詞 */
  function grams(s) {
    var t = normText(s), out = [];
    (t.match(/[a-z0-9]+/g) || []).forEach(function (w) { out.push(w); });
    t.replace(/[a-z0-9]+/g, ' ').split(/\s+/).forEach(function (seg) {
      if (!seg) return;
      if (seg.length === 1) { out.push(seg); return; }
      for (var i = 0; i < seg.length - 1; i++) out.push(seg.slice(i, i + 2));
    });
    return out;
  }

  function expandQuery(q) {
    var n = normText(q), extra = [];
    Object.keys(SYNONYMS).forEach(function (k) {
      if (n.indexOf(normText(k)) > -1) extra.push(SYNONYMS[k]);
    });
    return extra;
  }

  function ensureLocalIndex() {
    if (LOCAL.ready || LOCAL.loading) return Promise.resolve(LOCAL.ready);
    LOCAL.loading = true;

    function inject(src) {
      return new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    var need = [];
    if (!window.PRODUCT_DATA) need.push(ROOT + 'src/data/products-data.js');
    if (!window.buildSearchRecords) need.push(ROOT + 'src/search-records.js');

    return need.reduce(function (p, src) { return p.then(function () { return inject(src); }); }, Promise.resolve())
      .then(function () {
        LOCAL.recs = window.buildSearchRecords ? window.buildSearchRecords() : [];
        LOCAL.docs = LOCAL.recs.map(function (r) {
          var text = [r.title, (r.alias || []).join(' '), r.category, r.desc, (r.keywords || []).join(' '), r.body].filter(Boolean).join(' ');
          var g = {};
          grams(r.title).forEach(function (x) { g[x] = 3; });          // 標題權重高
          grams(text).forEach(function (x) { if (!g[x]) g[x] = 1; });
          return { rec: r, gramMap: g, title: normText(r.title) };
        });
        LOCAL.ready = LOCAL.docs.length > 0;
        LOCAL.loading = false;
        return LOCAL.ready;
      })
      .catch(function () { LOCAL.loading = false; return false; });
  }

  function localHits(query) {
    return ensureLocalIndex().then(function (ok) {
      if (!ok) return [];
      var qn = normText(query);
      if (!qn) return [];
      var qGrams = grams(query);
      var synonyms = expandQuery(query);
      synonyms.forEach(function (s) { qGrams = qGrams.concat(grams(s)); });
      if (!qGrams.length) return [];

      var scored = [];
      LOCAL.docs.forEach(function (d) {
        var hit = 0, score = 0;
        qGrams.forEach(function (g) {
          if (d.gramMap[g]) { hit++; score += d.gramMap[g]; }
        });
        if (d.title.indexOf(qn) > -1) score += 12;
        synonyms.forEach(function (s) { if (d.title.indexOf(normText(s)) > -1) score += 8; });
        // 命中比例太低就不算（避免只中一個字就冒出來）
        if (hit / qGrams.length < 0.34 && score < 12) return;
        if (score > 0) scored.push({ d: d, s: score });
      });

      scored.sort(function (a, b) { return b.s - a.s; });
      return scored.slice(0, 8).map(function (x) {
        var r = x.d.rec;
        return {
          title: r.title,
          category: r.category || '',
          icon: r.icon || 'fa-cube',
          desc: r.desc || '',
          url: resolveUrl(r.url),
          snippet: r.desc || ''
        };
      });
    });
  }

  /** 0 筆時的「你可能在找」：不套門檻，單字重疊也算，抓最接近的三筆
      （例：打「漱口帶」→ 膠帶（共用「帶」）、拉繩袋（共用「口」）） */
  function looseLocal(query) {
    return ensureLocalIndex().then(function (ok) {
      if (!ok) return [];
      var qn = normText(query);
      if (!qn) return [];
      var qGrams = grams(query);
      expandQuery(query).forEach(function (s) { qGrams = qGrams.concat(grams(s)); });
      var qChars = qn.replace(/[a-z0-9\s]/g, '').split('');

      var scored = [];
      LOCAL.docs.forEach(function (d) {
        var s = 0;
        qGrams.forEach(function (g) { if (d.gramMap[g]) s += 2; });
        qChars.forEach(function (c) { if (d.title.indexOf(c) > -1) s += 2; });
        if (s > 0) scored.push({ d: d, s: s });
      });
      scored.sort(function (a, b) { return b.s - a.s; });
      return scored.slice(0, 3).map(function (x) {
        var r = x.d.rec;
        return { title: r.title, category: r.category || '', icon: r.icon || 'fa-cube',
          desc: r.desc || '', url: resolveUrl(r.url), snippet: r.desc || '' };
      });
    });
  }

  /** 把本地結果併進來（Algolia 已有的不重複），Algolia 空手時本地就是主結果 */
  function mergeLocal(query, base) {
    return localHits(query).then(function (extra) {
      if (!extra.length) return base;
      var seen = {};
      base.results.forEach(function (r) { seen[r.url + '|' + r.title] = true; });
      var add = extra.filter(function (r) { return !seen[r.url + '|' + r.title]; });
      return add.length ? { results: base.results.concat(add) } : base;
    });
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
    threshold: 0.76,   // e5 模型相似度普遍偏高；0.80 太嚴，換句話說的查詢會全被濾掉
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
    width: clamp(170px, 18vw, 240px); margin-right: 10px; padding: 0 12px; height: 38px;
    background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 9999px;
    transition: width 0.22s ease, background 0.2s ease, border-color 0.2s ease; }
  .om-searchbar:focus-within { width: clamp(220px, 26vw, 320px); background: #FFFFFF; border-color: #00529B;
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

  /* 斷點統一為全站三段：1024 / 768 / 480 */
  @media (max-width: 1400px) {
    .om-searchbar { width: 150px; }
    .om-searchbar:focus-within { width: 220px; }
  }
  /* 1024px 以下頁首交給漢堡選單，搜尋條攤成整列 */
  @media (max-width: 1024px) {
    .om-searchbar, .om-searchbar:focus-within { width: 100%; margin: 0; }
    .om-panel { width: 100%; right: auto; left: 0; }
    .om-result-cat { display: none; }
  }
  /* 手機（768px 以下）：搜尋條收成一顆放大鏡，點了才展開成整條，
     讓 logo 與漢堡按鈕不會被擠壓 */
  @media (max-width: 768px) {
    .om-searchbar, .om-searchbar:focus-within {
      flex: 0 0 38px; width: 38px; min-width: 38px; padding: 0;
      justify-content: center; margin: 0;
    }
    .om-searchbar input { flex: 0 0 0; width: 0; padding: 0; }
    .om-searchbar.is-open, .om-searchbar.is-open:focus-within {
      position: absolute; left: 14px; right: 14px; top: 50%; transform: translateY(-50%);
      flex: none; width: auto; min-width: 0; padding: 0 14px; height: 42px;
      justify-content: flex-start; z-index: 30;
      background: #FFFFFF; border-color: #00529B; box-shadow: 0 0 0 3px rgba(0,82,155,0.12);
    }
    .om-searchbar.is-open input { flex: 1 1 auto; width: auto; }
    .om-panel { width: 100%; }
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
          '<button class="om-tag" type="button" data-q="手套">手套</button>' +
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

    // 窄螢幕：搜尋條平常只有一顆放大鏡，點擊才展開（展開狀態由 is-open 控制）
    var narrow = function () { return window.matchMedia('(max-width: 768px)').matches; };
    bar.addEventListener('click', function () {
      if (!narrow()) return;
      bar.classList.add('is-open');
      input.focus();
    });
    window.addEventListener('resize', function () {
      if (!narrow()) bar.classList.remove('is-open');
    });
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
      // 再補一層「你可能在找」：完全 0 筆時不要只給死路
      looseLocal(q).then(function (sug) {
        if (lastQuery !== q || !sug.length) return;
        list.innerHTML =
          '<div class="om-empty" style="padding:18px 18px 8px">' +
            '<div class="t">找不到與「' + esc(q) + '」完全相符的產品</div>' +
            '<div class="s">你可能在找：</div>' +
          '</div>' +
          sug.map(resultRow).join('') +
          '<div class="om-empty" style="padding:12px 18px 18px">' +
            '<div class="s">都不是？歡迎<a href="' + ROOT + 'contact.html">直接與專員聯繫</a>詢問。</div>' +
          '</div>';
      });
      return;
    }

    list.innerHTML = preset.results.map(resultRow).join('');
  }

  function resultRow(x) {
    return '<a class="om-result" href="' + x.url + '">' +
      '<span class="om-result-icon"><i class="fa-solid ' + x.icon + '"></i></span>' +
      '<span class="om-result-info">' +
        '<span class="om-result-title">' + esc(x.title) + '</span>' +
        '<span class="om-result-desc">' + (x.snippet || esc(x.desc)) + '</span>' +
      '</span>' +
      '<span class="om-result-cat">' + esc(x.category) + '</span>' +
    '</a>';
  }

  function runQuery(q, seq) {
    if (seq !== seqNo) return;
    remoteSearch(q).then(function (base) {
      if (seq !== seqNo) return;
      render(q, base);
      // 本地索引（同義詞＋雙字組）先補，再等語意層
      return mergeLocal(q, base).then(function (withLocal) {
        if (seq !== seqNo) return;
        if (withLocal !== base) render(q, withLocal);
        return mergeSemantic(q, withLocal).then(function (merged) {
          if (seq !== seqNo) return;
          if (merged !== withLocal) render(q, merged);
          queueLog(q, merged.results.length);
        });
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
    if (bar && !bar.contains(t)) {
      closePanel();
      var inp = document.getElementById('omSearchInput');
      if (!inp || !inp.value) bar.classList.remove('is-open');
    }

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
