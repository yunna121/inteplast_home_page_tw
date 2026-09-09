/* 關於營德 — 專利區改由 D1 提供
   ------------------------------------------------------------
   證書圖、產品圖、專利號都來自 products 的 patent／img／patent_no 欄，
   跟產品中心讀同一份資料 —— 後台換一次，兩頁一起換。

   HTML 裡的圖保留為預設值：API 掛掉或資料還沒填時，頁面照原樣顯示，
   不會開天窗。所以這支只做「有資料就換掉」。 */
(function () {
  function imgSrc(raw) {
    var v = String(raw || '').trim();
    if (!v) return '';
    if (/^(https?:)?\/\//.test(v) || v.charAt(0) === '/') return v;         // /media/… 或外部網址
    v = v.replace(/^\.?\/?src\//, '');
    return v.indexOf('/') > -1 ? './src/' + v : './src/' + v;
  }

  function productSrc(raw) {
    var v = String(raw || '').trim();
    if (!v) return '';
    if (/^(https?:)?\/\//.test(v) || v.charAt(0) === '/') return v;
    v = v.replace(/^\.?\/?src\//, '');
    return v.indexOf('/') > -1 ? './src/' + v : './src/product-img/' + v;
  }

  function apply(rows) {
    var section = document.querySelector('.patent-section');
    if (!section || !rows.length) return;

    // 有填 patent 的產品優先；沒有就找 Scale Sheet（專利本來就是它的）
    var row = null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].patent || '').trim()) { row = rows[i]; break; }
    }
    if (!row) {
      for (var j = 0; j < rows.length; j++) {
        if (/scale\s*sheet/i.test(String(rows[j].name || ''))) { row = rows[j]; break; }
      }
    }
    if (!row) return;

    var cert = section.querySelector('.patent-card img');
    var certSrc = imgSrc(row.patent);
    if (cert && certSrc) {
      cert.src = certSrc;
      cert.alt = String(row.name || '').split('/')[0].trim() + ' 美國專利證書';
    }

    var shot = section.querySelector('.patent-product');
    var shotSrc = productSrc(row.img_home || row.img);
    if (shot && shotSrc) {
      shot.src = shotSrc;
      shot.alt = String(row.name || '').split('/')[0].trim();
    }

    /* 專利號：樣式（.patent-meta）本來就在 CSS 裡但沒有對應的markup，
       所以有填才長出來 —— 沒填就維持現在的版面。 */
    var no = String(row.patent_no || '').trim();
    var card = section.querySelector('.patent-card');
    var existing = section.querySelector('.patent-meta');
    if (no && card && !existing) {
      var meta = document.createElement('div');
      meta.className = 'patent-meta';
      var label = document.createElement('span');
      label.setAttribute('data-tw', '美國專利號');
      label.setAttribute('data-en', 'US PATENT NO.');
      label.textContent = '美國專利號';
      var code = document.createElement('code');
      code.textContent = no;
      meta.appendChild(label);
      meta.appendChild(code);
      card.parentNode.insertBefore(meta, card.nextSibling);
    } else if (existing) {
      var c = existing.querySelector('code');
      if (c) c.textContent = no;
      existing.style.display = no ? '' : 'none';
    }

    if (typeof window.applyLanguage === 'function') window.applyLanguage();
  }

  function start() {
    if (!document.querySelector('.patent-section')) return;
    fetch('/api/products', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { apply(Array.isArray(rows) ? rows : []); })
      .catch(function () { /* 保留 HTML 裡的預設圖 */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
