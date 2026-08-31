/* ============================================================
   全站搜尋 — 臺灣營德
   ------------------------------------------------------------
   單一引擎：語意搜尋（向量）。結果只給產品。

   頁面（關於／永續／聯絡／產品中心）仍在索引裡，但不顯示：
   它們是亂碼偵測的基準線 —— 亂碼跟哪個產品都不像，只會貼上泛用的頁面文字，
   所以「第一名是頁面還是產品」比絕對分數可靠。把頁面從索引拿掉，這道門檻就失效。
   又因為它們永遠不會被看見，PAGE_DOCS 的文字跟實際頁面同不同步也不重要。
   頁首導覽列本來就有這四個頁面，沒人會打字去搜一題看得見的按鈕。

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

   命中細項時（打「市場袋」而品名是「蔬果袋」），結果會在敘述下方
   多一行「符合：市場袋」說明為什麼這筆會出現 —— 字面命中直接知道，
   語意命中則靠 embeddings.json 裡每個細項各自的小向量比出來。

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
        data.items.forEach(function (it) {
          it.vecf = decodeVec(it.vecb64);
          (it.tags || []).forEach(function (tg) {
            if (tg.vecb64) tg.vecf = decodeVec(tg.vecb64);
          });
        });
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

  /** 命中的細項要顯示成使用者當下的語言 */
  function tagLabel(tag) {
    if (!tag) return '';
    return isEn() ? (tag.t_en || tag.t || '') : (tag.t || '');
  }

  function toRow(it, semantic, tag) {
    return {
      title: (isEn() && it.title_en) ? it.title_en : it.title,
      tag: tagLabel(tag),
      icon: it.icon || 'fa-cube',
      desc: (isEn() && it.desc_en) ? it.desc_en : (it.desc || ''),
      url: resolveUrl(it.url),
      snippet: (isEn() && it.desc_en) ? it.desc_en : (it.desc || ''),
      semantic: !!semantic
    };
  }

  /** 字面命中的細項：整段查詢字出現在細項裡（中英文都比） */
  function literalTag(it, q) {
    var tags = it.tags || [];
    for (var i = 0; i < tags.length; i++) {
      if (normText(tags[i].t).indexOf(q) > -1 || normText(tags[i].t_en).indexOf(q) > -1) return tags[i];
    }
    return null;
  }

  /** 字面包含：標題最高，細項次之，敘述最低 */
  function literalHits(query) {
    return loadDB().then(function (items) {
      if (!items) return [];
      var q = normText(query);
      if (q.length < 2) return [];
      var scored = [];
      items.forEach(function (it) {
        if (it.type !== 'product') return;   // 頁面只當基準線，不進結果
        var title = normText(it.title) + ' ' + normText(it.title_en) + ' ' + normText(it.category);
        var body = normText(it.desc) + ' ' + normText(it.desc_en);
        var tag = literalTag(it, q);
        var s = 0;
        if (title.indexOf(q) > -1) s = 10;
        else if (tag) s = 8;
        else if (body.indexOf(q) > -1) s = 4;
        // 打的就是正式品名時不標細項 —— 標了是廢話
        if (s) scored.push({ it: it, s: s, tag: s === 10 ? null : tag });
      });
      scored.sort(function (a, b) { return b.s - a.s; });
      return scored.map(function (x) { return toRow(x.it, false, x.tag); });
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
    // 去重只看查詢字串：同一個查詢會因為模型晚到而渲染兩次（先字面、後語意），
    // 筆數不同但那是同一次搜尋，不該記成兩列
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
  /* 門檻怎麼定的（都是實測數據）：

     e5 的絕對分數壓縮得很高，光看分數分不出對錯：
       「垃圾袋」→ 清潔袋 0.873、拉繩袋 0.861（對的只贏 0.012）
     而英文查詢對中文為主的資料，分數整體再低一截：
       「ziplock」→ 夾鏈袋 0.811（明明是正解，卻不到 0.83）

     真正可靠的訊號是「第一名是產品還是頁面」：
       ziplock 0.811、can liner 0.813、gloves 0.822、produce bag 0.848
         → 第一名都是產品
       qqqqqq 0.824、xyzxyz 0.805、zzz 0.795、hello world 0.783
         → 第一名都是頁面（亂碼跟哪個產品都不像，只會貼上泛用的頁面文字）
     所以：分數夠高就直接採用；分數中段時，要求第一名是產品、
     且贏過最高分的頁面，才算命中。

     GAP 只留與第一名接近的幾筆，其餘視為雜訊。 */
  var SEM = {
    ready: false,
    loading: false,
    extractor: null,
    FLOOR: 0.83,
    PAGE_LEAD: 0.005,
    GAP: 0.02,
    GAP_LATIN: 0.012,   // 英文的分數分布較密，範圍要收窄才不會夾帶雜訊
    TAG_LEAD: 0,        // 細項要贏過整筆多少才算「就是它命中的」（0 = 只要贏就算）
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

  /** 全部排序後回傳 { scored, qv }，門檻交給呼叫端決定。
      qv 一併回傳，讓呼叫端可以再比一次細項向量。 */
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
        return { scored: scored, qv: qv };
      })
      .catch(function () { return null; });
  }

  /** 這一筆是「靠哪個細項」對上的？
      判準不用魔術數字：只有當某個細項比整筆記錄本身還像查詢時，
      才代表使用者打的是那個細項（打「市場袋」→ 市場袋 0.95 > 蔬果袋整筆 0.87）。
      打「gloves」時手套整筆最高、細項（無粉末…）都比不過，就不會亂標。 */
  function bestTag(it, qv, itemScore) {
    var tags = it.tags || [];
    var best = null, bestS = itemScore + SEM.TAG_LEAD;
    for (var i = 0; i < tags.length; i++) {
      if (!tags[i].vecf) continue;
      var s = 0;
      for (var k = 0; k < qv.length; k++) s += qv[k] * tags[i].vecf[k];
      if (s > bestS) { bestS = s; best = tags[i]; }
    }
    return best;
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
  /* 命中細項的註腳：跟著敘述走（手機也看得到），沒命中就整行不存在。
     比 desc 再輕一級，一行結果只留一個重點。 */
  .om-result-tag { display: flex; align-items: center; gap: 5px; margin-top: 6px;
    font-size: 0.72rem; font-weight: 600; color: #94A3B8; }
  .om-result-tag b { font-weight: 800; color: #00529B; background: #EFF6FF; padding: 1px 7px; border-radius: 5px; }
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
    loading:  ['搜尋中…', 'Searching…'],
    matched:  ['符合：', 'Matched:\u00a0']
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
        (x.tag ? '<span class="om-result-tag">' + t('matched') + '<b>' + esc(x.tag) + '</b></span>' : '') +
      '</span>' +
    '</a>';
  }

  function runQuery(q, seq) {
    if (seq !== seqNo) return;

    // 先用字面快速通道給即時結果（模型還在下載時就是它在撐）
    literalHits(q).then(function (lit) {
      if (seq !== seqNo) return;
      if (lit.length) render(q, { results: lit });

      return semanticRanked(q).then(function (res) {
        if (seq !== seqNo) return;

        // 模型還沒就緒：維持字面結果；連字面也沒有就顯示「載入中」
        if (!res) {
          if (!lit.length) render(q, { results: [], pending: SEM.loading });
          else queueLog(q, lit.length);
          return;
        }

        var ranked = res.scored, qv = res.qv;

        // 兩道關卡：最高分要夠高，且只留與最高分接近的幾筆
        var best = ranked.length ? ranked[0].s : 0;
        var topIsProduct = ranked.length && ranked[0].it.type === 'product';
        var bestPage = 0;
        ranked.forEach(function (x) { if (x.it.type !== 'product' && x.s > bestPage) bestPage = x.s; });

        var confident = best >= SEM.FLOOR ||
          (topIsProduct && (best - bestPage) >= SEM.PAGE_LEAD);

        var gap = isLatinQuery(q) ? SEM.GAP_LATIN : SEM.GAP;
        var good = confident
          ? ranked.filter(function (x) { return x.it.type === 'product' && x.s >= best - gap; }).slice(0, SEM.max)
          : [];

        if (good.length) {
          // 字面命中的排在前面（使用者打的就是正式品名，那一定是他要的）
          var rows = lit.slice();
          var seen = {};
          rows.forEach(function (r) { seen[r.url + '|' + r.title] = true; });
          good.forEach(function (x) {
            var r = toRow(x.it, true, bestTag(x.it, qv, x.s));
            if (!seen[r.url + '|' + r.title]) rows.push(r);
          });
          render(q, { results: rows });
          queueLog(q, rows.length);
        } else if (lit.length) {
          render(q, { results: lit });
          queueLog(q, lit.length);
        } else {
          // 沒有夠像的：列出最接近的三筆產品，不給死路。
          // 這裡不標細項 —— 它們是「最接近的」，不是命中。
          var near = ranked.filter(function (x) { return x.it.type === 'product'; }).slice(0, 3);
          render(q, { results: [], suggestions: near.map(function (x) { return toRow(x.it, true, null); }) });
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
