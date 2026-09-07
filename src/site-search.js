/* ============================================================
   全站搜尋 — 臺灣營德（關鍵字版 / BM25）
   ------------------------------------------------------------
   取代原本的語意（向量）搜尋。原檔完整保留為
   src/site-search-vector-backup.js —— 要換回去只要把它改名蓋回來。

   為什麼換：
   向量搜尋的問題不在準度，在「判斷不出零」。實測分數裡
   亂碼 qqqqqq 0.824 比正解 ziplock 0.811 還高，所以沒有任何
   絕對門檻能分開對錯，只能靠「第一名是產品還是頁面」這種
   間接訊號 —— 也因此索引裡必須塞四筆用不到的頁面當基準線。

   BM25 沒有這個問題：查詢詞一個都沒中就是 0 筆。
   「產品中心沒有的東西就搜不到」是引擎的自然行為，不是調參調出來的。
   代價是同義詞要人工維護（D1 的 synonyms 表，一列一個別名掛在產品上），但品項只有 7 項、
   採購講的詞彙固定，而且 0 筆的搜尋已經寫進 Google Sheet，
   那張表就是補同義詞的清單。

   資料只有一份：Cloudflare D1 的 products 表（GET /api/products），
   跟產品中心頁與首頁的卡片同源。改資料庫，三邊一起變。
   索引裡沒有任何頁面文件 —— 搜尋範圍就是產品，沒有別的。

   介面（搜尋條、下拉面板、CSS、Ctrl+K、手機收合）與舊版完全相同，
   搜尋記錄也照樣送 Apps Script，換檔不會有視覺或資料差異。
   ============================================================ */
