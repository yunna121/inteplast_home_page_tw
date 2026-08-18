/* ============================================================
   全站模糊搜尋 (Site Search) — 臺灣營德
   ------------------------------------------------------------
   設計重點：
   1) 同義詞字典：使用者輸入「垃圾袋」也能找到「清潔袋」
   2) 正規化：全形/半形、大小寫、空白標點、常見異體字（夾鍊=夾鏈、捲=卷、臺=台）
   3) 模糊比對：完全命中 → 同義詞 → 子字串 → 依序字元 → 雙字組相似度 → 英文編輯距離
   4) 索引到「子分類」層級，點擊直接跳到該規格區塊
   5) 查無結果時給「你是不是想找」建議
   ============================================================ */
(function () {
  var inProducts = /\/products\//.test(location.pathname);
  var P = inProducts ? '' : 'products/';        // 產品頁前綴
  var R = inProducts ? '../' : '';              // 根層前綴

  /* ---------- 1. 索引（子分類層級，可直接跳到區塊） ---------- */
  var searchIndex = [
    { title: '連捲清潔袋', desc: '連捲點斷式，10L~125L 多種容量，透明／粉紅／黑色。', category: '清潔袋 01', icon: 'fa-dumpster',
      url: P + 'can-liners.html#cat-roll-liners',
      keywords: ['連捲', '點斷', '捲式', '整捲', '10L', '15L', '20L', '45L', '70L', '90L', '125L', 'coreless roll', 'roll liner'] },
    { title: '單張抽取清潔袋', desc: '單張平裝抽取式，10L~125L，透明／黑色／粉紅／藍色。', category: '清潔袋 01', icon: 'fa-box-open',
      url: P + 'can-liners.html#cat-flat-draw',
      keywords: ['單張', '平裝', '抽取', '盒裝抽取', 'flat pack', 'interleaved'] },
    { title: '環保清潔袋', desc: '通過環保標章審查的再生料清潔袋，可選本色／紅／藍／黑／綠，並可客製。', category: '清潔袋 01', icon: 'fa-leaf',
      url: P + 'can-liners.html#cat-eco-liners',
      keywords: ['環保', '再生', '環保標章', '綠色', 'PCR', 'recycled', 'eco', 'green mark'] },

    { title: '拉繩清潔袋', desc: '一拉即封口，45L~130L 巨無霸，經濟包與超量包。', category: '拉繩袋 02', icon: 'fa-ribbon',
      url: P + 'draw-tape.html#cat-general',
      keywords: ['拉繩', '束口', '抽繩', '經濟包', '超量包', '130L', '巨無霸', 'drawstring', 'draw tape', 'drawtape'] },
    { title: '拉繩感染清潔袋（醫療袋）', desc: '紅色拉繩感控袋，8L~90L，適用醫療與感染性廢棄物。', category: '拉繩袋 02', icon: 'fa-notes-medical',
      url: P + 'draw-tape.html#cat-medical',
      keywords: ['醫療', '感染', '感控', '紅色', '生醫', '廢棄物', 'medical', 'biohazard', 'infectious'] },
    { title: '環保拉繩清潔袋', desc: '再生料拉繩清潔袋，本色與黑色，可客製尺寸顏色。', category: '拉繩袋 02', icon: 'fa-leaf',
      url: P + 'draw-tape.html#cat-eco-draw-tape',
      keywords: ['環保拉繩', '再生', '環保標章', 'eco drawtape'] },

    { title: '平裝耐熱袋', desc: '食品級 PE，四兩~15斤，附等比例尺寸對比牆。', category: '蔬果袋 03', icon: 'fa-temperature-high',
      url: P + 'heat-bags.html#cat-flat-heat',
      keywords: ['平裝', '耐熱', '熱食', '熱湯', '食品級', '四兩', '半斤', '斤', 'flat heat', 'foodservice'] },
    { title: '卷裝耐熱袋', desc: '整卷包裝耐熱袋，四兩~5斤，每卷 236~1822 張。', category: '蔬果袋 03', icon: 'fa-scroll',
      url: P + 'heat-bags.html#cat-roll-heat',
      keywords: ['卷裝', '捲裝', '整卷', '耐熱', '熱食', 'roll heat'] },

    { title: '蔬果袋', desc: '食品級 PE 蔬果分裝袋，超市生鮮與傳統市場適用，規格洽詢。', category: '蔬果袋 03', icon: 'fa-carrot',
      url: P + 'heat-bags.html#cat-produce',
      keywords: ['蔬果', '蔬菜', '水果', '生鮮', '超市', '賣場', '分裝', 'produce', 'produce bag', 'vegetable', 'fruit'] },

    { title: '夾鏈袋', desc: '00號~12號共 14 種號數，3.5×4 cm 至 34×45 cm。', category: '夾鏈袋 04', icon: 'fa-lock',
      url: P + 'sealed-packaging.html#cat-zipper',
      keywords: ['夾鏈', '夾鍊', '夾練', '號數', '00號', '12號', 'ziplock', 'zip lock', 'zipper', 'reclosable'] },
    { title: '密實袋', desc: '雙軌密封密實袋，中／大兩種規格。', category: '夾鏈袋 04', icon: 'fa-box-archive',
      url: P + 'sealed-packaging.html#cat-slider',
      keywords: ['密實', '密封', '雙軌', 'seal top', 'slider'] },
    { title: '立體密實袋', desc: '可站立立體袋，小／中／大，13×13.5 至 26×25.5 cm。', category: '夾鏈袋 04', icon: 'fa-cube',
      url: P + 'sealed-packaging.html#cat-standup',
      keywords: ['立體', '站立', '直立', 'stand up', 'standup', 'pouch'] },
    { title: '冷凍袋', desc: '冷凍保鮮用密封袋，中／大兩種規格。', category: '夾鏈袋 04', icon: 'fa-snowflake',
      url: P + 'sealed-packaging.html#cat-freezer',
      keywords: ['冷凍', '冷藏', '保鮮', '結凍', 'freezer', 'frozen'] },

    { title: '手套', desc: '台塑多功能手套，S／M／L 三種尺寸，餐飲備料與日常清潔適用。', category: '其他類 05', icon: 'fa-hand',
      url: P + 'accessories.html#cat-gloves',
      keywords: ['手套', '衛生手套', '塑膠手套', '一次性手套', 'PE手套', '拋棄式', 'gloves', 'disposable gloves'] },
    { title: '台塑遮蔽防塵膠帶', desc: '550mm~3200mm 六種幅寬，裝潢施工遮蔽與防塵養生用。', category: '其他類 05', icon: 'fa-tape',
      url: P + 'accessories.html#cat-tape',
      keywords: ['膠帶', '遮蔽', '防塵', '養生膠帶', '裝潢', '施工', '油漆', 'masking', 'masking film', 'pre-taped'] },

    { title: 'Scale Sheet', desc: '生鮮／熟食襯墊膜系列，歡迎與專員聯繫規格。', category: 'Scale Sheet 06', icon: 'fa-sheet-plastic',
      url: P + 'stretch-films.html',
      keywords: ['scale sheet', '襯墊', '墊紙', '切片', '生鮮', '熟食', 'deli', 'produce sheet', 'sheeting'] },

    { title: '產品中心（全部分類）', desc: '六大分類總覽：清潔袋、拉繩袋、蔬果袋、夾鏈袋、其他類、Scale Sheet。', category: '產品', icon: 'fa-layer-group',
      url: P + 'index.html',
      keywords: ['產品', '全部', '型錄', '目錄', 'catalog', 'products', 'all'] },
    { title: '環保標章產品專區', desc: '台塑環保拉繩清潔袋與環保清潔袋的環保標章使用證書。', category: '永續發展', icon: 'fa-certificate',
      url: R + 'sustainability.html',
      keywords: ['環保標章', '證書', '永續', 'ESG', '再生塑膠', '減碳', 'sustainability', 'green mark', 'certificate'] },
    { title: '線上詢價與聯絡', desc: '填寫需求規格與數量，專人回覆報價。', category: '聯繫我們', icon: 'fa-paper-plane',
      url: R + 'contact.html',
      keywords: ['詢價', '報價', '價格', '聯絡', '電話', '地址', '業務', 'quotation', 'quote', 'price', 'contact', 'rfq'] },
    { title: '關於營德', desc: '企業沿革、嘉義新港生產基地與品質認證。', category: '關於我們', icon: 'fa-building',
      url: R + 'about.html',
      keywords: ['關於', '公司', '簡介', '工廠', '產能', '認證', 'ISO', 'about', 'company', 'factory'] }
  ];

  /* ---------- 2. 同義詞字典：使用者說法 → 站內用語 ---------- */
  var SYNONYMS = [
    { say: ['垃圾袋', '垃圾包', '垃圾桶內袋', '垃圾桶袋', '塑膠袋', '黑色塑膠袋', '內袋', 'trashbag', 'trash bag', 'garbage', 'garbagebag', 'binliner', 'bin liner', 'canliner', 'can liner'], mean: ['連捲清潔袋', '單張抽取清潔袋', '環保清潔袋'] },
    { say: ['大垃圾袋', '大型垃圾袋', '工業用垃圾袋', '商用垃圾袋'], mean: ['清潔袋', '連捲清潔袋', '拉繩清潔袋'] },
    { say: ['束口袋', '抽繩袋', '拉繩', '綁繩袋', '提繩袋'], mean: ['拉繩清潔袋'] },
    { say: ['醫療廢棄物袋', '感染袋', '生物危害袋', '紅袋', '紅色垃圾袋'], mean: ['拉繩感染清潔袋（醫療袋）'] },
    { say: ['熱食袋', '湯袋', '打包袋', '手扒雞袋', '耐高溫袋', '微波袋', '食品袋'], mean: ['平裝耐熱袋', '卷裝耐熱袋'] },
    { say: ['夾鍊袋', '夾練袋', '密封夾鏈', '自封袋', '封口袋', 'ziploc', 'ziplock'], mean: ['夾鏈袋'] },
    { say: ['保鮮袋', '食物保鮮', '冷凍保鮮袋', '冰箱袋'], mean: ['冷凍袋', '密實袋'] },
    { say: ['站立袋', '直立袋', '立袋'], mean: ['立體密實袋'] },
    { say: ['防塵布', '養生膠帶', '遮蔽膠帶', '油漆膠帶', '裝潢膠帶', '防塵膠膜'], mean: ['台塑遮蔽防塵膠帶'] },
    { say: ['pe手套', '透明手套', '拋棄式手套', '料理手套', '食品手套'], mean: ['手套'] },
    { say: ['環保袋', '再生袋', '綠色產品', '環保認證', 'pcr'], mean: ['環保清潔袋', '環保拉繩清潔袋', '環保標章產品專區'] },
    { say: ['蔬菜袋', '水果袋', '生鮮袋', '青菜袋', '市場袋', 'vegetable bag', 'fruit bag'], mean: ['蔬果袋'] },
    { say: ['襯墊紙', '墊底紙', '生鮮墊', '吸水墊'], mean: ['Scale Sheet'] },
    { say: ['多少錢', '價錢', '報價單', 'купить', 'how much'], mean: ['線上詢價與聯絡'] },
    { say: ['尺寸表', '規格表', '對照表', '幾公分', '容量'], mean: ['產品中心（全部分類）'] }
  ];

  /* ---------- 3. 正規化 ---------- */
  var VARIANTS = { '鍊': '鏈', '練': '鏈', '捲': '卷', '臺': '台', '袋子': '袋' };
  function normalize(s) {
    if (!s) return '';
    s = String(s).toLowerCase();
    // 全形轉半形
    s = s.replace(/[\uff01-\uff5e]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); });
    s = s.replace(/\u3000/g, ' ');
    // 常見異體字
    Object.keys(VARIANTS).forEach(function (k) { s = s.split(k).join(VARIANTS[k]); });
    // 去空白與標點
    s = s.replace(/[\s\-_/\\.,、，。？?！!()（）[\]「」【】*+:：;；'"]/g, '');
    return s;
  }

  /* ---------- 4. 相似度工具 ---------- */
  function isSubsequence(q, hay) {           // 字元依序出現
    var i = 0;
    for (var j = 0; j < hay.length && i < q.length; j++) if (hay[j] === q[i]) i++;
    return i === q.length;
  }
  function bigrams(s) {
    var out = [];
    if (s.length < 2) return s ? [s] : out;
    for (var i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  }
  function diceSim(a, b) {                   // 雙字組相似度（適合中文）
    var A = bigrams(a), B = bigrams(b);
    if (!A.length || !B.length) return 0;
    var map = {}, hit = 0;
    A.forEach(function (g) { map[g] = (map[g] || 0) + 1; });
    B.forEach(function (g) { if (map[g] > 0) { map[g]--; hit++; } });
    return (2 * hit) / (A.length + B.length);
  }
  function editDistance(a, b) {
    var m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur.slice();
    }
    return prev[n];
  }

  /* ---------- 5. 查詢擴充（同義詞） ---------- */
  var SYN_LOOKUP = (function () {
    var m = [];
    SYNONYMS.forEach(function (g) {
      g.say.forEach(function (s) { m.push({ key: normalize(s), mean: g.mean, raw: s }); });
    });
    return m;
  })();

  function expandQuery(nq) {
    var hits = [];
    SYN_LOOKUP.forEach(function (e) {
      if (!e.key) return;
      // 查詢包含該說法，或該說法幾乎等於查詢（避免「垃圾袋」被「大垃圾袋」帶偏）
      var contains = nq.indexOf(e.key) > -1;
      var nearlyEqual = (e.key === nq);
      if (contains || nearlyEqual || diceSim(nq, e.key) >= 0.85) {
        e.mean.forEach(function (t) { if (hits.indexOf(t) < 0) hits.push(t); });
      }
    });
    return hits;
  }

  /* ---------- 6. 評分 ---------- */
  function scoreItem(item, nq, expanded) {
    var nTitle = normalize(item.title);
    var nDesc = normalize(item.desc);
    var nCat = normalize(item.category);
    var nKeys = item.keywords.map(normalize);
    var s = 0, why = '';

    if (nTitle === nq) { s += 130; why = ''; }
    else if (nTitle.indexOf(nq) > -1) { s += 100; }
    else if (nq.indexOf(nTitle) > -1 && nTitle.length >= 2) { s += 85; }

    nKeys.forEach(function (k, i) {
      if (!k) return;
      if (k === nq) s += 80;
      else if (k.indexOf(nq) > -1 || nq.indexOf(k) > -1) s += Math.max(30, 60 - i);
    });

    if (nCat.indexOf(nq) > -1) s += 45;
    if (nDesc.indexOf(nq) > -1) s += 28;

    // 同義詞命中
    expanded.forEach(function (t) {
      var nt = normalize(t);
      if (nt === nTitle) { s += 95; why = item.title; }
      else if (nTitle.indexOf(nt) > -1 || nt.indexOf(nTitle) > -1) { s += 70; why = why || item.title; }
      else if (nKeys.some(function (k) { return k && (k.indexOf(nt) > -1 || nt.indexOf(k) > -1); })) { s += 45; }
    });

    // 依序字元（打錯順序、少打字也能中）
    if (s === 0 && nq.length >= 2) {
      if (isSubsequence(nq, nTitle)) s += 30;
      else if (isSubsequence(nq, nKeys.join(''))) s += 18;
    }
    // 雙字組相似度（錯字、部分詞）
    if (nq.length >= 2) {
      var best = diceSim(nq, nTitle);
      nKeys.forEach(function (k) { best = Math.max(best, diceSim(nq, k)); });
      if (best >= 0.34) s += Math.round(best * 45);
    }
    // 英文錯字
    if (/^[a-z0-9]+$/.test(nq) && nq.length >= 4) {
      var minD = 99;
      [nTitle].concat(nKeys).forEach(function (h) {
        if (/^[a-z0-9 ]+$/.test(h) && h) minD = Math.min(minD, editDistance(nq, h));
      });
      if (minD <= 2) s += 40 - minD * 10;
    }
    return { score: s, why: why };
  }

  function search(query) {
    var nq = normalize(query);
    if (!nq) return { results: searchIndex.map(function (i) { return { item: i, score: 1, why: '' }; }), suggestions: [] };
    var expanded = expandQuery(nq);
    var scored = [];
    searchIndex.forEach(function (item) {
      var r = scoreItem(item, nq, expanded);
      if (r.score > 0) scored.push({ item: item, score: r.score, why: r.why });
    });
    scored.sort(function (a, b) { return b.score - a.score; });

    var suggestions = [];
    if (!scored.length) {
      var pool = [];
      searchIndex.forEach(function (i) { pool.push({ t: i.title, sim: diceSim(nq, normalize(i.title)) }); });
      SYN_LOOKUP.forEach(function (e) { pool.push({ t: e.mean[0], sim: diceSim(nq, e.key) }); });
      pool.sort(function (a, b) { return b.sim - a.sim; });
      pool.forEach(function (p) { if (suggestions.length < 3 && suggestions.indexOf(p.t) < 0) suggestions.push(p.t); });
    }
    return { results: scored.slice(0, 12), suggestions: suggestions, expanded: expanded };
  }
  window.siteSearch = search;

  /* ---------- 7. 介面 ---------- */
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
  .om-search-list { max-height: 52vh; overflow-y: auto; }
  .om-result { display: flex; align-items: center; gap: 14px; padding: 14px 22px; text-decoration: none;
    border-bottom: 1px solid #F1F5F9; }
  .om-result:hover { background: #EFF6FF; }
  .om-result-icon { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 10px; background: #0A2540; color: #FFFFFF;
    display: grid; place-items: center; font-size: 0.95rem; }
  .om-result-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .om-result-title { display: block; font-size: 0.98rem; font-weight: 800; color: #0A2540; }
  .om-result-desc { display: block; font-size: 0.82rem; font-weight: 500; color: #64748B; margin-top: 2px; line-height: 1.5; }
  .om-result-cat { font-size: 0.74rem; font-weight: 800; color: #00529B; background: #EFF6FF; border: 1px solid #DBEAFE;
    padding: 3px 10px; border-radius: 6px; white-space: nowrap; }
  .om-empty { padding: 36px 22px; text-align: center; color: #64748B; }
  .om-empty .t { font-size: 0.98rem; font-weight: 800; color: #0A2540; margin-bottom: 6px; }
  .om-empty .s { font-size: 0.85rem; margin-bottom: 16px; }
  .om-search-foot { display: flex; justify-content: space-between; gap: 12px; padding: 12px 22px; background: #F8FAFC;
    border-top: 1px solid #E2E8F0; font-size: 0.78rem; font-weight: 600; color: #64748B; }
  .om-search-foot kbd { background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 4px; padding: 1px 6px; font-weight: 800; }
  `;

  function ensureUI() {
    if (!document.getElementById('omSearchStyle')) {
      var st = document.createElement('style');
      st.id = 'omSearchStyle';
      st.textContent = EXTRA_CSS;
      document.head.appendChild(st);
    }
    // 停用舊版搜尋視窗，避免兩個並存
    var old = document.getElementById('searchModalOverlay');
    if (old) old.remove();

    if (document.getElementById('omSearchOverlay')) return;
    var html = '' +
      '<div id="omSearchOverlay" class="om-search-overlay">' +
        '<div class="om-search-box">' +
          '<div class="om-search-head">' +
            '<i class="fa-solid fa-magnifying-glass"></i>' +
            '<input id="omSearchInput" class="om-search-input" type="text" autocomplete="off" placeholder="搜尋產品、規格或關鍵字（垃圾袋、束口袋、保鮮袋、ziplock 都找得到）">' +
            '<button id="omSearchClose" class="om-search-close" type="button" aria-label="關閉搜尋"><i class="fa-solid fa-xmark"></i></button>' +
          '</div>' +
          '<div class="om-search-tags">' +
            '<span class="lbl">熱門搜尋：</span>' +
            '<button class="om-tag" type="button" data-q="垃圾袋">垃圾袋</button>' +
            '<button class="om-tag" type="button" data-q="束口袋">束口袋</button>' +
            '<button class="om-tag" type="button" data-q="熱食袋">熱食袋</button>' +
            '<button class="om-tag" type="button" data-q="保鮮袋">保鮮袋</button>' +
            '<button class="om-tag" type="button" data-q="夾鍊袋">夾鍊袋</button>' +
            '<button class="om-tag" type="button" data-q="手套">手套</button>' +
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

  function render(query) {
    var list = document.getElementById('omSearchList');
    var hint = document.getElementById('omSearchHint');
    if (!list) return;
    var r = search(query);

    // 同義詞提示
    var q = (query || '').trim();
    var mapped = [];
    r.results.forEach(function (x) { if (x.why && mapped.indexOf(x.why) < 0) mapped.push(x.why); });
    if (q && mapped.length) {
      hint.style.display = 'block';
      hint.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 「' + q + '」為您找到：' + mapped.slice(0, 3).join('、');
    } else {
      hint.style.display = 'none';
    }

    if (!r.results.length) {
      list.innerHTML = '<div class="om-empty">' +
        '<div class="t">找不到與「' + q + '」相符的產品</div>' +
        '<div class="s">試試下面的說法，或直接與我們聯繫報價。</div>' +
        '<div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">' +
          r.suggestions.map(function (s) { return '<button class="om-tag" type="button" data-q="' + s + '">' + s + '</button>'; }).join('') +
        '</div></div>';
      return;
    }

    list.innerHTML = r.results.map(function (x) {
      return '<a class="om-result" href="' + x.item.url + '">' +
        '<span class="om-result-icon"><i class="fa-solid ' + x.item.icon + '"></i></span>' +
        '<span class="om-result-info">' +
          '<span class="om-result-title">' + x.item.title + '</span>' +
          '<span class="om-result-desc">' + x.item.desc + '</span>' +
        '</span>' +
        '<span class="om-result-cat">' + x.item.category + '</span>' +
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
      e.preventDefault();
      window.openSearchModal();
      return;
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
    } else if (e.key === 'Escape') {
      window.closeSearchModal();
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI);
  else ensureUI();
})();
