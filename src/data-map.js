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

  /* 每個產品系列的版面設定（錨點、標題、圖示、左側照片）
     — 這些是網頁呈現用的技術資訊，不放進 Excel。
     Excel 新增的系列若不在此表，會自動以系列名稱為標題、左側改放等比例袋型圖。 */
  var SERIES = {
    '連捲清潔袋':      { anchor: 'cat-roll-liners',  icon: 'fa-dumpster',         title: '台塑點斷 / 抽取清潔袋 (原廠規格對照)', photo: 'formosa_canliner_official.png', caption: '台塑連捲點斷清潔袋<br>實心捲取・平底封口' },
    '單張抽取清潔袋':  { anchor: 'cat-flat-draw',    icon: 'fa-box-open',         title: '單張 / 抽取清潔袋規格對照表' },
    '環保清潔袋':      { anchor: 'cat-eco-liners',   icon: 'fa-leaf',             title: '環保清潔袋規格對照表', photo: 'environmental-label-mark-official.png', caption: '通過環保標章審查<br>50% 再生塑膠原料' },
    '拉繩醫療袋':      { anchor: 'cat-medical',      icon: 'fa-notes-medical',    title: '拉繩感染清潔袋 (拉繩醫療袋) 規格對照表', photo: 'drawtape_medical_studio.png', caption: '高辨識度紅色拉繩<br>感染性廢棄物隔離用' },
    '拉繩清潔袋':      { anchor: 'cat-general',      icon: 'fa-ribbon',           title: '台塑拉繩清潔袋 (原廠規格對照)', photo: 'drawtape_commercial_studio.png', caption: '袋口拉繩一拉即封<br>經濟包與超量包規格' },
    '環保拉繩清潔袋':  { anchor: 'cat-eco-draw-tape', icon: 'fa-leaf',            title: '環保拉繩清潔袋規格對照表', photo: 'drawtape.jpg', caption: '再生料拉繩清潔袋<br>本色與黑色，可客製' },
    '平裝耐熱袋':      { anchor: 'cat-flat-heat',    icon: 'fa-temperature-high', title: '平裝耐熱袋規格對照表', photo: 'formosa_heat_bag_official.png', caption: '食品級 PE 平裝耐熱袋<br>四兩 ~ 15 斤' },
    '卷裝耐熱袋':      { anchor: 'cat-roll-heat',    icon: 'fa-scroll',           title: '卷裝耐熱袋規格對照表', photo: 'formosa_heat_bag_real.png', caption: '整卷包裝耐熱袋<br>抽取方便不斷卷' },
    '蔬果袋':          { anchor: 'cat-produce',      icon: 'fa-carrot',           title: '蔬果袋規格對照表' },
    '夾鏈袋':          { anchor: 'cat-zipper',       icon: 'fa-lock',             title: '夾鏈袋號數對照表 (00號 ~ 12號)', photo: 'ai_zipper_bag.png', caption: '00 號 ~ 12 號共 14 種<br>3.5×4 cm 至 34×45 cm' },
    '密實袋':          { anchor: 'cat-slider',       icon: 'fa-box-archive',      title: '密實袋規格對照表' },
    '立體密實袋':      { anchor: 'cat-standup',      icon: 'fa-cube',             title: '立體密實袋規格對照表' },
    '冷凍袋':          { anchor: 'cat-freezer',      icon: 'fa-snowflake',        title: '冷凍袋規格對照表' },
    '手套':            { anchor: 'cat-gloves',       icon: 'fa-hand',             title: '手套尺寸規格對照表', photo: '螢幕擷取畫面 2026-08-13 160650.png', caption: '台塑多功能手套<br>提供 S / M / L 三種尺寸' },
    '台塑遮蔽防塵膠帶': { anchor: 'cat-tape',         icon: 'fa-tape',             title: '台塑遮蔽防塵膠帶規格對照表', photo: '螢幕擷取畫面 2026-08-13 160829.png', caption: '台塑遮蔽防塵膠帶<br>550mm ~ 3200mm 六種幅寬' }
  };

  function seriesInfo(name) {
    var s = SERIES[name] || {};
    return {
      anchor: s.anchor || ('cat-' + String(name).replace(/[^\w\u3400-\u9fff]+/g, '-')),
      icon: s.icon || 'fa-layer-group',
      title: s.title || (name + '規格對照表'),
      photo: s.photo || '',
      caption: s.caption || name
    };
  }

  /* ============================================================
     產品實拍圖對應（src/product-img/）
     檔名規則：「系列 尺寸級別.副檔名」，同級別有不同包裝時再加包裝，
              例如「拉繩清潔袋 超大 經濟包.webp」；
              系列代表圖為「封面-系列.副檔名」。
     新增圖片：放進 src/product-img/ 並把檔名加進 IMAGE_FILES 即可。
     ============================================================ */
  var IMG_DIR = 'product-img/';

  var IMAGE_FILES = [
    '封面-Scale Sheet.jpg', '封面-手套.webp', '封面-拉繩感染袋.png', '封面-清潔袋.png',
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

  var INDEX = (function () {
    var map = {};
    IMAGE_FILES.forEach(function (f) { map[f.replace(/\.[a-z0-9]+$/i, '')] = IMG_DIR + f; });
    return map;
  })();

  function baseSize(size) {
    return String(size || '').replace(/[（(][^)）]*[)）]/g, '').trim();
  }

  // 一列規格 → 實拍圖路徑（找不到回傳空字串）
  function imageFor(row) {
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

  // 系列代表圖：只回傳「封面-<系列>」這種精確命名的圖
  // （注意：不再回傳同分類的泛用圖，避免蓋掉系列專屬圖造成圖文不符）
  function coverFor(series) {
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

  window.SITE_MAP = {
    pages: PAGES, sheets: SHEETS, colors: COLORS, series: SERIES, seriesInfo: seriesInfo,
    imgDir: IMG_DIR, images: INDEX, imageFor: imageFor, coverFor: coverFor,
    pageOf: pageOf, qtyText: qtyText, colorList: colorList, specText: specText,
    resolve: resolve, specs: specs, readWorkbook: readWorkbook
  };
})();