(function () {
  var inProducts = /\/products\//.test(location.pathname);
  var ROOT = inProducts ? '../' : '';

  function resolveUrl(u) {
    u = String(u || '');
    if (u.indexOf('@root:') === 0) return ROOT + u.slice(6);
    return (inProducts ? '' : 'products/') + u;
  }

  /* 點搜尋結果要跳到產品中心的哪一個區塊（沿用 search-records.js 的對照） */
  var ANCHORS = {
    '清潔袋': 'cat-can-liners', '拉繩袋': 'cat-draw-tape', '蔬果袋': 'cat-heat-bags',
    '夾鏈袋': 'cat-sealed-packaging', '手套': 'cat-gloves', '膠帶': 'cat-masking-film',
    'Scale Sheet': 'cat-stretch-films', 'Tare Sheet': 'cat-stretch-films'
  };
  function anchorFor(name) {
    var n = String(name || ''), keys = Object.keys(ANCHORS);
    for (var i = 0; i < keys.length; i++) if (n.indexOf(keys[i]) > -1) return '#' + ANCHORS[keys[i]];
    return '';
  }

  /* ============================================================
     同義詞 — 唯一需要人工維護的地方
     ------------------------------------------------------------
     資料在 D1 的 synonyms 表（GET /api/synonyms），由 ensureData()
     連同產品資料一起取回。

       product_id = 對應到哪個產品（外鍵，指向 products.id）
       say        = 客戶會打的別名（垃圾袋）

     一列就是「一個別名掛在一個產品上」。同一個別名可以掛給多個
     產品（塑膠袋 → 清潔袋、蔬果袋），就寫成兩列。

     為什麼掛 id 而不是打字寫對應詞：
     1) 產品改名時同義詞不會失效 —— 目標是 id，不是字面
     2) 編輯頁可以按產品分組（清潔袋底下列出它的別名），
        管理的人不必讀一張沒有分類的長清單
     3) 命中後注入的是「該產品自己的品名」，不可能打錯字

     查詢時「附加」而非「取代」，所以打正式品名不會被影響。
     新增方式：看搜尋紀錄裡「0 筆」的字，在該產品底下補一個別名。

     刻意不在這裡放一份備援表 —— 那會變成兩個正確答案。
     API 拿不到時搜尋照常運作，只是少了別名擴展。
     ============================================================ */
  var SYN = {};        // { 別名: [product_id, ...] }
  var ROW_BY_ID = {};  // { product_id: 產品資料列 }

  /** 別名命中後要注入的詞 —— 直接取該產品的品名，不是人手打的對應詞 */
  function targetTokens(pid) {
    var row = ROW_BY_ID[pid];
    if (!row) return [];
    return tokenize([row.name, row.name_en].join(' '));
  }

  /* 額外索引文字的掛勾：規格資料（尺寸／號數／容量）目前不在 repo 裡，
     等 spec 資料回來時，把 { name: '清潔袋', text: '86x100 0號 45L …' }
     推進 window.OM_SEARCH_EXTRA，就會併進該產品的索引。 */
  var EXTRA = window.OM_SEARCH_EXTRA || [];

  /* ---------- 斷詞 ---------- */
  function normText(s) {
    return String(s || '').toLowerCase()
      .replace(/[\uFF01-\uFF5E]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); })
      .replace(/[\s\u3000、，,。．.\-_/（）()「」【】·:：;；!！?？"'`~]+/g, ' ')
      .trim();
  }

  /** 中文切成單字＋雙字組（雙字組是主力，單字補召回）；英數字整串為一詞 */
  function tokenize(s) {
    var out = [], norm = normText(s), m;
    var latin = norm.match(/[a-z0-9]+/g) || [];
    for (m = 0; m < latin.length; m++) out.push(latin[m]);
    var runs = norm.match(/[\u4e00-\u9fff]+/g) || [];
    runs.forEach(function (run) {
      for (var i = 0; i < run.length; i++) {
        out.push(run[i]);
        if (i + 1 < run.length) out.push(run.substr(i, 2));
      }
    });
    return out;
  }

  /** 單一中文字的訊號比雙字組弱很多，查詢時降權，否則「袋」會把七項全撈出來 */
  function termWeight(t) {
    if (/^[\u4e00-\u9fff]$/.test(t)) return 0.3;
    if (/^[a-z0-9]$/.test(t)) return 0.2;
    return 1;
  }

  /* ============================================================
     資料自動載入 — 一律向 D1 要（GET /api/products）
     ------------------------------------------------------------
     五個頁面都不必先載入產品資料，本檔第一次要用時自己去拿。
     （原本是動態注入 src/data/products-data.js 的快照，資料已全部
       移到 D1，那支檔案不再存在。）
     ============================================================ */
  var ROWS = [];
  var dataReady = null;

  function getJson(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error(path + ' 狀態錯誤: ' + res.status);
      return res.json();
    });
  }

  function ensureData() {
    if (dataReady) return dataReady;

    /* 同義詞失敗不該讓整個搜尋停擺，所以各自 catch。
       產品資料是必要的，同義詞是加分的。 */
    var products = getJson('/api/products').catch(function (err) {
      if (window.console) console.error('[搜尋] 無法從 API 取得產品資料：', err);
      return [];
    });
    var synonyms = getJson('/api/synonyms').catch(function (err) {
      if (window.console) console.warn('[搜尋] 無法取得同義詞，僅以正式品名比對：', err.message);
      return [];
    });

    dataReady = Promise.all([products, synonyms]).then(function (r) {
      ROWS = Array.isArray(r[0]) ? r[0] : [];

      ROW_BY_ID = {};
      ROWS.forEach(function (row) { ROW_BY_ID[String(row.id)] = row; });

      SYN = {};
      (Array.isArray(r[1]) ? r[1] : []).forEach(function (row) {
        var say = String(row.say == null ? '' : row.say).trim();
        var pid = String(row.product_id == null ? '' : row.product_id).trim();
        if (!say || !pid) return;
        /* 指向已不存在的產品時直接略過（產品刪了、同義詞還在） */
        if (!ROW_BY_ID[pid]) return;
        (SYN[say] = SYN[say] || []).push(pid);
      });

      return !!ROWS.length;
    });
    return dataReady;
  }

  /* ---------- 建索引 ---------- */
  var FIELDS = [['title', 4], ['items', 2.5], ['highlight', 1.5], ['desc', 1]];
  /* 把某個欄位的所有語言版本併成一個字串。
     API 回傳的鍵是 name（繁中）、name_en、name_ja…
     —— 加語言時 API 會自己多出 name_ja 這種鍵，這裡不必改。

     索引不分語言：客戶打中文、英文、日文都是查同一份，
     所以搜尋框在哪個語言版面都能找到東西。 */
  function allLangs(row, field) {
    var out = [];
    var prefix = field + '_';
    Object.keys(row).forEach(function (key) {
      if (key === field || key.indexOf(prefix) === 0) {
        var v = row[key];
        if (v) out.push(String(v));
      }
    });
    return out.join(' ');
  }

  var IDX = null;

  function buildIndex() {
    if (IDX) return IDX;
    var raw = ROWS;
    if (!raw.length) return null;

    var docs = raw.map(function (p, i) {
      var names = String(p.name || '').split('/').map(function (s) { return s.trim(); }).filter(Boolean);
      var main = names[0] || '';
      var extra = EXTRA.filter(function (e) { return String(e.name || '') === main; })
                       .map(function (e) { return e.text || ''; }).join(' ');
      return {
        id: i,
        title: main,
        title_en: (p.name_en || '').split('/')[0].trim() || main,
        desc: p.highlight || p.desc || '',
        desc_en: p.highlight_en || p.desc_en || '',
        items: splitList(p.items),
        items_en: splitList(p.items_en),
        icon: 'fa-box-open',
        url: resolveUrl('@root:products/index.html' + anchorFor(p.name)),
        f: {
          title: [main, names.slice(1).join(' '), allLangs(p, 'name')].join(' '),
          items: allLangs(p, 'items'),
          highlight: allLangs(p, 'highlight'),
          desc: [allLangs(p, 'desc'), extra].join(' ')
        }
      };
    });

    var df = {}, avg = 0;
    docs.forEach(function (d) {
      var tf = {}, len = 0;
      FIELDS.forEach(function (pair) {
        var w = pair[1];
        tokenize(d.f[pair[0]]).forEach(function (t) {
          tf[t] = (tf[t] || 0) + w;
          len += w;
        });
      });
      d.tf = tf;
      d.len = len;
      avg += len;
      Object.keys(tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
    });
    avg = avg / docs.length;

    IDX = { docs: docs, df: df, avg: avg, N: docs.length, vocab: Object.keys(df) };
    return IDX;
  }

  function splitList(s) {
    return String(s || '').split(/[、,，/]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  /* ---------- 查詢 ---------- */
  var K1 = 1.2, B = 0.6;

  /** 英文錯字容錯：編輯距離 ≤1 才換，避免 tape → tare 這種亂配 */
  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 9;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur.slice();
    }
    return prev[b.length];
  }

  function expandQuery(q) {
    var norm = normText(q);
    var terms = {};
    function add(t, w) { terms[t] = Math.max(terms[t] || 0, w); }

    tokenize(q).forEach(function (t) { add(t, termWeight(t)); });

    // 別名：整段查詢字裡出現別名，就把該產品的品名加進來
    Object.keys(SYN).forEach(function (key) {
      if (norm.indexOf(normText(key)) === -1) return;
      SYN[key].forEach(function (pid) {
        targetTokens(pid).forEach(function (t) { add(t, termWeight(t) * 0.95); });
      });
    });

    // 英文錯字：查詢詞不在字典裡時找距離 1 的替代（ziplok → ziplock）
    var idx = buildIndex();
    if (idx) {
      Object.keys(terms).forEach(function (t) {
        if (!/^[a-z]{4,}$/.test(t) || idx.df[t]) return;
        for (var i = 0; i < idx.vocab.length; i++) {
          var v = idx.vocab[i];
          if (/^[a-z]{4,}$/.test(v) && editDistance(t, v) <= 1) { add(v, 0.8); break; }
        }
        // 別名本身也容錯一次（ziplok → ziplock → 夾鏈袋）
        Object.keys(SYN).forEach(function (key) {
          if (!/^[a-z ]+$/.test(key) || editDistance(t, key) > 1) return;
          SYN[key].forEach(function (pid) {
            targetTokens(pid).forEach(function (x) { add(x, termWeight(x) * 0.75); });
          });
        });
      });
    }
    return terms;
  }

  function search(query) {
    var idx = buildIndex();
    if (!idx || !String(query || '').trim()) return [];
    var terms = expandQuery(query);
    var keys = Object.keys(terms);
    if (!keys.length) return [];

    /* 只靠單一中文字命中的不算數 —— 「工廠在哪」的「廠」會撈到「新港廠區」，
       但客戶並不是在找產品。要求至少一個雙字組（或英數字詞）對上，
       零筆才會是真的零筆。查詢本身就只有一個字時（「袋」）才放寬。 */
    var hasMulti = keys.some(function (t) { return t.length > 1; });

    var hits = [];
    idx.docs.forEach(function (d) {
      var score = 0, matched = [], solid = false;
      keys.forEach(function (t) {
        var tf = d.tf[t];
        if (!tf) return;
        var n = idx.df[t];
        var idf = Math.log(1 + (idx.N - n + 0.5) / (n + 0.5));
        score += terms[t] * idf * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * d.len / idx.avg));
        matched.push(t);
        if (t.length > 1) solid = true;
      });
      if (score > 0 && (solid || !hasMulti)) hits.push({ d: d, s: score, matched: matched });
    });

    hits.sort(function (a, b) { return b.s - a.s; });
    // 只留與第一名同一個量級的：BM25 的尾巴通常是「只中一個單字」的雜訊
    var top = hits.length ? hits[0].s : 0;
    return hits.filter(function (h) { return h.s >= top * 0.28; }).slice(0, 6);
  }

  /* 這一筆是靠哪個細項對上的？（打「市場袋」→ 蔬果袋，標「符合：市場袋」）
     打的就是正式品名時不標 —— 標了是廢話。 */
  function matchedItem(hit, query) {
    var q = normText(query).replace(/ /g, '');
    if (!q) return null;
    var d = hit.d;
    if (normText(d.title).indexOf(q) > -1 || normText(d.title_en).indexOf(q) > -1) return null;

    var en = isEn();
    var list = d.items, listEn = d.items_en;
    var i;
    // 先找整段字面命中的細項
    for (i = 0; i < list.length; i++) {
      if (normText(list[i]).replace(/ /g, '').indexOf(q) > -1) return en ? (listEn[i] || list[i]) : list[i];
    }
    for (i = 0; i < listEn.length; i++) {
      if (normText(listEn[i]).replace(/ /g, '').indexOf(q) > -1) return en ? listEn[i] : (list[i] || listEn[i]);
    }
    // 再找同義詞導過來的細項（保鮮袋 → 冷凍袋）
    var terms = hit.matched;
    for (i = 0; i < list.length; i++) {
      var toks = tokenize(list[i]).filter(function (t) { return t.length > 1; });
      for (var k = 0; k < toks.length; k++) {
        if (terms.indexOf(toks[k]) > -1 && normText(d.title).indexOf(toks[k]) === -1) {
          return en ? (listEn[i] || list[i]) : list[i];
        }
      }
    }
    return null;
  }

  /** 敘述裡把命中的詞標起來 */
  function highlight(text, terms) {
    var out = esc(text);
    var words = terms.filter(function (t) { return t.length > 1; })
                     .sort(function (a, b) { return b.length - a.length; })
                     .slice(0, 8);
    words.forEach(function (w) {
      var re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(re, function (m) { return '\u0001' + m + '\u0002'; });
    });
    return out.split('\u0001').join('<mark>').split('\u0002').join('</mark>');
  }

  function toRow(hit, query) {
    var d = hit.d, en = isEn();
    var desc = (en && d.desc_en) ? d.desc_en : d.desc;
    return {
      title: (en && d.title_en) ? d.title_en : d.title,
      icon: d.icon,
      url: d.url,
      tag: matchedItem(hit, query) || '',
      snippet: highlight(desc, hit.matched)
    };
  }

  /* ============================================================
     搜尋記錄 — 送到 Apps Script（同一支 /exec，action=search）
     0 筆的那些就是新產品／新同義詞的線索。
     ============================================================ */
  var LOG_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz1hF2WW-easWE11AHvlnzvOXMG8qDSElR_IYcVx6vj0TWoXHrA-Mzuu78qcTJS7GMX/exec';
  var logTimer = null, logged = {};

  function logSearch(query, hits) {
    var q = String(query || '').trim();
    if (!LOG_ENDPOINT || q.length < 2) return;
    var key = q.toLowerCase();
    if (logged[key]) return;
    logged[key] = true;
    var body = new URLSearchParams({
      action: 'search', q: q, hits: String(hits),
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

  /* ---------- 介面（與 site-search.js 相同） ---------- */
  var EXTRA_CSS = `
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
  /* nowrap：面板在窄螢幕會縮到 300px 以下，沒有這條「垃圾袋」會被折成「垃圾／袋」。
     膠囊之間本來就會換行，折在詞中間才是壞的。 */
  .om-tag { background: #FFFFFF; border: 1px solid #CBD5E1; color: #334155; font-size: 0.76rem; font-weight: 700;
    padding: 4px 10px; border-radius: 9999px; white-space: nowrap; cursor: pointer; }
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
  .om-result-tag { display: flex; align-items: center; gap: 5px; margin-top: 6px;
    font-size: 0.72rem; font-weight: 600; color: #94A3B8; }
  .om-result-tag b { font-weight: 800; color: #00529B; background: #EFF6FF; padding: 1px 7px; border-radius: 5px; }
  .om-empty { padding: 28px 18px; text-align: center; color: #64748B; }
  .om-empty .t { font-size: 0.92rem; font-weight: 800; color: #0A2540; margin-bottom: 6px; }
  .om-empty .s { font-size: 0.8rem; }
  .om-empty a { color: #00529B; font-weight: 800; }

  @media (max-width: 1400px) {
    .om-searchbar { width: 150px; }
    .om-searchbar:focus-within { width: 220px; }
  }
  @media (max-width: 1024px) {
    .om-searchbar, .om-searchbar:focus-within { width: 100%; margin: 0; }
    .om-panel { width: 100%; right: auto; left: 0; }
  }
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
  function isEn() { return (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0; }

  var T = {
    hot:      ['熱門：', 'Popular:'],
    noResult: ['找不到與「{q}」相符的產品', 'No results for “{q}”'],
    noHint:   ['我們的品項持續增加中，歡迎<a href="{url}">直接與專員聯繫</a>詢問。',
               'Our range keeps growing — <a href="{url}">contact our team</a> and we will help.'],
    matched:  ['符合：', 'Matched:\u00a0'],
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
    ensureData();
    var lbl = document.getElementById('omHotLabel');
    if (lbl) lbl.textContent = t('hot');
  }
  function closePanel() {
    var p = document.getElementById('omSearchPanel');
    if (p) p.classList.remove('active');
  }

  function resultRow(x) {
    return '<a class="om-result" href="' + x.url + '">' +
      '<span class="om-result-icon"><i class="fa-solid ' + x.icon + '"></i></span>' +
      '<span class="om-result-info">' +
        '<span class="om-result-title">' + esc(x.title) + '</span>' +
        '<span class="om-result-desc">' + x.snippet + '</span>' +
        (x.tag ? '<span class="om-result-tag">' + t('matched') + '<b>' + esc(x.tag) + '</b></span>' : '') +
      '</span>' +
    '</a>';
  }

  /* 純 JS 引擎，查詢是同步的，不需要防抖與序號競態處理 */
  function render(query) {
    var list = document.getElementById('omSearchList');
    if (!list) return;
    var q = (query || '').trim();
    if (!q) { list.innerHTML = ''; return; }

    if (!buildIndex()) {
      list.innerHTML = '<div class="om-empty"><div class="s">' + t('loading') + '</div></div>';
      ensureData().then(function () {
        var input = document.getElementById('omSearchInput');
        if (input && input.value.trim() === q && buildIndex()) render(q);
      });
      return;
    }

    var hits = search(q);
    if (!hits.length) {
      list.innerHTML = '<div class="om-empty">' +
        '<div class="t">' + t('noResult', { q: esc(q) }) + '</div>' +
        '<div class="s">' + t('noHint', { url: ROOT + 'contact.html' }) + '</div>' +
        '</div>';
      queueLog(q, 0);
      return;
    }
    list.innerHTML = hits.map(function (h) { return resultRow(toRow(h, q)); }).join('');
    queueLog(q, hits.length);
  }

  window.openSearchModal = function () {
    ensureUI();
    var i = document.getElementById('omSearchInput');
    if (!i) return;
    openPanel();
    i.focus();
  };
  window.closeSearchModal = closePanel;
  /* 頁首是動態注入的情境（navbar.js 晚於本檔）可再呼叫一次 */
  window.OM_SEARCH_INIT = ensureUI;
  window.OM_SEARCH_QUERY = search;

  document.addEventListener('click', function (e) {
    var el = e.target;
    var bar = document.getElementById('omSearchBar');
    if (bar && !bar.contains(el)) {
      closePanel();
      var inp = document.getElementById('omSearchInput');
      if (!inp || !inp.value) bar.classList.remove('is-open');
    }
    var tag = el.closest && el.closest('.om-tag');
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
