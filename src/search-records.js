/* ============================================================
   搜尋資料來源（單一定義）
   ------------------------------------------------------------
   Algolia 上傳（tools/algolia-upload.html）與語意向量產生
   （tools/build-embeddings.html）都用這裡的 buildSearchRecords()，
   避免兩邊各寫一份、日後長歪。

   產品分類讀 products-data.js（實際維護的那份），
   規格讀 SITE_MAP.specs()，一般頁面（關於／永續／聯絡）讀 website-data.js。
   ============================================================ */
(function () {
  var PAGES = {
    '清潔袋': 'can-liners', '拉繩袋': 'draw-tape', '蔬果袋': 'heat-bags',
    '夾鏈袋': 'sealed-packaging', '其他類': 'accessories', '手套': 'accessories',
    '多功能手套': 'accessories', '遮蔽防塵膠帶': 'accessories', '膠帶': 'accessories',
    'Scale Sheet': 'stretch-films', 'Tare Sheet': 'stretch-films'
  };

  function pageFor(name) {
    var n = String(name || '');
    var keys = Object.keys(PAGES);
    for (var i = 0; i < keys.length; i++) if (n.indexOf(keys[i]) > -1) return PAGES[keys[i]];
    return 'index';
  }

  function splitList(s) {
    return String(s || '').split(/[、,，/]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function buildSearchRecords() {
    var recs = [];

    (window.PRODUCT_DATA || []).forEach(function (p, i) {
      var names = String(p.name || '').split('/').map(function (s) { return s.trim(); }).filter(Boolean);
      var main = names[0] || '';
      var alias = names.slice(1);
      recs.push({
        objectID: 'prod-' + i,
        type: 'product',
        title: main,
        alias: alias,
        category: main,
        desc: p.highlight || p.desc || '',
        body: [p.desc, p.items, p.name_en, alias.join(' ')].filter(Boolean).join(' '),
        keywords: [p.name_en].concat(alias).concat(splitList(p.items)).filter(Boolean),
        icon: 'fa-box-open',
        /* @root: 前綴＝相對站台根目錄（site-search.js 的 resolveUrl 慣例）。
           不加前綴的裸路徑會被當成相對 products/，從首頁看就變成 products/products/…。 */
        url: '@root:products/' + pageFor(p.name) + '.html',
        weight: 100
      });
    });

    var specs = window.SITE_MAP ? window.SITE_MAP.specs() : [];
    specs.forEach(function (r, i) {
      var bits = [r.cap, r.size, r.dim, r.qty].filter(Boolean);
      recs.push({
        objectID: 'spec-' + i,
        type: 'spec',
        title: r.series,
        alias: [],
        category: r.categoryName || '',
        desc: bits.join('　'),
        body: [r.spec, r.dim, r.qty, (r.colors || []).map(function (c) { return c.name; }).join(' ')].filter(Boolean).join(' '),
        keywords: (r.colors || []).map(function (c) { return c.name; }),
        cap: r.cap || '',
        size: r.size || '',
        dim: r.dim || '',
        icon: 'fa-table-list',
        /* 指向該分類的產品頁本身（規格表就在那頁）。不加 #cat-… 片段：
           那些錨點只存在於 products/index.html 且用英文代號，加了會失效。 */
        url: '@root:products/' + (r.page || 'index') + '.html',
        weight: 50
      });
    });

    var data = (window.SITE_DATA && window.SITE_DATA.search) || {};
    var GENERIC = { '聯繫我們': 1, '關於我們': 1, '永續發展': 1, '產品': 1 };
    (data.docs || []).forEach(function (d, i) {
      if (!GENERIC[d.category]) return;
      recs.push({
        objectID: 'page-' + i,
        type: 'page',
        title: d.title,
        alias: [],
        category: d.category || '',
        desc: d.desc || '',
        body: d.body || '',
        keywords: d.keywords || [],
        icon: d.icon || 'fa-file-lines',
        url: d.url,
        weight: 30
      });
    });

    return recs;
  }

  /** 語意向量要吃的文字：把一筆記錄攤成一段自然語句 */
  function recordText(r) {
    return [
      r.title,
      (r.alias || []).join(' '),
      r.category !== r.title ? r.category : '',
      r.desc,
      (r.keywords || []).join('、'),
      r.body
    ].filter(Boolean).join('。').slice(0, 900);
  }

  window.buildSearchRecords = buildSearchRecords;
  window.searchRecordText = recordText;
})();
