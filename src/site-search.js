/* ============================================================
   全站搜尋 — 臺灣營德
   ------------------------------------------------------------
   單一引擎：語意搜尋（向量）。

   為什麼不用關鍵字引擎（Algolia／Meilisearch 之類）：
   客戶打「垃圾袋」而我們的品名是「清潔袋」——兩個詞沒有任何一個字相同。
   任何字面比對的引擎都不可能命中，只能靠人工維護同義詞表。
   向量搜尋是把整句話轉成語意座標再比距離，「垃圾袋」與「清潔袋」
   在語意空間裡本來就很近，所以不需要同義詞表。

   資料只有一份：src/data/embeddings.json
   （由 tools/build-embeddings.html 產生，內含標題／敘述／中英文／網址
     與 int8 量化後的向量；11 筆約 9KB。）

   查詢流程：
   1. 立即：字面包含比對（打「清潔袋」「can liner」這種正式品名時
      不必等模型，先給結果）。這不是第二個引擎，只是十來行的快速通道。
   2. 模型就緒後：把使用者那一句轉成向量，與 11 筆比餘弦相似度並排序。
      模型約 30MB，第一次搜尋才下載、之後由瀏覽器快取。
   3. 沒有夠像的結果時，仍列出最接近的三筆（不給死路）。

   介面是頁首常駐搜尋條，結果以下拉面板貼在輸入框下方。
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

  var seqNo = 0;

  /* ============================================================
     資料載入 ＋ 字面快速通道
     ------------------------------------------------------------
     embeddings.json 同時是資料來源與向量來源，所以整個搜尋只讀一個檔。
     快速通道＝「查詢字整段出現在標題／英文名／分類／敘述裡」就直接算命中，
     讓打正式品名的人不用等模型下載。
     ============================================================ */
  var DB = { loading: null, items: null };

  function loadDB() {
    if (DB.loading) return DB.loading;
    DB.loading = fetch(ROOT + 'src/data/embeddings.json')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.items || !data.items.length) return null;
        data.items.forEach(function (it) { it.vecf = decodeVec(it.vecb64); });
        DB.items = data.items;
        return data.items;
      })
      .catch(function () { return null; });
    return DB.loading;
  }

  /** int8 量化向量還原：base64 → 有號位元組 → 單位向量 */
  function decodeVec(b64) {
    var bin = atob(b64), n = bin.length, v = new Float32Array(n), sum = 0;
    for (var i = 0; i < n; i++) {
      var b = bin.charCodeAt(i);
      v[i] = (b > 127 ? b - 256 : b) / 127;
      sum += v[i] * v[i];
    }
    var norm = Math.sqrt(sum) || 1;
    for (var k = 0; k < n; k++) v[k] /= norm;
    return v;
  }

  function normText(s) {
    return String(s || '').toLowerCase()
      .replace(/[\uFF01-\uFF5E]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); })
      .replace(/[\s\u3000、，,。．.\-_/（）()「」【】]+/g, '')
      .trim();
  }

  function toRow(it, semantic) {
    return {
      title: (isEn() && it.title_en) ? it.title_en : it.title,
      category: it.category || '',
      icon: it.icon || 'fa-cube',
      desc: (isEn() && it.desc_en) ? it.desc_en : (it.desc || ''),
      url: resolveUrl(it.url),
      snippet: (isEn() && it.desc_en) ? it.desc_en : (it.desc || ''),
      semantic: !!semantic
    };
  }

  /** 字面包含：標題權重最高，敘述也算 */
  function literalHits(query) {
    return loadDB().then(function (items) {
      if (!items) return [];
      var q = normText(query);
      if (q.length < 2) return [];
      var scored = [];
      items.forEach(function (it) {
        var title = normText(it.title) + ' ' + normText(it.title_en) + ' ' + normText(it.category);
        var body = normText(it.desc) + ' ' + normText(it.desc_en);
        var s = 0;
        if (title.indexOf(q) > -1) s = 10;
        else if (body.indexOf(q) > -1) s = 4;
        if (s) scored.push({ it: it, s: s });
      });
      scored.sort(function (a, b) { return b.s - a.s; });
      return scored.map(function (x) { return toRow(x.it, false); });
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
     語意搜尋（transformers.js，完全在瀏覽器內執行）— 主引擎
     ------------------------------------------------------------
     資料的向量已離線算好在 embeddings.json，網站只需把「使用者打的那一句」
     轉成向量，所以只有查詢端要跑模型。模型約 30MB，第一次搜尋才下載，
     之後瀏覽器快取；在它就緒前由字面快速通道頂著。

     門檻 FLOOR 以下視為「不夠像」，此時不當作結果，改走「你可能在找」。
     ============================================================ */
  /* 門檻怎麼定的（實測數據）：
     「垃圾袋」→ 清潔袋 0.873、拉繩袋 0.861、蔬果袋 0.856…
     「手套」  → 多功能手套 0.856、下一名 0.830
     「asdfgh」→ 最高只有 0.770；「qqqqqq」→ 0.822
     e5 的絕對分數壓縮得很高（對的 0.873、錯的 0.861 只差 0.012），
     所以單靠絕對門檻沒有用。做法是兩道關卡：
       FLOOR — 最高分沒到這個數，就當成「沒有夠像的」走建議清單
       GAP   — 只留跟最高分差距在這個範圍內的，其餘視為雜訊 */
  var SEM = {
    ready: false,
    loading: false,
    extractor: null,
    FLOOR: 0.83,
    // 英文查詢對中文為主的資料，整體分數會低一截（ziplock、trash bag
    // 明明對得上，卻卡在 0.83 以下），所以拉丁字母為主的查詢用較低的門檻
    FLOOR_LATIN: 0.80,
    // 亂碼（qqqqqq、xyzxyz）的分數分布是平的：第一名與第二名幾乎同分。
    // 真實查詢的第一名會明顯領先。放寬英文門檻時就靠這個差距把亂碼擋掉。
    MIN_LEAD: 0.01,
    GAP: 0.02,
    max: 4
  };

  /** 查詢是否以拉丁字母為主（用來選門檻） */
  function isLatinQuery(q) {
    var latin = (String(q).match(/[a-z]/gi) || []).length;
    var cjk = (String(q).match(/[\u4e00-\u9fff]/g) || []).length;
    return latin > 0 && latin >= cjk * 2;
  }

  function loadSemantic() {
    if (SEM.loading || SEM.ready) return;
    SEM.loading = true;

    loadDB()
      .then(function (items) {
        if (!items) throw new Error('no embeddings');
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

  /** 全部排序後回傳 [{row, score}]，門檻交給呼叫端決定 */
  function semanticRanked(query) {
    if (!SEM.ready) { loadSemantic(); return Promise.resolve(null); }
    return SEM.extractor('query: ' + query, { pooling: 'mean', normalize: true })
      .then(function (out) {
        var qv = out.tolist()[0];
        var scored = DB.items.map(function (it) {
          var s = 0;
          for (var i = 0; i < qv.length; i++) s += qv[i] * it.vecf[i];
          return { it: it, s: s };
        });
        scored.sort(function (a, b) { return b.s - a.s; });
        return scored;
      })
      .catch(function () { return null; });
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

  /* 搜尋面板的文字也要跟著全站語言（site-lang.js 會把 <html lang> 設成 zh-TW / en）。
     這些字是動態產生的，掛 data-tw 沒用，所以直接依語言取字。 */
  function isEn() { return (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0; }
  var T = {
    hot:      ['熱門：', 'Popular:'],
    noResult: ['找不到與「{q}」相符的產品', 'No results for “{q}”'],
    noHint:   ['我們的品項持續增加中，歡迎<a href="{url}">直接與專員聯繫</a>詢問。',
               'Our range keeps growing — <a href="{url}">contact our team</a> and we will help.'],
    maybeT:   ['找不到與「{q}」完全相符的產品', 'No exact match for “{q}”'],
    maybeS:   ['你可能在找：', 'You might be looking for:'],
    other:    ['都不是？歡迎<a href="{url}">直接與專員聯繫</a>詢問。',
               'None of these? <a href="{url}">Contact our team</a> and we will help.'],
    loading:  ['搜尋中…', 'Searching…']
  };
  function t(key, vars) {
    var str = T[key][isEn() ? 1 : 0];
    Object.keys(vars || {}).forEach(function (k) { str = str.split('{' + k + '}').join(vars[k]); });
    return str;
  }

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
        'data-ph-tw="搜尋產品或用途" data-ph-en="Search products or uses" ' +
        'placeholder="搜尋產品或用途">' +
      '<button class="om-sb-clear" id="omSearchClear" type="button" aria-label="清除"><i class="fa-solid fa-xmark"></i></button>' +
      '<div class="om-panel" id="omSearchPanel">' +
        '<div class="om-search-tags">' +
          '<span class="lbl" id="omHotLabel">熱門：</span>' +
          '<button class="om-tag" type="button" data-q="垃圾袋" data-q-en="trash bag" data-tw="垃圾袋" data-en="Trash bags">垃圾袋</button>' +
          '<button class="om-tag" type="button" data-q="束口袋" data-q-en="drawstring bag" data-tw="束口袋" data-en="Drawstring">束口袋</button>' +
          '<button class="om-tag" type="button" data-q="保鮮袋" data-q-en="freezer bag" data-tw="保鮮袋" data-en="Freezer bags">保鮮袋</button>' +
          '<button class="om-tag" type="button" data-q="蔬果袋" data-q-en="produce bag" data-tw="蔬果袋" data-en="Produce bags">蔬果袋</button>' +
          '<button class="om-tag" type="button" data-q="手套" data-q-en="gloves" data-tw="手套" data-en="Gloves">手套</button>' +
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
    loadSemantic();   // 面板一打開就開始載模型，使用者打完字通常已就緒
    var lbl = document.getElementById('omHotLabel');
    if (lbl) lbl.textContent = t('hot');
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
      // 模型還在下載、且字面也沒命中：說明狀態，不要謊報「找不到」
      if (preset.pending) {
        list.innerHTML = '<div class="om-empty"><div class="s">' + t('loading') + '</div></div>';
        return;
      }
      // 有「最接近的幾筆」就給建議，沒有才是真的死路
      if (preset.suggestions && preset.suggestions.length) {
        list.innerHTML =
          '<div class="om-empty" style="padding:18px 18px 8px">' +
            '<div class="t">' + t('maybeT', { q: esc(q) }) + '</div>' +
            '<div class="s">' + t('maybeS') + '</div>' +
          '</div>' +
          preset.suggestions.map(resultRow).join('') +
          '<div class="om-empty" style="padding:12px 18px 18px">' +
            '<div class="s">' + t('other', { url: ROOT + 'contact.html' }) + '</div>' +
          '</div>';
        return;
      }
      list.innerHTML = '<div class="om-empty">' +
        '<div class="t">' + t('noResult', { q: esc(q) }) + '</div>' +
        '<div class="s">' + t('noHint', { url: ROOT + 'contact.html' }) + '</div>' +
        '</div>';
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

    // 先用字面快速通道給即時結果（模型還在下載時就是它在撐）
    literalHits(q).then(function (lit) {
      if (seq !== seqNo) return;
      if (lit.length) render(q, { results: lit });

      return semanticRanked(q).then(function (ranked) {
        if (seq !== seqNo) return;

        // 模型還沒就緒：維持字面結果；連字面也沒有就顯示「載入中」
        if (!ranked) {
          if (!lit.length) render(q, { results: [], pending: SEM.loading });
          else queueLog(q, lit.length);
          return;
        }

        // 兩道關卡：最高分要夠高，且只留與最高分接近的幾筆
        var best = ranked.length ? ranked[0].s : 0;
        var second = ranked.length > 1 ? ranked[1].s : 0;
        // 分數夠高就直接採用；只有「英文查詢、分數中段」才額外要求領先幅度
        var confident = best >= SEM.FLOOR ||
          (isLatinQuery(q) && best >= SEM.FLOOR_LATIN && (best - second) >= SEM.MIN_LEAD);
        var good = confident
          ? ranked.filter(function (x) { return x.s >= best - SEM.GAP; }).slice(0, SEM.max)
          : [];

        if (good.length) {
          // 字面命中的排在前面（使用者打的就是正式品名，那一定是他要的）
          var rows = lit.slice();
          var seen = {};
          rows.forEach(function (r) { seen[r.url + '|' + r.title] = true; });
          good.forEach(function (x) {
            var r = toRow(x.it, true);
            if (!seen[r.url + '|' + r.title]) rows.push(r);
          });
          render(q, { results: rows });
          queueLog(q, rows.length);
        } else if (lit.length) {
          render(q, { results: lit });
          queueLog(q, lit.length);
        } else {
          // 沒有夠像的：列出最接近的三筆，不給死路
          render(q, { results: [], suggestions: ranked.slice(0, 3).map(function (x) { return toRow(x.it, true); }) });
          queueLog(q, 0);
        }
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
      var q = (isEn() && tag.getAttribute('data-q-en')) || tag.getAttribute('data-q');
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
