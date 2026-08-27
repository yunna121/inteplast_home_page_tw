/* ============================================================
   搜尋資料來源（單一定義）
   ------------------------------------------------------------
   Algolia 上傳（tools/algolia-upload.html）與語意向量產生
   （tools/build-embeddings.html）都用這裡的 buildSearchRecords()，
   避免兩邊各寫一份、日後長歪。

   產品一律讀 products-data.js（唯一維護來源）；
   一般頁面（關於／永續／聯絡／產品中心）直接寫在本檔的 PAGE_DOCS。
   ============================================================ */
(function () {
  /* 產品分類專頁已全部移除，搜尋結果一律連到產品中心的對應卡片
     （錮點代號與 products/index.html 的 getCatId 一致）。 */
  var ANCHORS = {
    '清潔袋': 'cat-can-liners', '拉繩袋': 'cat-draw-tape', '蔬果袋': 'cat-heat-bags',
    '夾鏈袋': 'cat-sealed-packaging', '手套': 'cat-gloves', '膠帶': 'cat-masking-film',
    'Scale Sheet': 'cat-stretch-films', 'Tare Sheet': 'cat-stretch-films'
  };

  function anchorFor(name) {
    var n = String(name || '');
    var keys = Object.keys(ANCHORS);
    for (var i = 0; i < keys.length; i++) if (n.indexOf(keys[i]) > -1) return '#' + ANCHORS[keys[i]];
    return '';
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
        title_en: (p.name_en || '').split('/')[0].trim() || main,
        alias: alias,
        category: main,
        desc: p.highlight || p.desc || '',
        desc_en: p.highlight_en || p.desc_en || '',
        body: [p.desc, p.items, p.name_en, alias.join(' ')].filter(Boolean).join(' '),
        keywords: [p.name_en].concat(alias).concat(splitList(p.items)).filter(Boolean),
        icon: 'fa-box-open',
        /* @root: 前綴＝相對站台根目錄（site-search.js 的 resolveUrl 慣例） */
        url: '@root:products/index.html' + anchorFor(p.name),
        weight: 100
      });
    });

    /* 規格層（website-data.xlsx 的「產品規格」工作表）已不納入搜尋：
       產品資料一律以 products-data.js 為準，避免兩份 Excel 各說一套。 */

    /* 一般頁面：內容固定，直接寫在這裡，不再依賴 website-data.js
       （那份與規格表一起移除了）。 */
    var PAGE_DOCS = [
      { title: '關於營德', title_en: 'About Us', desc_en: 'A joint venture of Formosa Plastics and Inteplast USA, with integrated production at our Xingang plant in Chiayi.', category: '關於我們', desc: '台塑企業與 Inteplast USA 合資，嘉義新港基地一貫作業。', keywords: ['公司簡介', '沿革', '工廠', '嘉義', '新港', 'ISO', 'about'], url: '@root:about.html', icon: 'fa-building' },
      { title: '永續發展', title_en: 'Sustainability', desc_en: 'Green Mark certified products, 50% recycled plastic and closed-loop scrap recycling.', category: '永續發展', desc: '環保標章認證、50% 再生塑膠、廠內廢料閉環回收。', keywords: ['環保', '環保標章', '再生塑膠', '回收', 'ESG', 'sustainability'], url: '@root:sustainability.html', icon: 'fa-leaf' },
      { title: '聯繫我們', title_en: 'Contact Us', desc_en: 'Leave your contact details and our team will get back to you.', category: '聯繫我們', desc: '留下聯絡資料，由專人與您聯繫報價。', keywords: ['聯絡', '詢價', '報價', '電話', '信箱', 'contact'], url: '@root:contact.html', icon: 'fa-envelope' },
      { title: '產品中心', title_en: 'Products', desc_en: 'Full overview of all product categories.', category: '產品', desc: '全系列產品分類總覽。', keywords: ['產品', '型錄', '分類', 'products'], url: '@root:products/index.html', icon: 'fa-boxes-stacked' }
    ];
    PAGE_DOCS.forEach(function (d, i) {
      recs.push({
        objectID: 'page-' + i,
        type: 'page',
        title: d.title,
        title_en: d.title_en || d.title,
        alias: [],
        category: d.category,
        desc: d.desc,
        desc_en: d.desc_en || '',
        body: d.desc,
        keywords: d.keywords,
        icon: d.icon,
        url: d.url,
        weight: 30
      });
    });

    return recs;
  }

  /** 語意向量要吃的文字：把一筆記錄攤成一段自然語句。
      中英文都要放進來——模型是多語的，同一段裡有中英文時，
      英文查詢（ziplock、can liner）才對得上中文品名。 */
  function recordText(r) {
    return [
      r.title,
      r.title_en && r.title_en !== r.title ? r.title_en : '',
      (r.alias || []).join(' '),
      r.category !== r.title ? r.category : '',
      r.desc,
      r.desc_en || '',
      (r.keywords || []).join('、'),
      r.body
    ].filter(Boolean).join('。').slice(0, 900);
  }

  window.buildSearchRecords = buildSearchRecords;
  window.searchRecordText = recordText;
})();
