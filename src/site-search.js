/* ============================================================
   全站全文檢索 (Site Full-Text Search) — 台灣營德
   ------------------------------------------------------------
   資料來源：src/data/website-data.js（window.SITE_DATA）— 由 website-data.xlsx 轉出。
   同義詞字典在 Excel 的「搜尋同義詞」工作表，規格內文取自「產品規格」工作表。
   本檔只負責「索引 + 檢索 + 介面」。

   檢索方式（非 Ctrl+F 子字串比對）：
   1) 建立倒排索引：中文切單字＋雙字組、英數切詞，欄位加權
      （品名 8 / 關鍵字 5 / 分類 3 / 說明 2 / 規格內文 1）
   2) BM25 排序（含文件長度正規化），多詞查詢按命中覆蓋率加成
   3) 同義詞擴充：垃圾袋 → 清潔袋、束口袋 → 拉繩袋、保鮮袋 → 冷凍袋…
   4) 錯字容錯：查不到的詞用雙字組相似度／編輯距離找最近的索引詞
   5) 命中規格內文時，結果直接顯示該段規格片段（全文檢索的證據）
   ============================================================ */
(function () {
  var DATA = (window.SITE_DATA && window.SITE_DATA.search) || { variants: {}, synonyms: [], docs: [] };
  var inProducts = /\/products\//.test(location.pathname);
  var P = inProducts ? '' : 'products/';
  var R = inProducts ? '../' : '';

  function resolveUrl(u) {
    return u.indexOf('@root:') === 0 ? R + u.slice(6) : P + u;
  }

  /* ---------- 正規化 ---------- */
  var VARIANTS = DATA.variants || {};
  function normalize(s) {
    if (!s) return '';
    s = String(s).toLowerCase();
    s = s.replace(/[\uff01-\uff5e]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); });
    s = s.replace(/\u3000/g, ' ');
    Object.keys(VARIANTS).forEach(function (k) { s = s.split(k).join(VARIANTS[k]); });
    return s;
  }
  var CJK = /[\u3400-\u9fff\uf900-\ufaff]/;

  /* ---------- 切詞：中文單字＋雙字組，英數整詞 ---------- */
  function tokenize(text) {
    var s = normalize(text);
    var out = [], runs = s.match(/[\u3400-\u9fff\uf900-\ufaff]+|[a-z0-9][a-z0-9.]*/g) || [];
    runs.forEach(function (run) {
      if (CJK.test(run)) {
        for (var i = 0; i < run.length; i++) {
          out.push(run[i]);
          if (i < run.length - 1) out.push(run.slice(i, i + 2));
        }
      } else {
        out.push(run);
        var num = run.match(/^(\d+(?:\.\d+)?)([a-z]+)$/); // 45l → 45 + l
        if (num) { out.push(num[1]); out.push(num[2]); }
        // 尺寸寫法 86x100 / 34*45 → 拆成兩個數字，才能對到「寬 86 × 長 100」
        var dim = run.split(/[x*×]/).filter(function (p) { return /^\d+(\.\d+)?$/.test(p); });
        if (dim.length > 1) dim.forEach(function (p) { out.push(p); });
      }
    });
    return out;
  }

  /* ---------- 相似度 ---------- */
  function bigrams(s) {
    var out = [];
    if (s.length < 2) return s ? [s] : out;
    for (var i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  }
  function diceSim(a, b) {
    var A = bigrams(a), B = bigrams(b);
    if (!A.length || !B.length) return a === b ? 1 : 0;
    var map = {}, hit = 0;
    A.forEach(function (g) { map[g] = (map[g] || 0) + 1; });
    B.forEach(function (g) { if (map[g] > 0) { map[g]--; hit++; } });
    return (2 * hit) / (A.length + B.length);
  }
  function editDistance(a, b) {
    var m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    if (Math.abs(m - n) > 2) return 9;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur.slice();
    }
    return prev[n];
  }

  /* ---------- 建索引 ---------- */
  var FIELD_W = { title: 8, keywords: 5, category: 3, desc: 2, body: 1 };
  // 規格內文改由規格資料（Excel → website-data.js）即時組成，Excel 改了搜尋也跟著變
  var SPEC_TEXT = (function () {
    var map = {};
    var rows = window.SITE_MAP ? window.SITE_MAP.specs() : [];
    rows.forEach(function (r) {
      var bits = [r.series, r.spec, r.dim, r.qty,
                  r.colors.map(function (c) { return c.name; }).join(' ')].filter(Boolean);
      map[r.series] = (map[r.series] || '') + ' ' + bits.join(' ');
    });
    return map;
  })();

  var docs = (DATA.docs || []).map(function (d, i) {
    return {
      id: i, title: d.title, category: d.category, icon: d.icon || 'fa-cube',
      desc: d.desc || '',
      body: (function () {
        var live = SPEC_TEXT[d.title] || '';
        return live ? ((d.body || '') + ' ' + live) : (d.body || '');
      })(),
      keywords: d.keywords || [],
      url: resolveUrl(d.url), nTitle: normalize(d.title)
    };
  });

  var GENERIC = { '聯繫我們': 1, '關於我們': 1, '永續發展': 1, '產品': 1 };
  var index = {};   // term → [{id, tf}]
  var docLen = {};  // id → 加權長度
  var avgLen = 0;

  docs.forEach(function (d) {
    var fields = {
      title: d.title, keywords: d.keywords.join(' '),
      category: d.category, desc: d.desc, body: d.body
    };
    var bag = {}, len = 0;
    Object.keys(fields).forEach(function (f) {
      var w = FIELD_W[f];
      tokenize(fields[f]).forEach(function (t) {
        bag[t] = (bag[t] || 0) + w;
        len += w;
      });
    });
    docLen[d.id] = len;
    avgLen += len;
    Object.keys(bag).forEach(function (t) {
      (index[t] || (index[t] = [])).push({ id: d.id, tf: bag[t] });
    });
  });
  avgLen = avgLen / (docs.length || 1);
  var TERMS = Object.keys(index);
  var N = docs.length;

  function idf(term) {
    var df = index[term] ? index[term].length : 0;
    return Math.log(1 + (N - df + 0.5) / (df + 0.5));
  }

  /* ---------- 同義詞 ---------- */
  var SYN = [];
  (DATA.synonyms || []).forEach(function (g) {
    (g.say || []).forEach(function (say) { SYN.push({ key: normalize(say).replace(/\s+/g, ''), raw: say, mean: g.mean || [] }); });
  });

  function expandQuery(nq) {
    var flat = nq.replace(/\s+/g, ''), hits = [];
    SYN.forEach(function (e) {
      if (!e.key) return;
      if (flat.indexOf(e.key) > -1 || e.key === flat || diceSim(flat, e.key) >= 0.82) {
        e.mean.forEach(function (m) { if (hits.indexOf(m) < 0) hits.push(m); });
      }
    });
    return hits;
  }

  /* ---------- 錯字容錯：找最接近的索引詞 ---------- */
  function fuzzyTerms(t) {
    var out = [], best = 0;
    var isLatin = /^[a-z0-9.]+$/.test(t);
    if (t.length < 2) return out;
    for (var i = 0; i < TERMS.length; i++) {
      var c = TERMS[i], sim = 0;
      if (isLatin) {
        if (!/^[a-z0-9.]+$/.test(c) || Math.abs(c.length - t.length) > 2) continue;
        var d = editDistance(t, c);
        if (d <= (t.length >= 5 ? 2 : 1)) sim = 1 - d / Math.max(t.length, c.length);
      } else {
        if (c.length !== t.length) continue;
        sim = diceSim(t, c);
      }
      if (sim >= 0.5) { out.push({ term: c, sim: sim }); if (sim > best) best = sim; }
    }
    out.sort(function (a, b) { return b.sim - a.sim; });
    return out.slice(0, 6);
  }

  /* ---------- 檢索 ---------- */
  var k1 = 1.3, b = 0.35;

  function search(query) {
    var nq = normalize(query || '').trim();
    if (!nq) {
      return { results: docs.map(function (d) { return { item: d, score: 1, why: '', snippet: d.desc }; }), suggestions: [], expanded: [] };
    }
    var expanded = expandQuery(nq);
    var qTokens = tokenize(nq);
    // 同義詞對應到的品名也加入查詢（權重較高）
    var weighted = {};
    // 單一中文字（袋、清…）雜訊高，權重壓低；雙字組與英數詞才是主力
    function baseW(t) { return (t.length === 1 && CJK.test(t)) ? 0.3 : 1; }
    qTokens.forEach(function (t) { weighted[t] = Math.max(weighted[t] || 0, baseW(t)); });
    expanded.forEach(function (m) {
      tokenize(m).forEach(function (t) { weighted[t] = Math.max(weighted[t] || 0, baseW(t) * 0.9); });
    });

    var scores = {}, matchedTokens = {}, synHit = {};
    var uniq = Object.keys(weighted);

    uniq.forEach(function (t) {
      var qw = weighted[t];
      var postings = index[t];
      var factor = 1;
      if (!postings) {                       // 錯字 → 用相近的索引詞
        var alts = fuzzyTerms(t);
        if (!alts.length) return;
        alts.forEach(function (a) {
          (index[a.term] || []).forEach(function (p) {
            addScore(t, p, idf(a.term), qw * a.sim * 0.75);
          });
        });
        return;
      }
      postings.forEach(function (p) { addScore(t, p, idf(t), qw * factor); });
    });

    function addScore(token, p, termIdf, qw) {
      var L = docLen[p.id] || 1;
      var tfNorm = (p.tf * (k1 + 1)) / (p.tf + k1 * (1 - b + b * (L / avgLen)));
      scores[p.id] = (scores[p.id] || 0) + termIdf * tfNorm * qw;
      (matchedTokens[p.id] || (matchedTokens[p.id] = {}))[token] = true;
    }

    // 同義詞命中的品名，記下來給提示用（字典中列在前面的視為更主要的對應）
    expanded.forEach(function (m, mi) {
      var nm = normalize(m);
      docs.forEach(function (d) {
        if (d.nTitle === nm || d.nTitle.indexOf(nm) > -1 || nm.indexOf(d.nTitle) > -1) {
          scores[d.id] = (scores[d.id] || 0) + 6 + 3 / (mi + 1);
          synHit[d.id] = d.title;
        }
      });
    });

    // 整串完全出現在品名／內文 → 片語加成
    var flat = nq.replace(/\s+/g, '');
    docs.forEach(function (d) {
      if (flat.length < 2) return;
      if (d.nTitle.indexOf(flat) > -1) scores[d.id] = (scores[d.id] || 0) + 10;
      else if (normalize(d.body).indexOf(flat) > -1) scores[d.id] = (scores[d.id] || 0) + 3;
    });

    var meaningful = qTokens.filter(function (t) { return t.length >= 2 && !(t.length === 1); });
    if (!meaningful.length) meaningful = qTokens.slice(0, 1);
    var need = Math.max(1, meaningful.length);

    var out = [];
    Object.keys(scores).forEach(function (id) {
      var d = docs[id];
      var cov = Object.keys(matchedTokens[id] || {}).length / need;
      var score = scores[id] * (0.55 + 0.45 * Math.min(1, cov));
      // 非產品頁（聯絡、關於、永續、產品中心）不與產品爭排名，除非查的就是它們
      if (GENERIC[d.category]) score *= 0.6;
      if (score < 0.6) return;
      out.push({ item: d, score: score, why: synHit[id] || '', snippet: snippetFor(d, flat, qTokens) });
    });
    out.sort(function (a, b) { return b.score - a.score; });

    // 門檻：與最高分差距過大的雜訊剔除
    if (out.length > 3) {
      var top = out[0].score;
      out = out.filter(function (r) { return r.score >= top * 0.12; });
    }

    var suggestions = [];
    if (!out.length) {
      var pool = [];
      docs.forEach(function (d) { pool.push({ t: d.title, sim: diceSim(flat, d.nTitle) }); });
      SYN.forEach(function (e) { if (e.mean[0]) pool.push({ t: e.mean[0], sim: diceSim(flat, e.key) }); });
      pool.sort(function (a, b) { return b.sim - a.sim; });
      pool.forEach(function (p) { if (suggestions.length < 3 && suggestions.indexOf(p.t) < 0) suggestions.push(p.t); });
    }
    return { results: out.slice(0, 12), suggestions: suggestions, expanded: expanded };
  }

  /* ---------- 規格內文片段（顯示命中證據） ---------- */
  function snippetFor(d, flat, qTokens) {
    if (!d.body) return d.desc;
    var nb = normalize(d.body);
    var pos = flat.length >= 2 ? nb.indexOf(flat) : -1;
    if (pos < 0) {
      for (var i = 0; i < qTokens.length; i++) {
        if (qTokens[i].length < 2) continue;
        pos = nb.indexOf(qTokens[i]);
        if (pos > -1) { flat = qTokens[i]; break; }
      }
    }
    if (pos < 0) return d.desc;
    var start = Math.max(0, pos - 34), end = Math.min(d.body.length, pos + flat.length + 46);
    var text = (start > 0 ? '…' : '') + d.body.slice(start, end).trim() + (end < d.body.length ? '…' : '');
    return text.replace(new RegExp(flat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), function (m) { return '<mark>' + m + '</mark>'; });
  }

  window.siteSearch = search;

  /* ============================================================
     Algolia 遠端搜尋
     ------------------------------------------------------------
     搜尋框的行為是「先本地、後遠端」：
     1. 打字時先用上面的本地 BM25 立刻顯示結果（零延遲）
     2. 同時向 Algolia 查詢，回來後換成它的結果（分詞、錯字容錯更強，
        且能對到單一規格，例如「45L」直接指到那一筆）
     3. Algolia 連不上或未設定 → 安靜留在本地結果，不影響使用

     這裡的 Search-Only Key 是唯讀的，設計上就可以公開；
     有寫入權的 Admin Key 只存在 tools/algolia-upload.html 使用者的瀏覽器裡。
     索引內容用 tools/algolia-upload.html 上傳。
     ============================================================ */
  var ALGOLIA = {
    appId: 'YRQS01JBND',
    searchKey: '86d243489a6c083a51f3fd4f0a222ef0',
    index: 'inteplast_tw'
  };

  var remoteSeq = 0;
  var remoteCache = {};

  function remoteSearch(query) {
    var q = String(query || '').trim();
    if (!ALGOLIA.appId || !q) return Promise.resolve(null);
    if (remoteCache[q]) return Promise.resolve(remoteCache[q]);

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
        if (!j || !j.hits) return null;
        var out = j.hits.map(function (h) {
          var hl = (h._highlightResult || {});
          var snippet = (h._snippetResult && h._snippetResult.desc && h._snippetResult.desc.value)
            || (hl.desc && hl.desc.value) || h.desc || '';
          return {
            item: {
              title: h.title,
              category: h.category || '',
              icon: h.icon || 'fa-cube',
              desc: h.desc || '',
              url: resolveUrl(h.url)
            },
            score: 1,
            why: '',
            snippet: snippet
          };
        });
        var res2 = { results: out, suggestions: [], expanded: [], remote: true };
        remoteCache[q] = res2;
        return res2;
      })
      .catch(function () { return null; });
  }

  /* ============================================================
     搜尋記錄 — 送到 Apps Script（同一支 /exec，action=search）
     ------------------------------------------------------------
     目的：知道客戶在找什麼，尤其是「搜尋了但我們沒有的東西」（結果 0 筆）
     那份清單就是新產品開發的線索。

     設計取捨：
     - debounce 900ms：使用者打「清潔袋」不會記成 清/清潔/清潔袋 三筆，
       只記他停下來的那一次
     - 少於 2 字不記：單字雜訊太多
     - 同一次瀏覽的相同查詢只記一次（sameSession）
     - 用 sendBeacon／keepalive fetch，不等回應也不擋畫面，
       送不出去就安靜放棄（絕不影響搜尋體驗）
     ============================================================ */
  var LOG_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz1hF2WW-easWE11AHvlnzvOXMG8qDSElR_IYcVx6vj0TWoXHrA-Mzuu78qcTJS7GMX/exec';
  var logTimer = null;
  var logged = {};

  function logSearch(query, hits) {
    var q = String(query || '').trim();
    if (!LOG_ENDPOINT || q.length < 2) return;
    /* 去重只看查詢字串（不含筆數）：Algolia 比本地慢時會渲染兩次，
       若把筆數放進 key 就會同一個查詢記兩列，其中一列還是錯的「無結果」 */
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
      if (navigator.sendBeacon) {
        navigator.sendBeacon(LOG_ENDPOINT, body);
      } else {
        fetch(LOG_ENDPOINT, { method: 'POST', body: body, mode: 'no-cors', keepalive: true });
      }
    } catch (err) { /* 記錄失敗不影響使用 */ }
  }

  function queueLog(query, hits) {
    clearTimeout(logTimer);
    logTimer = setTimeout(function () { logSearch(query, hits); }, 900);
  }

  /* ============================================================
     語意搜尋（transformers.js，完全在瀏覽器內執行）
     ------------------------------------------------------------
     為什麼要這一層：關鍵字比對只能對上字面，客戶說「可以裝熱湯的袋子」
     就對不到「耐熱袋」。語意向量比的是意思，所以不需要人工同義詞表。

     設計取捨：
     - 向量檔（src/data/embeddings.json）由 tools/build-embeddings.html 離線算好，
       網站只需在查詢時把「一句話」轉成向量 → 只有查詢端要跑模型
     - 模型約 40MB，第一次搜尋才下載、之後瀏覽器快取；
       在它就緒前完全不影響搜尋（關鍵字結果照樣立刻出現）
     - 只補「關鍵字沒找到但語意相近」的結果，不覆蓋精準命中的排序
     - 任何一步失敗就安靜跳過
     ============================================================ */
  var SEM = {
    ready: false,
    loading: false,
    items: null,
    extractor: null,
    threshold: 0.80,   // e5 模型的相似度普遍偏高，門檻要拉高才不會塞雜訊
    max: 4
  };

  function loadSemantic() {
    if (SEM.loading || SEM.ready) return;
    SEM.loading = true;

    var base = /\/products\//.test(location.pathname) ? '../' : '';
    fetch(base + 'src/data/embeddings.json')
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
            item: {
              title: x.it.title,
              category: x.it.category || '',
              icon: x.it.icon || 'fa-cube',
              desc: x.it.desc || '',
              url: resolveUrl(x.it.url)
            },
            score: x.s,
            why: '',
            snippet: x.it.desc || '',
            semantic: true
          };
        });
      })
      .catch(function () { return []; });
  }

  /** 把語意結果補在關鍵字結果後面（已出現過的不重複） */
  function mergeSemantic(query, base) {
    return semanticHits(query).then(function (extra) {
      if (!extra.length) return base;
      var seen = {};
      base.results.forEach(function (r) { seen[r.item.url + '|' + r.item.title] = true; });
      var add = extra.filter(function (r) { return !seen[r.item.url + '|' + r.item.title]; });
      if (!add.length) return base;
      return {
        results: base.results.concat(add),
        suggestions: base.results.length ? [] : base.suggestions,
        expanded: base.expanded,
        remote: base.remote
      };
    });
  }

  /* ---------- 介面 ---------- */
  var EXTRA_CSS = `
  /* 頁首常駐搜尋條：取代原本的彈出視窗。
     輸入框一直在，結果以下拉面板貼在輸入框下方（不遮擋整頁）。 */
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
  .om-search-hint { padding: 9px 16px; font-size: 0.78rem; font-weight: 700; color: #00529B;
    background: #EFF6FF; border-bottom: 1px solid #DBEAFE; }
  .om-search-list { max-height: 58vh; overflow-y: auto; overflow-x: hidden; }
  .om-result { display: flex; align-items: center; gap: 12px; padding: 12px 16px; text-decoration: none;
    border-bottom: 1px solid #F1F5F9; }
  .om-result:hover, .om-result.sel { background: #EFF6FF; }
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
  .om-empty .s { font-size: 0.8rem; margin-bottom: 14px; }

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

  function ensureUI() {
    if (!document.getElementById('omSearchStyle')) {
      var st = document.createElement('style');
      st.id = 'omSearchStyle';
      st.textContent = EXTRA_CSS;
      document.head.appendChild(st);
    }
    var old = document.getElementById('searchModalOverlay');
    if (old) old.remove();
    if (document.getElementById('omSearchBar')) return;

    /* 頁首那顆放大鏡按鈕換成常駐搜尋條；找不到頁首時不插入
       （漢堡選單會另外呼叫 openSearchModal 聚焦這個輸入框） */
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
          '<button class="om-tag" type="button" data-q="熱食袋">熱食袋</button>' +
          '<button class="om-tag" type="button" data-q="夾鍊袋">夾鍊袋</button>' +
          '<button class="om-tag" type="button" data-q="45L">45L</button>' +
        '</div>' +
        '<div id="omSearchHint" class="om-search-hint" style="display:none;"></div>' +
        '<div id="omSearchList" class="om-search-list"></div>' +
      '</div>';

    trigger.parentNode.replaceChild(bar, trigger);

    var input = document.getElementById('omSearchInput');
    input.addEventListener('input', function () {
      bar.classList.toggle('has-text', !!this.value);
      openPanel();
      render(this.value);
    });
    input.addEventListener('focus', function () { openPanel(); render(this.value); });
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

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function render(query, preset) {
    var list = document.getElementById('omSearchList');
    var hint = document.getElementById('omSearchHint');
    if (!list) return;
    var r = preset || search(query);
    var q = (query || '').trim();

    /* 三段式：本地結果立刻畫 → Algolia 回來替換 → 語意結果補上。
       只認最後一次查詢（seq），避免慢的回應蓋掉新的輸入。 */
    if (!preset && q) {
      var seq = ++remoteSeq;
      if (q.length >= 2) loadSemantic();
      remoteSearch(q).then(function (rr) {
        if (seq !== remoteSeq) return;
        var base = (rr && rr.results.length) ? rr : r;
        if (rr && rr.results.length) render(q, base);
        return mergeSemantic(q, base).then(function (merged) {
          if (seq !== remoteSeq) return;
          if (merged !== base) render(q, merged);
          // 記錄以最終筆數為準：關鍵字漏掉、語意或 Algolia 找到的不該記成「無結果」
          queueLog(q, merged.results.length);
        });
      });
    }

    var mapped = [];
    r.results.forEach(function (x) { if (x.why && mapped.indexOf(x.why) < 0) mapped.push(x.why); });
    if (q && mapped.length) {
      hint.style.display = 'block';
      hint.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 「' + esc(q) + '」為您找到：' + mapped.slice(0, 3).map(esc).join('、');
    } else {
      hint.style.display = 'none';
    }

    if (!r.results.length) {
      list.innerHTML = '<div class="om-empty">' +
        '<div class="t">找不到與「' + esc(q) + '」相符的產品</div>' +
        '<div class="s">試試下面的說法，或直接與我們聯繫報價。</div>' +
        '<div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">' +
          r.suggestions.map(function (s) { return '<button class="om-tag" type="button" data-q="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') +
        '</div></div>';
      return;
    }

    list.innerHTML = r.results.map(function (x) {
      return '<a class="om-result" href="' + x.item.url + '">' +
        '<span class="om-result-icon"><i class="fa-solid ' + x.item.icon + '"></i></span>' +
        '<span class="om-result-info">' +
          '<span class="om-result-title">' + esc(x.item.title) + '</span>' +
          '<span class="om-result-desc">' + (x.snippet || esc(x.item.desc)) + '</span>' +
        '</span>' +
        '<span class="om-result-cat">' + esc(x.item.category) + '</span>' +
      '</a>';
    }).join('');
  }

  // 保留這兩個名字：漢堡選單與舊頁面仍在呼叫
  window.openSearchModal = function () {
    ensureUI();
    var i = document.getElementById('omSearchInput');
    if (!i) return;
    openPanel();
    render(i.value);
    i.focus();
  };
  window.closeSearchModal = closePanel;

  document.addEventListener('click', function (e) {
    var t = e.target;
    var bar = document.getElementById('omSearchBar');

    // 點面板外面就收起來
    if (bar && !bar.contains(t)) { closePanel(); }

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
      // Enter 直接前往第一筆結果
      var first = document.querySelector('#omSearchList .om-result');
      if (first) { e.preventDefault(); location.href = first.getAttribute('href'); }
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI);
  else ensureUI();
})();
