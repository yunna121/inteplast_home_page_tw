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
      spec: specText(cap, size) || String(row.spec || '').trim(),
      dim: pick(row, ['尺寸(寬×長)', '尺寸 寬×長', 'dim']),
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
    pages: PAGES, sheets: SHEETS, colors: COLORS,
    pageOf: pageOf, qtyText: qtyText, colorList: colorList, specText: specText,
    resolve: resolve, specs: specs, readWorkbook: readWorkbook
  };
})();
