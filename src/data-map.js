/* ============================================================
   資料對應表 (Site Map) — 把 Excel 的商業用語轉成網站內部代碼
   ------------------------------------------------------------
   目的：讓 src/data/website-data.xlsx 只留同事看得懂的欄位
        （產品系列 / 容量 / 尺寸級別 / 尺寸(寬×長) / 張數 / 包裝 / 顏色），
        頁面檔名、區塊代碼、版型、色碼等技術細節都寫在這裡。

   Excel 一個分類頁一個工作表，工作表名稱＝下面 PAGES 的鍵。
   要新增一個「分類頁」時才需要動這個檔（PAGES 加一行、Excel 加一個工作表）；
   同事日常新增品項、改規格、改尺寸都只在 Excel 操作。
   ============================================================ */
(function () {
  var PAGES = {
    '清潔袋': 'can-liners',
    '拉繩袋': 'draw-tape',
    '蔬果袋': 'heat-bags',
    '夾鏈袋': 'sealed-packaging',
    '其他類': 'accessories',
    'Scale Sheet': 'stretch-films'
  };

  // 顏色名稱 → 標籤色（Excel 只需寫「透明 / 粉紅」這樣的名稱）
  var COLORS = {
    '透明': 'clear', '本色': 'clear', '白': 'clear', '白色': 'clear',
    '黑': 'black', '黑色': 'black',
    '粉紅': 'pink', '粉色': 'pink',
    '紅': 'red', '紅色': 'red',
    '藍': 'blue', '藍色': 'blue',
    '綠': 'green', '綠色': 'green'
  };

  // Excel 的分類工作表名稱（依此順序讀取）
  var SHEETS = Object.keys(PAGES);

  /* 每個產品系列的網址錨點、圖示，以及左側圖與圖說的「預設值」
     · 錨點：給選單連結用，例如 heat-bags.html#cat-produce
     · photo / caption：只是預設，Excel 的「系列代表圖」「圖片說明」有填就以 Excel 為準
     · 表格標題：Excel 的「表格標題」有填就用它，沒填就用產品系列名稱 */
  var SERIES = {
    '連捲清潔袋':      { anchor: 'cat-roll-liners',  icon: 'fa-dumpster', photo: 'formosa_canliner_official.png', caption: '台塑連捲點斷清潔袋<br>實心捲取・平底封口' },
    '單張抽取清潔袋':  { anchor: 'cat-flat-draw',    icon: 'fa-box-open' },
    '環保清潔袋':      { anchor: 'cat-eco-liners',   icon: 'fa-leaf', photo: 'environmental-label-mark-official.png', caption: '通過環保標章審查<br>50% 再生塑膠原料' },
    '拉繩醫療袋':      { anchor: 'cat-medical',      icon: 'fa-notes-medical', photo: 'drawtape_medical_studio.png', caption: '高辨識度紅色拉繩<br>感染性廢棄物隔離用' },
    '拉繩清潔袋':      { anchor: 'cat-general',      icon: 'fa-ribbon', photo: 'drawtape_commercial_studio.png', caption: '袋口拉繩一拉即封<br>經濟包與超量包規格' },
    '環保拉繩清潔袋':  { anchor: 'cat-eco-draw-tape', icon: 'fa-leaf', photo: 'drawtape.jpg', caption: '再生料拉繩清潔袋<br>本色與黑色，可客製' },
    '平裝耐熱袋':      { anchor: 'cat-flat-heat',    icon: 'fa-temperature-high', photo: 'formosa_heat_bag_official.png', caption: '食品級 PE 平裝耐熱袋' },
    '卷裝耐熱袋':      { anchor: 'cat-roll-heat',    icon: 'fa-scroll', photo: 'formosa_heat_bag_real.png', caption: '整卷包裝耐熱袋<br>抽取方便不斷卷' },
    '蔬果袋':          { anchor: 'cat-produce',      icon: 'fa-carrot' },
    '夾鏈袋':          { anchor: 'cat-zipper',       icon: 'fa-lock', photo: 'ai_zipper_bag.png', caption: '台塑夾鏈袋<br>多種號數齊全' },
    '密實袋':          { anchor: 'cat-slider',       icon: 'fa-box-archive' },
    '立體密實袋':      { anchor: 'cat-standup',      icon: 'fa-cube' },
    '冷凍袋':          { anchor: 'cat-freezer',      icon: 'fa-snowflake' },
    '手套':            { anchor: 'cat-gloves',       icon: 'fa-hand', caption: '台塑多功能手套' },
    '台塑遮蔽防塵膠帶': { anchor: 'cat-tape',         icon: 'fa-tape', photo: '螢幕擷取畫面 2026-08-13 160829.png', caption: '台塑遮蔽防塵膠帶<br>裝潢施工遮蔽防塵用' }
  };

  function seriesInfo(name) {
    var s = SERIES[name] || {};
    return {
      anchor: s.anchor || ('cat-' + String(name).replace(/[^\w\u3400-\u9fff]+/g, '-')),
      icon: s.icon || 'fa-layer-group',
      title: name,
      photo: s.photo || '',
      caption: s.caption || name
    };
  }

  /* ============================================================
     產品實拍圖對應（src/product-img/）
     優先序：
     1) Excel 那一列的「圖片檔名」欄 — 填了就用那張（新增照片不必改程式）
     2) 自動比對檔名「系列 尺寸級別[ 包裝]」，例如「拉繩清潔袋 超大 經濟包.webp」
     系列代表圖：分類介紹表的「圖片檔名」，或檔名「封面-系列」。
     ============================================================ */
  var IMG_DIR = 'product-img/';

  var IMAGE_FILES = [
    '封面-Scale Sheet.jpg', '封面-手套.webp', '封面-拉繩感染袋.png', '封面-清潔袋.png',
    '封面-拉繩袋.png', '封面-蔬果袋.png', '封面-夾鏈袋.png', '封面-環保清潔袋.webp',
    '手套 小.webp', '手套 中.webp', '手套 大.webp',
    '拉繩感染袋 小.webp', '拉繩感染袋 中.webp', '拉繩感染袋 大.webp', '拉繩感染袋 特大.webp', '拉繩感染袋 超大.webp',
    '拉繩清潔袋 大.webp', '拉繩清潔袋 特大.webp', '拉繩清潔袋 超大 經濟包.webp',
    '拉繩清潔袋 超大 超量包.webp', '拉繩清潔袋 超特大.webp', '拉繩清潔袋 巨無霸.webp',
    '連捲清潔袋 超小.webp', '連捲清潔袋 小.webp', '連捲清潔袋 中.webp',
    '連捲清潔袋 大.webp', '連捲清潔袋 超大.webp', '連捲清潔袋 超特大.webp'
  ];

  // 圖檔上的系列稱呼 → 網站的產品系列名稱
  var IMG_ALIAS = { '拉繩醫療袋': '拉繩感染袋' };
  // 尺寸級別別名（圖檔與 Excel 用字不一致時互相對照）
  var SIZE_ALIAS = { '特小': '超小', '超小': '特小' };
  // 沒有專屬代表圖的系列，先留空位（不借用同分類的圖，免得圖文不符）
  // 封面檔名與系列名不同時在這裡指定（一對一，不是同分類共用）
  var COVER_NAME = { '連捲清潔袋': '清潔袋' };

  // 放在 src/ 根目錄的既有圖片（Excel 只寫檔名時也找得到）
  var SRC_FILES = [
    'ai_specialty.png', 'ai_zipper_bag.png', 'Can-Liners-Draw-Tape-Draw-Tape-2.jpg', 'cleaning.jpg',
    'combine.png', 'drawtape.jpg', 'drawtape_commercial_studio.png', 'drawtape_medical_studio.png',
    'environmental-label-mark-official.png', 'formosa_canliner_official.png',
    'formosa_heat_bag_official.png', 'formosa_heat_bag_real.png', 'plant.png', 'scale sheet.png',
    'use3.png', 'use4.png', 'use5.png', 'use6.png',
    '螢幕擷取畫面 2026-08-13 160650.png', '螢幕擷取畫面 2026-08-13 160829.png'
  ];

  var INDEX = (function () {
    var map = {};
    IMAGE_FILES.forEach(function (f) { map[f.replace(/\.[a-z0-9]+$/i, '')] = IMG_DIR + f; });
    return map;
  })();

  function baseSize(size) {
    return String(size || '').replace(/[（(][^)）]*[)）]/g, '').trim();
  }

  /* 把 Excel 填的檔名解析成相對於 src/ 的路徑
     · 只寫檔名        → src/product-img/檔名（同事上傳的照片都在這裡）
     · 含斜線或寫 src/ → 照他寫的位置，例如「../src/x.png」「combine.png」放在 src/ 的舊圖
     · 找不到於 product-img 的既有清單時，也退回 src/ 直接試 */
  function imagePath(named) {
    var n = String(named || '').trim();
    if (!n) return '';
    n = n.replace(/^\.?\/?src\//, '');
    if (n.indexOf('/') > -1) return n;                       // 已含資料夾，照原樣
    if (INDEX[n.replace(/\.[a-z0-9]+$/i, '')]) return IMG_DIR + n;
    return SRC_FILES.indexOf(n) > -1 ? n : IMG_DIR + n;
  }

  // 一列規格 → 實拍圖路徑（找不到回傳空字串）
  function imageFor(row) {
    // Excel 直接指定的檔名最優先
    var named = String(row.img || '').trim();
    if (named) return imagePath(named);

    var s = IMG_ALIAS[row.series] || row.series;
    var size = baseSize(row.size), cap = String(row.cap || '').trim();
    var pack = String(row.pack || '').replace(/^\d+\s*/, '').trim();
    var variants = [];
    [size, SIZE_ALIAS[size], cap].forEach(function (v) {
      if (!v) return;
      if (pack) variants.push(v + ' ' + pack);
      variants.push(v);
    });
    for (var i = 0; i < variants.length; i++) {
      var hit = INDEX[s + ' ' + variants[i]];
      if (hit) return hit;
    }
    return '';
  }

  // 系列代表圖：分類介紹表指定的檔名優先，否則找「封面-<系列>」
  // （不回傳同分類的泛用圖，避免蓋掉系列專屬圖造成圖文不符）
  function coverFor(series, named) {
    var n = String(named || '').trim();
    if (n) return imagePath(n);
    return INDEX['封面-' + (COVER_NAME[series] || IMG_ALIAS[series] || series)] || '';
  }

  function pageOf(name) {
    var n = String(name || '').trim();
    return PAGES[n] || '';
  }

  // 「100」＋「張/捲」→「100 張/捲」；「45」＋「箱/板」→「45箱/板」
  function qtyText(count, pack) {
    var c = String(count == null ? '' : count).trim();
    var p = String(pack || '').trim();
    if (!c) return p;
    if (!p) return c;
    if (/^[0-9.]+$/.test(c)) {
      if (/^箱/.test(p)) return c + p;
      if (/包$/.test(p) && !/^張/.test(p)) return c + '張 / ' + p;   // 經濟包 / 超量包
      return c + ' ' + p;
    }
    return c + ' ' + p;
  }

  function colorList(text) {
    return String(text || '').split(/[\/、,|，]/).map(function (s) { return s.trim(); })
      .filter(Boolean).map(function (name) {
        return { name: name, code: COLORS[name] || COLORS[name.replace(/色$/, '')] || 'clear' };
      });
  }

  // 「45L」＋「大」→「45L 大」（顯示與詢價品名都用這個組合結果）
  function pick(row, names) {
    for (var i = 0; i < names.length; i++) {
      if (row[names[i]] != null && String(row[names[i]]).trim() !== '') return String(row[names[i]]).trim();
    }
    return '';
  }

  function specText(cap, size) {
    var c = String(cap == null ? '' : cap).trim();
    var s = String(size || '').trim();
    return c && s ? (c + ' ' + s) : (c || s);
  }

  // Excel 一列 → 網站用的規格物件（category 由所在工作表決定）
  function resolve(row, category) {
    var cat = String(category || row['分類頁'] || row.category || '').trim();
    var cap = pick(row, ['容量', '容量/號數', 'cap']);
    var size = pick(row, ['尺寸級別', '尺別俗稱', 'size']);
    return {
      page: pageOf(cat) || String(row.page || '').trim(),
      categoryName: cat,
      series: pick(row, ['產品系列', 'series']),
      cap: cap,
      size: size,
      spec: specText(cap, size) || pick(row, ['尺寸(寬×長)', '尺寸 寬×長', 'dim']) || String(row.spec || '').trim(),
      dim: pick(row, ['尺寸(寬×長)', '尺寸 寬×長', 'dim']),
      count: pick(row, ['張數', 'count']),
      pack: pick(row, ['包裝', 'pack']),
      img: pick(row, ['圖片檔名', 'img']),
      cover: pick(row, ['系列代表圖', 'cover']),
      blockTitle: pick(row, ['表格標題', 'blockTitle']),
      caption: pick(row, ['圖片說明', 'caption']),
      qty: qtyText(pick(row, ['張數', 'count']), pick(row, ['包裝', 'pack'])),
      colors: colorList(pick(row, ['顏色', 'colors']))
    };
  }

  function specs() {
    var rows = (window.SITE_DATA || {}).specs || [];
    return rows.map(function (r) { return resolve(r); })
      .filter(function (r) { return r.series && r.spec; });
  }
  // 從 SheetJS 的 workbook 讀出六個分類工作表（Excel 的列順序＝網站顯示順序）
  function readWorkbook(wb, XLSX) {
    var out = [];
    SHEETS.forEach(function (name) {
      if (!wb.Sheets[name]) return;
      XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' }).forEach(function (row) {
        var r = resolve(row, name);
        if (r.series && r.spec) out.push(r);
      });
    });
    return out;
  }

  // 從 SheetJS 的 workbook 讀出「分類介紹」工作表
  function readCategories(wb, XLSX) {
    if (!wb.Sheets['分類介紹']) return [];
    return XLSX.utils.sheet_to_json(wb.Sheets['分類介紹'], { defval: '' }).map(function (r) {
      return {
        category: String(r['分類頁'] || '').trim(),
        title_tw: String(r['中文名稱'] || '').trim(),
        title_en: String(r['英文名稱'] || '').trim(),
        highlights: String(r['核心亮點'] || '').trim(),
        desc: String(r['詳細介紹'] || '').trim(),
        badges: String(r['特色標籤（逗號分隔）'] || '').trim(),
        image: String(r['圖片檔名'] || '').trim(),
        hero: String(r['分類封面圖'] || '').trim(),
        // 首頁六大核心產品交錯列專用（皆可留空）
        home_desc: String(r['首頁說明'] || '').trim(),
        home_img: String(r['首頁圖片'] || '').trim(),
        home_cutout: String(r['首頁圖片已去背'] || '').trim()
      };
    }).filter(function (c) { return c.category; });
  }

  window.SITE_MAP = {
    pages: PAGES, sheets: SHEETS, colors: COLORS, series: SERIES, seriesInfo: seriesInfo,
    imgDir: IMG_DIR, images: INDEX, imageFor: imageFor, coverFor: coverFor,
    pageOf: pageOf, qtyText: qtyText, colorList: colorList, specText: specText,
    imagePath: imagePath, resolve: resolve, specs: specs, readWorkbook: readWorkbook, readCategories: readCategories
  };
})();
