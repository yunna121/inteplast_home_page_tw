/* ============================================================
   全站全文檢索 (Site Full-Text Search) — 台灣營德
   ------------------------------------------------------------
   資料來源：src/data/search-data.js（window.SITE_SEARCH_DATA）
   產品資料與同義詞字典都在該檔，本檔只負責「索引 + 檢索 + 介面」。

   檢索方式（非 Ctrl+F 子字串比對）：
   1) 建立倒排索引：中文切單字＋雙字組、英數切詞，欄位加權
      （品名 8 / 關鍵字 5 / 分類 3 / 說明 2 / 規格內文 1）
   2) BM25 排序（含文件長度正規化），多詞查詢按命中覆蓋率加成
   3) 同義詞擴充：垃圾袋 → 清潔袋、束口袋 → 拉繩袋、保鮮袋 → 冷凍袋…
   4) 錯字容錯：查不到的詞用雙字組相似度／編輯距離找最近的索引詞
   5) 命中規格內文時，結果直接顯示該段規格片段（全文檢索的證據）
   ============================================================ */
(function () {
  var DATA = window.SITE_SEARCH_DATA || { variants: {}, synonyms: [], docs: [] };
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
  // 規格內文改由規格資料（Excel → specs.js）即時組成，Excel 改了搜尋也跟著變
  var SPEC_TEXT = (function () {
    var map = {};
    if (!Array.isArray(window.PRODUCT_SPECS)) return map;
    window.PRODUCT_SPECS.forEach(function (r) {
      var b = r.block || r['區塊代碼'];
      if (!b) return;
      var bits = [r.spec || r['規格/容量/號數'], r.dim || r['尺寸 寬×長'], r.qty || r['張數/包裝數'],
                  (r.colors || r['顏色'] || '').replace(/:[a-z]+/g, '')].filter(Boolean);
      map[b] = (map[b] || '') + ' ' + bits.join(' ');
    });
    return map;
  })();

  var docs = (DATA.docs || []).map(function (d, i) {
    return {
      id: i, title: d.title, category: d.category, icon: d.icon || 'fa-cube',
      desc: d.desc || '',
      body: (function () {
        var anchor = (String(d.url).split('#')[1] || '');
        var live = SPEC_TEXT[anchor];
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

  /* ---------- 介面 ---------- */
  var EXTRA_CSS = `
  .om-search-overlay { position: fixed; inset: 0; background: rgba(5,19,34,0.55); backdrop-filter: blur(6px);
    z-index: 12000; display: none; align-items: flex-start; justify-content: center; padding: 90px 20px 40px; }
  .om-search-overlay.active { display: flex; }
  .om-search-box { width: 100%; max-width: 760px; background: #FFFFFF; border-radius: 18px;
    box-shadow: 0 30px 70px -20px rgba(10,37,64,0.5); overflow: hidden; font-family: 'Inter','Noto Sans TC',sans-serif; }
  .om-search-head { display: flex; align-items: center; gap: 12px; padding: 18px 22px; border-bottom: 1px solid #E2E8F0; }
  .om-search-head i { color: #00529B; font-size: 1.05rem; }
  .om-search-input { flex: 1; border: none; outline: none; font-size: 1.02rem; font-weight: 600; color: #1E293B; background: transparent; }
  .om-search-close { background: #F1F5F9; border: 1px solid #E2E8F0; color: #64748B; width: 34px; height: 34px;
    border-radius: 8px; cursor: pointer; font-size: 0.9rem; }
  .om-search-close:hover { background: #00529B; color: #FFFFFF; border-color: #00529B; }
  .om-search-tags { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 14px 22px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; }
  .om-search-tags .lbl { font-size: 0.78rem; font-weight: 800; color: #64748B; margin-right: 4px; }
  .om-tag { background: #FFFFFF; border: 1px solid #CBD5E1; color: #334155; font-size: 0.8rem; font-weight: 700;
    padding: 5px 12px; border-radius: 9999px; cursor: pointer; }
  .om-tag:hover { border-color: #00529B; color: #00529B; background: #EFF6FF; }
  .om-search-hint { padding: 10px 22px; font-size: 0.82rem; font-weight: 700; color: #00529B; background: #EFF6FF; border-bottom: 1px solid #DBEAFE; }
  .om-search-list { max-height: 52vh; overflow-y: auto; overflow-x: hidden; }
  .om-result { display: flex; align-items: center; gap: 14px; padding: 14px 22px; text-decoration: none;
    border-bottom: 1px solid #F1F5F9; }
  .om-result:hover { background: #EFF6FF; }
  .om-result-icon { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 10px; background: #0A2540; color: #FFFFFF;
    display: grid; place-items: center; font-size: 0.95rem; }
  .om-result-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .om-result-title { display: block; font-size: 0.98rem; font-weight: 800; color: #0A2540; }
  .om-result-desc { display: block; font-size: 0.82rem; font-weight: 500; color: #64748B; margin-top: 2px; line-height: 1.5;
    overflow-wrap: anywhere; text-wrap: pretty; }
  .om-result-desc mark { background: #FEF08A; color: #0A2540; padding: 0 2px; border-radius: 3px; }
  .om-result-cat { font-size: 0.74rem; font-weight: 800; color: #00529B; background: #EFF6FF; border: 1px solid #DBEAFE;
    padding: 3px 10px; border-radius: 6px; white-space: nowrap; }
  .om-empty { padding: 36px 22px; text-align: center; color: #64748B; }
  .om-empty .t { font-size: 0.98rem; font-weight: 800; color: #0A2540; margin-bottom: 6px; }
  .om-empty .s { font-size: 0.85rem; margin-bottom: 16px; }
  .om-search-foot { display: flex; justify-content: space-between; gap: 12px; padding: 12px 22px; background: #F8FAFC;
    border-top: 1px solid #E2E8F0; font-size: 0.78rem; font-weight: 600; color: #64748B; }
  .om-search-foot kbd { background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 4px; padding: 1px 6px; font-weight: 800; }
  @media (max-width: 640px) {
    .om-search-overlay { padding: 70px 12px 20px; }
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
    if (document.getElementById('omSearchOverlay')) return;

    var html = '' +
      '<div id="omSearchOverlay" class="om-search-overlay">' +
        '<div class="om-search-box">' +
          '<div class="om-search-head">' +
            '<i class="fa-solid fa-magnifying-glass"></i>' +
            '<input id="omSearchInput" class="om-search-input" type="text" autocomplete="off" placeholder="搜尋產品、尺寸或規格（垃圾袋、束口袋、45L、0號、ziplock 都找得到）">' +
            '<button id="omSearchClose" class="om-search-close" type="button" aria-label="關閉搜尋"><i class="fa-solid fa-xmark"></i></button>' +
          '</div>' +
          '<div class="om-search-tags">' +
            '<span class="lbl">熱門搜尋：</span>' +
            '<button class="om-tag" type="button" data-q="垃圾袋">垃圾袋</button>' +
            '<button class="om-tag" type="button" data-q="束口袋">束口袋</button>' +
            '<button class="om-tag" type="button" data-q="熱食袋">熱食袋</button>' +
            '<button class="om-tag" type="button" data-q="保鮮袋">保鮮袋</button>' +
            '<button class="om-tag" type="button" data-q="夾鍊袋">夾鍊袋</button>' +
            '<button class="om-tag" type="button" data-q="45L">45L</button>' +
            '<button class="om-tag" type="button" data-q="環保標章">環保標章</button>' +
          '</div>' +
          '<div id="omSearchHint" class="om-search-hint" style="display:none;"></div>' +
          '<div id="omSearchList" class="om-search-list"></div>' +
          '<div class="om-search-foot"><span><kbd>ESC</kbd> 關閉</span><span><kbd>Ctrl</kbd> + <kbd>K</kbd> 開啟搜尋</span></div>' +
        '</div>' +
      '</div>';
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('omSearchInput').addEventListener('input', function () { render(this.value); });
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function render(query) {
    var list = document.getElementById('omSearchList');
    var hint = document.getElementById('omSearchHint');
    if (!list) return;
    var r = search(query);
    var q = (query || '').trim();

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

  window.openSearchModal = function () {
    ensureUI();
    var o = document.getElementById('omSearchOverlay');
    var i = document.getElementById('omSearchInput');
    o.classList.add('active');
    render(i ? i.value : '');
    setTimeout(function () { if (i) i.focus(); }, 60);
  };
  window.closeSearchModal = function () {
    var o = document.getElementById('omSearchOverlay');
    if (o) o.classList.remove('active');
  };

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest && (t.closest('#globalSearchTrigger') || t.closest('.search-trigger-btn'))) {
      e.preventDefault(); window.openSearchModal(); return;
    }
    var overlay = document.getElementById('omSearchOverlay');
    if (!overlay) return;
    if (t === overlay || (t.closest && t.closest('#omSearchClose'))) { window.closeSearchModal(); return; }
    var tag = t.closest && t.closest('.om-tag');
    if (tag) {
      var q = tag.getAttribute('data-q');
      var input = document.getElementById('omSearchInput');
      if (input) { input.value = q; input.focus(); }
      render(q);
    }
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
      e.preventDefault();
      var o = document.getElementById('omSearchOverlay');
      if (o && o.classList.contains('active')) window.closeSearchModal(); else window.openSearchModal();
    } else if (e.key === 'Escape') { window.closeSearchModal(); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI);
  else ensureUI();
})();
