/* ============================================================
   規格表資料驅動渲染 (Spec Render)
   ------------------------------------------------------------
   資料來源優先順序：
   1) src/data/products_specs.xlsx —— Excel 就是唯一資料來源（需架在伺服器上）
   2) src/data/specs.js (window.PRODUCT_SPECS) —— 讀不到 Excel 時的備援快照
        （用檔案直接開啟網頁、或伺服器上暫時沒有 xlsx 時仍能正常顯示）

   使用方式：在頁面上放一個空容器，例如
     <div class="scale-ramp-track track-ramp-scroll"
          data-spec-block="cat-zipper" data-spec-layout="ramp"
          data-spec-series="夾鏈袋"></div>
   本檔會依 Excel 內容填入卡片／表格列，並自動接上詢價籃。
   ============================================================ */
(function () {
  var inProducts = /\/products\//.test(location.pathname);
  var BASE = inProducts ? '../src/' : './src/';
  var XLSX_PATH = BASE + 'data/products_specs.xlsx';
  var SHEETJS = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

  var COLOR_CLASS = { clear: 'clear', black: 'black', pink: 'pink', red: 'red', blue: 'blue', green: 'green' };
  var ACCENTS = ['#4F46E5', '#0D9488', '#16A34A', '#BE185D', '#0284C7', '#EA580C', '#7C3AED', '#B45309'];

  /* ---------- 顏色標籤樣式：頁面沒定義的色碼自動補上，避免裸字 ---------- */
  var PILL_STYLE = {
    clear: 'background:#FFFFFF; color:#475569; border:1px solid #CBD5E1;',
    black: 'background:#1E293B; color:#FFFFFF; border:1px solid #0F172A;',
    pink:  'background:#FBCFE8; color:#9D174D; border:1px solid #F9A8D4;',
    blue:  'background:#DBEAFE; color:#1E40AF; border:1px solid #BFDBFE;',
    green: 'background:#DCFCE7; color:#166534; border:1px solid #BBF7D0;',
    red:   'background:#FEE2E2; color:#B91C1C; border:1px solid #FECACA;'
  };
  function ensurePillStyles() {
    var need = [];
    ['color-pill-', 'scale-pill-'].forEach(function (prefix) {
      Object.keys(PILL_STYLE).forEach(function (code) {
        var probe = document.createElement('span');
        probe.className = prefix + code;
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.textContent = '測';
        document.body.appendChild(probe);
        var cs = getComputedStyle(probe);
        var styled = parseFloat(cs.paddingLeft) > 0 || cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
        document.body.removeChild(probe);
        if (!styled) need.push('.' + prefix + code + '{font-size:0.72rem; font-weight:800; padding:3px 8px; border-radius:6px; white-space:nowrap; ' + PILL_STYLE[code] + '}');
      });
    });
    if (!need.length) return;
    var st = document.createElement('style');
    st.id = 'omPillFallback';
    st.textContent = need.join('\n');
    document.head.appendChild(st);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function attr(s) { return esc(s).replace(/"/g, '&quot;'); }
  function jsStr(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

  /* ---------- 尺寸解析：「84 × 95 cm」→ {w:84,h:95} ---------- */
  function parseDim(dim) {
    if (!dim) return null;
    var m = String(dim).replace(/[，,]/g, '').match(/(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)/);
    return m ? { w: parseFloat(m[1]), h: parseFloat(m[2]) } : null;
  }
  function dimCompact(dim) {
    var d = parseDim(dim);
    return d ? (d.w + 'x' + d.h + 'cm') : '';
  }
  function quoteName(row) {
    var bits = [];
    var d = dimCompact(row.dim);
    if (d) bits.push(d);
    if (row.qty) bits.push(String(row.qty).replace(/\s*\/\s*/g, '/').trim());
    var spec = String(row.spec).replace(/\s+/g, '');
    return (row.series ? row.series + ' · ' : '') + spec + (bits.length ? ' (' + bits.join(', ') + ')' : '');
  }

  /* ---------- 規格名稱：「小 8L」→ 小 <small>8L</small> ---------- */
  function specHtml(spec) {
    var m = String(spec).match(/^(.*?)\s*(\d+(?:\.\d+)?\s*L)$/i);
    if (m) return esc(m[1]) + ' <small>' + esc(m[2]) + '</small>';
    return esc(spec);
  }

  function colorPills(colors, cls) {
    if (!colors) return '';
    return String(colors).split('|').map(function (c) {
      var p = c.split(':'), name = (p[0] || '').trim(), code = COLOR_CLASS[(p[1] || '').trim()] || 'clear';
      if (!name) return '';
      return '<span class="' + cls + '-' + code + '">' + esc(name) + '</span>';
    }).join(' ');
  }
  function hasRed(colors) { return /(:red\b|紅)/.test(String(colors || '')); }

  /* ---------- 四種版型 ---------- */
  function renderEdm(rows) {
    return rows.map(function (r) {
      var q = jsStr(quoteName(r));
      return '<div class="edm-spec-card-item">' +
        '<div class="edm-spec-card-left">' +
          '<span class="edm-size-pill">' + esc(r.spec) + '</span>' +
          (r.qty ? '<span class="edm-qty-badge">' + esc(r.qty) + '</span>' : '') +
          colorPills(r.colors, 'color-pill') +
        '</div>' +
        '<div class="edm-spec-card-dim">' +
          (parseDim(r.dim)
            ? '<i class="fa-solid fa-ruler-combined"></i> 寬 ' + esc(r.dim)
            : '<i class="fa-solid fa-palette"></i> 可客製尺寸與顏色') +
        '</div>' +
        '<div><button class="btn-quote-add" onclick="toggleQuoteItem(\'' + q + '\', this)">' +
          '<i class="fa-solid fa-plus"></i> 勾選詢價</button></div>' +
      '</div>';
    }).join('');
  }

  function renderCard(rows, scale) {
    return rows.map(function (r, i) {
      var d = parseDim(r.dim), q = jsStr(quoteName(r));
      var red = hasRed(r.colors);
      var accent = red ? '' : ACCENTS[i % ACCENTS.length];
      var shape = d
        ? '<div class="bag-outline-shape' + (red ? ' bag-outline-shape-red' : '') + '" style="width: ' + Math.round(d.w * scale) + 'px; height: ' + Math.round(d.h * scale) + 'px;' +
            (accent ? ' border-color: ' + accent + '; background: ' + accent + '14;' : '') + '">' +
            '<span class="bag-outline-tag">' + esc(volumeTag(r.spec)) + '</span></div>'
        : '';
      return '<div class="scale-card-item">' +
        '<div class="scale-card-top">' +
          '<div class="scale-card-size">' + specHtml(r.spec) + '</div>' +
          '<div style="display: flex; gap: 6px; align-items: center;">' +
            (r.qty ? '<span class="scale-pill-count"' + (accent ? ' style="background: ' + accent + ';"' : '') + '>' + esc(r.qty) + '</span>' : '') +
            colorPills(r.colors, 'scale-pill') +
          '</div>' +
        '</div>' +
        '<div class="bag-contour-box">' + shape + '</div>' +
        (d ? '<div class="scale-card-dim"><i class="fa-solid fa-ruler-combined"></i> 寬 ' + esc(r.dim) + '</div>' : '') +
        '<button class="btn-quote-add" onclick="toggleQuoteItem(\'' + q + '\', this)"><i class="fa-solid fa-plus"></i> 勾選詢價</button>' +
      '</div>';
    }).join('');
  }
  function volumeTag(spec) {
    var m = String(spec).match(/(\d+(?:\.\d+)?\s*L)/i);
    return m ? m[1] : spec;
  }

  function renderRamp(rows, scale, slotH) {
    return rows.map(function (r) {
      var d = parseDim(r.dim), q = jsStr(quoteName(r));
      return '<div class="scale-ramp-item">' +
        '<span class="scale-no-pill">' + esc(r.spec) + '</span>' +
        '<div class="scale-shape-slot" style="height: ' + slotH + 'px;">' +
          (d ? '<div class="scale-bag-shape" style="width: ' + Math.max(8, Math.round(d.w * scale)) + 'px; height: ' + Math.max(9, Math.round(d.h * scale)) + 'px;"></div>' : '') +
        '</div>' +
        (r.dim ? '<span class="scale-dim-label">' + esc(r.dim) + '</span>' : '') +
        (r.qty ? '<span class="scale-qty-label">' + esc(r.qty) + '</span>' : '') +
        '<button class="btn-quote-dark" onclick="toggleQuoteItem(\'' + q + '\', this)"><i class="fa-solid fa-plus"></i> 勾選詢價</button>' +
      '</div>';
    }).join('');
  }

  function renderTable(rows, showQty) {
    return rows.map(function (r) {
      var q = jsStr(quoteName(r));
      return '<tr>' +
        '<td><span class="tag-size">' + esc(r.spec) + '</span></td>' +
        (showQty ? '<td>' + (r.qty ? '<span class="tag-qty">' + esc(r.qty) + '</span>' : '') + '</td>' : '') +
        '<td style="text-align: center;"><button class="btn-quote-add" onclick="toggleQuoteItem(\'' + q + '\', this)">' +
          '<i class="fa-solid fa-plus"></i> 勾選詢價</button></td>' +
      '</tr>';
    }).join('');
  }

  /* ---------- 讀資料 ---------- */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function normalize(list) {
    return list.map(function (r) {
      return {
        page: r['頁面'] || r.page || '',
        block: r['區塊代碼'] || r.block || '',
        series: r['系列名稱'] || r.series || '',
        layout: r['版型'] || r.layout || '',
        spec: r['規格/容量/號數'] || r.spec || '',
        dim: r['尺寸 寬×長'] || r.dim || '',
        qty: r['張數/包裝數'] || r.qty || '',
        colors: r['顏色'] || r.colors || ''
      };
    }).filter(function (r) { return r.block && r.spec; });
  }

  function fromFallback() {
    return Array.isArray(window.PRODUCT_SPECS) ? normalize(window.PRODUCT_SPECS) : [];
  }

  function fromExcel() {
    return fetch(XLSX_PATH, { cache: 'no-cache' })
      .then(function (res) { if (!res.ok) throw new Error('xlsx ' + res.status); return res.arrayBuffer(); })
      .then(function (buf) {
        return (window.XLSX ? Promise.resolve() : loadScript(SHEETJS)).then(function () {
          var wb = window.XLSX.read(buf, { type: 'array' });
          var sheet = wb.Sheets['規格總表'] || wb.Sheets[wb.SheetNames[0]];
          return normalize(window.XLSX.utils.sheet_to_json(sheet, { defval: '' }));
        });
      });
  }

  /* ---------- 繪製 ---------- */
  function paint(rows, source) {
    var containers = [].slice.call(document.querySelectorAll('[data-spec-block]'));
    if (!containers.length) return;

    // 同一頁所有等比例牆共用一個縮放比
    var maxW = 0, maxH = 0;
    rows.forEach(function (r) {
      var d = parseDim(r.dim);
      if (!d) return;
      var used = containers.some(function (c) { return c.getAttribute('data-spec-block') === r.block; });
      if (!used) return;
      if (d.w > maxW) maxW = d.w;
      if (d.h > maxH) maxH = d.h;
    });
    var cardScale = maxW && maxH ? Math.min(105 / maxW, 118 / maxH) : 1;
    var rampScale = maxW && maxH ? Math.min(88 / maxW, 121 / maxH) : 1;

    containers.forEach(function (el) {
      var block = el.getAttribute('data-spec-block');
      var layout = el.getAttribute('data-spec-layout') || 'table';
      var series = el.getAttribute('data-spec-series') || '';
      var mine = rows.filter(function (r) { return r.block === block; })
        .map(function (r) { return Object.assign({}, r, { series: r.series || series }); });

      if (!mine.length) {
        el.innerHTML = layout === 'table'
          ? '<tr><td colspan="3" style="text-align:center; color:#64748B; padding:18px;">規格整理中，歡迎與專員聯繫</td></tr>'
          : '<div style="padding:18px; color:#64748B; font-weight:700;">規格整理中，歡迎與專員聯繫</div>';
        return;
      }
      if (layout === 'edm') el.innerHTML = renderEdm(mine);
      else if (layout === 'card') el.innerHTML = renderCard(mine, cardScale);
      else if (layout === 'ramp') el.innerHTML = renderRamp(mine, rampScale, parseInt(el.getAttribute('data-slot-height') || '130', 10));
      else el.innerHTML = renderTable(mine, el.getAttribute('data-spec-qty') !== 'off');
    });

    // 對比牆點選高亮（原本頁面的事件在渲染前就綁好了，這裡重新綁一次）
    document.querySelectorAll('.scale-ramp-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var track = this.parentElement;
        track.querySelectorAll('.scale-ramp-item').forEach(function (i) { i.classList.remove('active'); });
        this.classList.add('active');
      });
    });
    document.dispatchEvent(new CustomEvent('specsrendered', { detail: { source: source, rows: rows.length } }));
  }

  function start() {
    if (!document.querySelector('[data-spec-block]')) return;
    ensurePillStyles();
    fromExcel()
      .then(function (rows) {
        if (!rows.length) throw new Error('empty sheet');
        paint(rows, 'xlsx');
      })
      .catch(function (err) {
        var fb = fromFallback();
        if (fb.length) {
          paint(fb, 'fallback');
          if (window.console) console.info('[spec-render] 目前用 src/data/specs.js 顯示規格'
            + '（讀不到 Excel：' + err.message + '）。改完 Excel 請用 tools/update-specs.html 轉檔更新此檔；'
            + '網站架上伺服器後會自動改為直接讀取 Excel。');
        } else if (window.console) {
          console.warn('[spec-render] 規格資料讀取失敗：' + err.message);
        }
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
