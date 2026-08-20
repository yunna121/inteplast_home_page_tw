/* ============================================================
   規格表資料驅動渲染 (Spec Render)
   ------------------------------------------------------------
   資料來源優先順序：
   1) src/data/website-data.xlsx 的六個分類工作表 —— Excel 就是唯一資料來源（需架在伺服器上）
   2) src/data/website-data.js (window.SITE_DATA.specs) —— 讀不到 Excel 時的備援快照

   版面：全站統一「左圖右表」— 左邊實拍照片（沒照片的系列改放等比例袋型圖），
        右邊規格表，每一列旁邊附一個依真實尺寸換算的迷你袋型（同頁共用比例尺）。

   Excel 只有商業欄位（產品系列／容量／尺寸級別／尺寸(寬×長)／張數／包裝／顏色）；
   錨點、標題、圖示、照片等版面設定寫在 src/data-map.js 的 SERIES。
   同事在 Excel 新增系列時，該分類頁會自動長出一個新的規格區塊。

   頁面只需要兩個掛載點：
     <div class="filter-pills-bar" data-spec-filters></div>   ← 分類篩選鈕（依 Excel 自動產生）
     <div data-spec-page></div>                               ← 規格區塊
   ============================================================ */
(function () {
  var inProducts = /\/products\//.test(location.pathname);
  var BASE = inProducts ? '../src/' : './src/';
  var JSON_PATH = BASE.replace(/src\/$/, '') + 'content/products.json';
  var XLSX_PATH = BASE + 'data/website-data.xlsx';
  var SHEETJS = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

  var COLOR_CLASS = { clear: 'clear', black: 'black', pink: 'pink', red: 'red', blue: 'blue', green: 'green' };

  var CSS = [
    '.spec-with-photo{display:grid;grid-template-columns:340px 1fr;align-items:stretch;}',
    '@media (max-width:1180px){.spec-with-photo{grid-template-columns:260px 1fr;}.spec-photo-pane{padding:18px;}}',
    '.spec-photo-pane{background:#F8FAFC;border-right:1px solid #E2E8F0;padding:26px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;}',
    '.spec-stage{position:relative;width:100%;height:236px;display:flex;align-items:center;justify-content:center;background:#FFF;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;}',
    '.spec-stage img{width:100%;height:100%;object-fit:contain;padding:10px;}',
    '.spec-stage-empty{font-size:.76rem;font-weight:800;color:#64748B;letter-spacing:.08em;text-align:center;padding:0 18px;line-height:1.8;}',
    '.spec-stage-empty i{display:block;font-size:1.6rem;margin-bottom:8px;color:#94A3B8;}',
    '.spec-scale-view{position:absolute;inset:0;background:#FFF;display:none;align-items:flex-end;justify-content:center;gap:5px;padding:20px 14px;}',
    '.spec-scale-view.on{display:flex;}',
    '.spec-scale-view .spec-mini{border-color:#00529B;background:rgba(0,82,155,.12);}',
    '.spec-scale-toggle{display:inline-flex;align-items:center;gap:7px;background:#FFF;border:1px solid #CBD5E1;color:#00529B;font-family:inherit;font-size:.78rem;font-weight:800;padding:7px 14px;border-radius:8px;cursor:pointer;}',
    '.spec-scale-toggle:hover{border-color:#00529B;background:#EFF6FF;}',
    '.spec-scale-toggle.on{background:#00529B;color:#FFF;border-color:#00529B;}',
    '.spec-photo-caption{font-size:.82rem;font-weight:700;color:#475569;text-align:center;line-height:1.6;min-height:2.6em;}',
    '.spec-grid tbody tr[data-img]{cursor:pointer;}',
    '.spec-grid tbody tr.spec-row-on{background:#DBEAFE !important;box-shadow:inset 3px 0 0 #00529B;}',
    '.spec-has-img{color:#CBD5E1;font-size:.72rem;margin-left:6px;}',
    '.spec-grid tbody tr[data-img]:hover .spec-has-img{color:#00529B;}',
    '.spec-table-pane{display:flex;flex-direction:column;justify-content:flex-start;overflow-x:auto;}',
    '.spec-grid{width:100%;border-collapse:collapse;}',
    '.spec-grid th{background:#0A2540;color:#fff;font-size:.76rem;font-weight:800;letter-spacing:.03em;text-align:left;padding:10px 14px;white-space:nowrap;}',
    '.spec-grid th:last-child,.spec-grid td:last-child{text-align:center;}',
    '.spec-grid td{padding:9px 14px;border-bottom:1px solid #F1F5F9;vertical-align:middle;}',
    '.spec-grid tbody tr:nth-child(even){background:#F8FAFC;}',
    '.spec-grid tbody tr:hover{background:#EFF6FF;}',
    '.spec-name{font-size:.92rem;font-weight:900;color:#0A2540;white-space:nowrap;}',
    '.spec-name small{font-size:.8em;font-weight:800;color:#00529B;}',
    '.spec-dim{font-size:.85rem;font-weight:700;color:#334155;white-space:nowrap;}',
    '.spec-qty{font-size:.78rem;font-weight:800;color:#1E293B;background:#E2E8F0;border-radius:5px;padding:3px 9px;white-space:nowrap;}',
    '.spec-colors{display:flex;flex-wrap:wrap;gap:5px;}',
    '.spec-mini{border:1.5px solid #94A3B8;background:rgba(148,163,184,.14);border-radius:2px 2px 4px 4px;}',
    '.spec-ramp-pane{display:flex;align-items:flex-end;justify-content:center;gap:5px;flex-wrap:nowrap;width:100%;}',
    '.spec-ramp-pane .spec-mini{border-color:#00529B;background:rgba(0,82,155,.12);}',
    '.spec-photo-fallback{font-size:.72rem;font-weight:800;color:#94A3B8;letter-spacing:.06em;}',
    /* 堆疊斷點與 src/responsive.css 的 768px 一致（單一來源，不互相覆蓋） */
    '@media (max-width:768px){.spec-with-photo{grid-template-columns:1fr;}',
    '.spec-photo-pane{border-right:none;border-bottom:1px solid #E2E8F0;}}'
  ].join('');

  var PILL_STYLE = {
    clear: 'background:#FFF;color:#475569;border:1px solid #CBD5E1;',
    black: 'background:#1E293B;color:#FFF;border:1px solid #0F172A;',
    pink: 'background:#FBCFE8;color:#9D174D;border:1px solid #F9A8D4;',
    blue: 'background:#DBEAFE;color:#1E40AF;border:1px solid #BFDBFE;',
    green: 'background:#DCFCE7;color:#166534;border:1px solid #BBF7D0;',
    red: 'background:#FEE2E2;color:#B91C1C;border:1px solid #FECACA;'
  };

  function injectCss() {
    if (document.getElementById('omSpecStyle')) return;
    var pills = Object.keys(PILL_STYLE).map(function (c) {
      return '.spec-pill-' + c + '{font-size:.72rem;font-weight:800;padding:3px 8px;border-radius:6px;white-space:nowrap;' + PILL_STYLE[c] + '}';
    }).join('');
    var st = document.createElement('style');
    st.id = 'omSpecStyle';
    st.textContent = CSS + pills;
    document.head.appendChild(st);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function attr(s) { return esc(s).replace(/"/g, '&quot;'); }
  function jsStr(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

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
    var bits = [], d = dimCompact(row.dim);
    if (d) bits.push(d);
    if (row.qty) bits.push(String(row.qty).replace(/\s*\/\s*/g, '/').trim());
    var spec = String(row.spec).replace(/\s+/g, '');
    return (row.series ? row.series + ' · ' : '') + spec + (bits.length ? ' (' + bits.join(', ') + ')' : '');
  }
  function specHtml(spec) {
    var m = String(spec).match(/^(.*?)\s*(\d+(?:\.\d+)?\s*L)$/i);
    if (m) return esc(m[1]) + ' <small>' + esc(m[2]) + '</small>';
    return esc(spec);
  }
  function colorPills(colors) {
    if (!colors || !colors.length) return '';
    return colors.map(function (c) {
      return '<span class="spec-pill-' + (COLOR_CLASS[c.code] || 'clear') + '">' + esc(c.name) + '</span>';
    }).join('');
  }
  function hasRed(colors) {
    return (colors || []).some(function (c) { return c.code === 'red'; });
  }


  /* ---------- 一個系列 → 左圖右表（左側是可切換的圖片舞台） ---------- */
  function renderBlock(series, rows) {
    var M = window.SITE_MAP;
    var info = M.seriesInfo(series);
    var anyShape = rows.some(function (r) { return parseDim(r.dim); });
    // 「550 mm * 25 y」「7.5cm」這種非寬×長的尺寸也要顯示；
    // 但若它已經当作規格名稱（容量、尺寸級別都空）就不重複列一欄
    var anyDimText = rows.some(function (r) { return r.dim && r.dim !== r.spec; });
    var anyQty = rows.some(function (r) { return r.qty; });
    var anyColor = rows.some(function (r) { return r.colors && r.colors.length; });

    var head = '<tr><th>規格</th>' +
      (anyDimText ? '<th>尺寸</th>' : '') +
      (anyQty ? '<th>張數 / 包裝</th>' : '') +
      (anyColor ? '<th>顏色</th>' : '') +
      '<th>線上詢價</th></tr>';

    var body = rows.map(function (r) {
      var q = jsStr(quoteName(r));
      var img = M.imageFor(r);
      return '<tr' + (img ? ' data-img="' + attr(BASE + img) + '" data-img-label="' + attr(series + ' ' + r.spec) + '" tabindex="0"' : '') + '>' +
        '<td><span class="spec-name">' + specHtml(r.spec) + '</span>' +
          (img ? '<i class="fa-solid fa-image spec-has-img" title="顯示此規格照片"></i>' : '') + '</td>' +
        (anyDimText ? '<td>' + (r.dim && r.dim !== r.spec ? '<span class="spec-dim">' + esc(r.dim) + '</span>' : '<span class="spec-dim" style="color:#94A3B8;">—</span>') + '</td>' : '') +
        (anyQty ? '<td>' + (r.qty ? '<span class="spec-qty">' + esc(r.qty) + '</span>' : '') + '</td>' : '') +
        (anyColor ? '<td><div class="spec-colors">' + colorPills(r.colors) + '</div></td>' : '') +
        '<td><button class="btn-quote-add" onclick="toggleQuoteItem(\'' + q + '\', this)">' +
          '<i class="fa-solid fa-plus"></i> 勾選詢價</button></td>' +
      '</tr>';
    }).join('');

    // 左側預設顯示系列代表圖（同一系列任一列的「圖片檔名」可指定）；還沒有照片的系列先留空位
    var namedCover = '', namedTitle = '';
    rows.some(function (r) { if (r.cover) { namedCover = r.cover; return true; } return false; });
    rows.some(function (r) { if (r.blockTitle) { namedTitle = r.blockTitle; return true; } return false; });
    var namedCaption = '';
    rows.some(function (r) { if (r.caption) { namedCaption = r.caption; return true; } return false; });
    var caption = namedCaption || info.caption;
    var rel = M.coverFor(series, namedCover);
    var cover = rel ? BASE + rel : (info.photo ? BASE + info.photo : '');
    var stage = cover
      ? '<img src="' + attr(cover) + '" alt="' + attr(series) + '實品" data-spec-stage-img>'
      : '<div class="spec-stage-empty" data-spec-stage-img><i class="fa-regular fa-image"></i>' +
          esc(series) + '<br>實品照片準備中</div>';

    // 等比例尺寸對照：收在按鈕後面，需要時才叫出來
    var scaleView = '';
    if (anyShape) {
      var dims = rows.map(function (r) { return parseDim(r.dim); }).filter(Boolean);
      var tallest = Math.max.apply(null, dims.map(function (d) { return d.h; }));
      var sumW = dims.reduce(function (a, d) { return a + d.w; }, 0);
      var avail = 250 - (dims.length - 1) * 5;      // 舞台可用寬度（扣掉間距與內距）
      var big = Math.min(2.4, 190 / tallest, avail / Math.max(1, sumW));
      scaleView = '<div class="spec-scale-view">' + dims.map(function (d) {
        return '<div class="spec-mini" style="width:' + Math.max(4, Math.round(d.w * big)) +
          'px;height:' + Math.max(6, Math.round(d.h * big)) + 'px;"></div>';
      }).join('') + '</div>';
    }

    var pane = '<div class="spec-stage">' + stage + scaleView + '</div>' +
      '<div class="spec-photo-caption" data-spec-caption>' + caption + '</div>' +
      (anyShape ? '<button type="button" class="spec-scale-toggle">' +
        '<i class="fa-solid fa-ruler-combined"></i> 等比例尺寸對照</button>' : '');

    return '<div class="cat-spec-block spec-block" id="' + attr(info.anchor) + '" data-spec-series="' + attr(series) + '">' +
      '<div class="cat-spec-header"><h2 class="cat-spec-title">' +
        '<i class="fa-solid ' + attr(info.icon) + '"></i> ' + esc(namedTitle || info.title) + '</h2></div>' +
      '<div class="spec-with-photo" data-default-img="' + attr(cover) + '" data-default-caption="' + attr(caption) + '">' +
        '<div class="spec-photo-pane">' + pane + '</div>' +
        '<div class="spec-table-pane"><table class="spec-grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '</div>' +
    '</div>';
  }

  /* ---------- 左側圖片：hover / 點選規格時切換 ---------- */
  function showRow(tr) {
    var wrap = tr.closest('.spec-with-photo');
    if (!wrap) return;
    var stage = wrap.querySelector('.spec-stage');
    var cap = wrap.querySelector('[data-spec-caption]');
    var img = tr.getAttribute('data-img');
    if (!img) return;
    wrap.querySelectorAll('tr.spec-row-on').forEach(function (t) { t.classList.remove('spec-row-on'); });
    tr.classList.add('spec-row-on');
    var el = stage.querySelector('[data-spec-stage-img]');
    if (el && el.tagName === 'IMG') {
      el.setAttribute('src', img);
      el.setAttribute('alt', tr.getAttribute('data-img-label') || '');
    } else if (el) {
      var neu = document.createElement('img');
      neu.setAttribute('data-spec-stage-img', '');
      neu.src = img;
      neu.alt = tr.getAttribute('data-img-label') || '';
      el.replaceWith(neu);
    }
    if (cap) cap.textContent = tr.getAttribute('data-img-label') || '';
    var sv = stage.querySelector('.spec-scale-view');
    if (sv) sv.classList.remove('on');
    var tg = wrap.querySelector('.spec-scale-toggle');
    if (tg) tg.classList.remove('on');
  }

  function resetStage(wrap) {
    var stage = wrap.querySelector('.spec-stage');
    var cap = wrap.querySelector('[data-spec-caption]');
    var el = stage.querySelector('[data-spec-stage-img]');
    var def = wrap.getAttribute('data-default-img');
    wrap.querySelectorAll('tr.spec-row-on').forEach(function (t) { t.classList.remove('spec-row-on'); });
    if (cap) cap.innerHTML = wrap.getAttribute('data-default-caption') || '';
    if (!el) return;
    if (def) {
      if (el.tagName === 'IMG') { el.setAttribute('src', def); el.setAttribute('alt', ''); }
      else {
        var neu = document.createElement('img');
        neu.setAttribute('data-spec-stage-img', '');
        neu.src = def;
        el.replaceWith(neu);
      }
    }
  }

  function bindStage() {
    if (document.body.hasAttribute('data-spec-stage-bound')) return;
    document.body.setAttribute('data-spec-stage-bound', '');

    document.addEventListener('mouseover', function (e) {
      var tr = e.target.closest && e.target.closest('.spec-grid tr[data-img]');
      if (tr) showRow(tr);
    });
    document.addEventListener('focusin', function (e) {
      var tr = e.target.closest && e.target.closest('.spec-grid tr[data-img]');
      if (tr) showRow(tr);
    });
    document.addEventListener('click', function (e) {
      var tg = e.target.closest && e.target.closest('.spec-scale-toggle');
      if (tg) {
        var wrap = tg.closest('.spec-with-photo');
        var sv = wrap.querySelector('.spec-scale-view');
        var on = sv.classList.toggle('on');
        tg.classList.toggle('on', on);
        var cap = wrap.querySelector('[data-spec-caption]');
        if (cap) cap.innerHTML = on ? '各尺寸等比例對照（依實際公分換算）' : (wrap.getAttribute('data-default-caption') || '');
        return;
      }
      var tr = e.target.closest && e.target.closest('.spec-grid tr[data-img]');
      if (tr && !e.target.closest('button')) showRow(tr);
    });
    // 滑出整個區塊才還原，避免在表格內移動時閃動
    document.addEventListener('mouseleave', function (e) {
      if (e.target.classList && e.target.classList.contains('spec-with-photo')) resetStage(e.target);
    }, true);
  }

  /* ---------- 讀資料 ---------- */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function fromFallback() {
    var d = window.SITE_DATA || {}, M = window.SITE_MAP;
    return {
      specs: (Array.isArray(d.specs) ? d.specs : []).map(function (r) { return M.resolve(r); })
        .filter(function (r) { return r.series && r.spec; }),
      categories: Array.isArray(d.categories) ? d.categories : []
    };
  }
  function fromJson() {
    return fetch(JSON_PATH, { cache: 'no-cache' })
      .then(function (res) { if (!res.ok) throw new Error('json ' + res.status); return res.json(); })
      .then(function (d) {
        var M = window.SITE_MAP;
        return {
          specs: (d.specs || []).map(function (r) { return M.resolve(r); })
            .filter(function (r) { return r.series && r.spec; }),
          categories: d.categories || []
        };
      });
  }

  function fromExcel() {
    return fetch(XLSX_PATH, { cache: 'no-cache' })
      .then(function (res) { if (!res.ok) throw new Error('xlsx ' + res.status); return res.arrayBuffer(); })
      .then(function (buf) {
        return (window.XLSX ? Promise.resolve() : loadScript(SHEETJS)).then(function () {
          var wb = window.XLSX.read(buf, { type: 'array' });
          return {
            specs: window.SITE_MAP.readWorkbook(wb, window.XLSX),
            categories: window.SITE_MAP.readCategories(wb, window.XLSX)
          };
        });
      });
  }

  function currentPage() {
    var m = location.pathname.match(/([a-z0-9-]+)\.html?$/i);
    return m ? m[1] : '';
  }

  /* 分類頁首圖：依「分類介紹」工作表的「分類封面圖」欄替換
     （檔案放 src/ 或 src/product-img/ 都可，直接寫相對於 src/ 的路徑） */
  function applyHero(cats) {
    var img = document.querySelector('[data-hero-img]');
    if (!img || !cats || !cats.length) return;
    var M = window.SITE_MAP, page = currentPage(), name = '';
    Object.keys(M.pages).forEach(function (k) { if (M.pages[k] === page) name = k; });
    if (!name) return;
    cats.forEach(function (c) {
      if ((c.category || '') !== name) return;
      var file = String(c.hero || '').trim();
      if (file) img.setAttribute('src', BASE + file.replace(/^\.?\/?src\//, ''));
    });
  }

  function paint(rows) {
    var host = document.querySelector('[data-spec-page]');
    if (!host) return;
    var page = host.getAttribute('data-spec-page') || currentPage();
    var mine = rows.filter(function (r) { return r.page === page; });

    if (!mine.length) {
      host.innerHTML = '<div class="cat-spec-block spec-block" style="padding:28px;color:#64748B;font-weight:700;">規格整理中，歡迎與專員聯繫</div>';
      return;
    }

    // 等比例對照圖的比例尺在 renderBlock 内依各系列自行換算
    // Excel 的列順序＝系列與規格的顯示順序
    var order = [], groups = {};
    mine.forEach(function (r) {
      if (!groups[r.series]) { groups[r.series] = []; order.push(r.series); }
      groups[r.series].push(r);
    });
    host.innerHTML = order.map(function (s) { return renderBlock(s, groups[s]); }).join('');
    renderFilters(order);
    bindStage();
    document.dispatchEvent(new CustomEvent('specsrendered', { detail: { rows: mine.length, series: order.length } }));
  }

  /* 篩選鈕也依 Excel 的系列自動產生（新增系列不必改 HTML） */
  function renderFilters(order) {
    var bar = document.querySelector('[data-spec-filters]');
    if (!bar) return;
    var M = window.SITE_MAP;
    bar.innerHTML = '<button class="filter-btn active" onclick="filterCategory(\'all\', this)">' +
        '<i class="fa-solid fa-layer-group"></i> 顯示全部產品 All</button>' +
      order.map(function (s) {
        var info = M.seriesInfo(s);
        return '<button class="filter-btn" onclick="filterCategory(\'' + attr(info.anchor.replace(/^cat-/, '')) + '\', this)">' +
          '<i class="fa-solid ' + attr(info.icon) + '"></i> ' + esc(s) + '</button>';
      }).join('');
  }

  function start() {
    var hasSpecs = !!document.querySelector('[data-spec-page]');
    var hasHero = !!document.querySelector('[data-hero-img]');
    if (!hasSpecs && !hasHero) return;
    if (hasSpecs) injectCss();
    fromJson()
      .catch(function () { return fromExcel(); })
      .then(function (data) {
        if (!data.specs.length) throw new Error('empty sheet');
        applyHero(data.categories);
        if (hasSpecs) paint(data.specs);
      })
      .catch(function (err) {
        var fb = fromFallback();
        if (fb.specs.length || fb.categories.length) {
          applyHero(fb.categories);
          if (hasSpecs) paint(fb.specs);
          if (window.console) console.info('[spec-render] 目前用 src/data/website-data.js 顯示規格'
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
