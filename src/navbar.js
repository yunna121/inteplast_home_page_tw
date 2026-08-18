/**
 * Inteplast Taiwan Modular Navbar Component
 * Synchronizes Top Utility Bar & Header Navigation across all pages automatically.
 */
(function () {
  const isSubfolder = window.location.pathname.includes('/products/');
  const rootPath = isSubfolder ? '../' : './';
  const productsPath = isSubfolder ? './' : './products/';

  // Auto-inject navbar CSS if not loaded
  if (!document.getElementById('site-navbar-css')) {
    const cssLink = document.createElement('link');
    cssLink.id = 'site-navbar-css';
    cssLink.rel = 'stylesheet';
    cssLink.href = `${rootPath}src/navbar.css`;
    document.head.appendChild(cssLink);
  }

  const pathName = window.location.pathname.toLowerCase();
  let activePage = 'home';
  if (pathName.includes('about')) activePage = 'about';
  else if (pathName.includes('sustainability')) activePage = 'sustainability';
  else if (pathName.includes('contact')) activePage = 'contact';
  else if (pathName.includes('products')) activePage = 'products';

  const navbarHTML = `
  <div class="top-utility-bar">
    <div class="utility-left">
      <span><i class="fa-solid fa-earth-americas"></i> INTEPLAST GROUP GLOBAL NETWORK</span>
      <a href="https://www.fpc.com.tw/fpcw/" target="_blank" rel="noopener"><span class="region-badge">TAIWAN HQ</span> <span data-tw="臺灣塑膠工業股份有限公司" data-en="Formosa Plastics Corp.">臺灣塑膠工業股份有限公司</span></a>
      <a href="https://www.inteplast.com/" target="_blank" rel="noopener"><span data-tw="USA Division 美國總部" data-en="USA Division Inteplast Group">USA Division 美國總部</span></a>
    </div>
    <div class="utility-right">
      <a href="${rootPath}sustainability.html" data-tw="永續發展" data-en="Sustainability"><i class="fa-solid fa-leaf"></i> <span data-tw="永續發展" data-en="Sustainability">永續發展</span></a>
      <a href="${rootPath}contact.html" data-tw="人才招募" data-en="Careers"><i class="fa-solid fa-user-tie"></i> <span data-tw="人才招募" data-en="Careers">人才招募</span></a>
    </div>
  </div>
  <header class="header">
    <a href="${rootPath}index.html" class="header-logo">
      <img src="${rootPath}src/inteplast-logo-blue.svg" alt="Inteplast Logo" class="logo-image">
      <div class="logo-text-wrapper">
        <span class="logo-text-tw" data-tw="臺灣營德股份有限公司" data-en="Inteplast Taiwan Corporation">臺灣營德股份有限公司</span>
        <span class="logo-text-en">INTEPLAST TAIWAN CORPORATION</span>
      </div>
    </a>

    <ul class="nav-menu">
      <li class="nav-item"><a href="${rootPath}index.html" class="nav-link-item ${activePage === 'home' ? 'active' : ''}" data-tw="首頁" data-en="Home">首頁</a></li>
      <li class="nav-item"><a href="${rootPath}about.html" class="nav-link-item ${activePage === 'about' ? 'active' : ''}" data-tw="關於營德" data-en="About Us">關於營德</a></li>

      <li class="nav-item">
        <a href="${productsPath}index.html" class="nav-link-item product-menu-trigger ${activePage === 'products' ? 'active' : ''}" data-tw="產品中心" data-en="Products">產品中心 <i class="fa-solid fa-chevron-down caret-icon"></i></a>
        <div class="mega-menu-panel-6cat">
          <div class="mega-grid-6">
            <div>
              <div class="mega-col-title-sm"><i class="fa-solid fa-dumpster"></i> <span data-tw="01 清潔袋" data-en="01 Can Liners">01 清潔袋</span></div>
              <ul class="mega-sub-links">
                <li><a href="${productsPath}can-liners.html" data-tw="連捲清潔袋" data-en="Coreless Roll Liners">連捲清潔袋</a></li>
                <li><a href="${productsPath}can-liners.html" data-tw="單張抽取" data-en="Interleaved Flat Bags">單張抽取</a></li>
                <li><a href="${productsPath}can-liners.html" data-tw="環保清潔袋" data-en="Eco Recycled Bags">環保清潔袋</a></li>
              </ul>
            </div>
            <div>
              <div class="mega-col-title-sm"><i class="fa-solid fa-ribbon"></i> <span data-tw="02 拉繩袋" data-en="02 Drawtape Bags">02 拉繩袋</span></div>
              <ul class="mega-sub-links">
                <li><a href="${productsPath}draw-tape.html" data-tw="清潔袋" data-en="Drawtape Trash Bags">清潔袋</a></li>
                <li><a href="${productsPath}draw-tape.html" data-tw="醫療袋" data-en="Medical Drawtape Bags">醫療袋</a></li>
              </ul>
            </div>
            <div>
              <div class="mega-col-title-sm"><i class="fa-solid fa-temperature-high"></i> <span data-tw="03 耐熱袋" data-en="03 Foodservice Bags">03 耐熱袋</span></div>
              <ul class="mega-sub-links">
                <li><a href="${productsPath}foodservice.html" data-tw="平裝耐熱袋" data-en="Flat Heat-Resistant Bags">平裝耐熱袋</a></li>
                <li><a href="${productsPath}foodservice.html" data-tw="捲裝耐熱袋" data-en="Roll Heat-Resistant Bags">捲裝耐熱袋</a></li>
              </ul>
            </div>
            <div>
              <div class="mega-col-title-sm"><i class="fa-solid fa-lock"></i> <span data-tw="04 密封包裝類" data-en="04 Storage & Zipper Bags">04 密封包裝類</span></div>
              <ul class="mega-sub-links">
                <li><a href="${productsPath}foodservice.html" data-tw="密實袋" data-en="Seal Top Bags">密實袋</a></li>
                <li><a href="${productsPath}foodservice.html" data-tw="立體密實袋" data-en="Stand-Up Zipper Bags">立體密實袋</a></li>
                <li><a href="${productsPath}foodservice.html" data-tw="冷凍袋" data-en="Freezer Bags">冷凍袋</a></li>
                <li><a href="${productsPath}foodservice.html" data-tw="夾鏈袋" data-en="Reclosable Zipper Bags">夾鏈袋</a></li>
              </ul>
            </div>
            <div>
              <div class="mega-col-title-sm"><i class="fa-solid fa-box"></i> <span data-tw="05 其他類" data-en="05 Specialty Products">05 其他類</span></div>
              <ul class="mega-sub-links">
                <li><a href="${productsPath}foodservice.html" data-tw="衛生手套" data-en="PE Disposable Gloves">衛生手套</a></li>
                <li><a href="${productsPath}foodservice.html" data-tw="台塑遮蔽防塵膠帶" data-en="Pre-taped Masking Film">台塑遮蔽防塵膠帶</a></li>
              </ul>
            </div>
            <div>
              <div class="mega-col-title-sm"><i class="fa-solid fa-sheet-plastic"></i> <span data-tw="06 Scale Sheet" data-en="06 Scale Sheet">06 Scale Sheet</span></div>
              <ul class="mega-sub-links">
                <li><a href="${productsPath}stretch-films.html" data-tw="生鮮磅秤切片膜" data-en="Fresh Produce Scale Sheets">生鮮磅秤切片膜</a></li>
                <li><a href="${productsPath}stretch-films.html" data-tw="熟食肉品磅秤襯墊" data-en="Deli & Meat Scale Liners">熟食肉品磅秤襯墊</a></li>
              </ul>
            </div>
          </div>
        </div>
      </li>
      <li class="nav-item"><a href="${rootPath}sustainability.html" class="nav-link-item ${activePage === 'sustainability' ? 'active' : ''}" data-tw="永續發展" data-en="Sustainability">永續發展</a></li>
      <li class="nav-item"><a href="${rootPath}contact.html" class="nav-link-item ${activePage === 'contact' ? 'active' : ''}" data-tw="聯繫我們" data-en="Contact Us">聯繫我們</a></li>
    </ul>

    <div class="header-right">
      <button class="search-trigger-btn" id="globalSearchTrigger" type="button" aria-label="全站搜尋" title="搜尋產品 (Ctrl+K)">
        <i class="fa-solid fa-magnifying-glass"></i>
      </button>
      <button class="lang-toggle" id="langBtn" type="button" onclick="if(typeof toggleLanguage === 'function') toggleLanguage();" aria-label="切換語言">EN / 繁中</button>
      <a href="${rootPath}contact.html" class="rfq-btn"><i class="fa-solid fa-envelope"></i><span data-tw="聯繫我們" data-en="Contact Us">聯繫我們</span></a>
    </div>
  </header>
  `;

  const searchIndex = [
    {
      title: '清潔袋系列 (Can Liners & Trash Bags)',
      desc: '連捲清潔袋、單張抽取清潔袋、商業高強度防漏底封與環保清潔袋系列。',
      category: '清潔袋 01',
      url: `${productsPath}can-liners.html`,
      icon: 'fa-dumpster',
      keywords: ['清潔袋', '垃圾袋', '連捲', '單張', '環保袋', 'can liners', 'trash bags', 'roll liners', 'eco bags']
    },
    {
      title: '拉繩袋系列 (Draw-Tape & Medical Bags)',
      desc: '加長拉繩一拉即束、方便拎舉打包，醫療等級隔離警示袋。',
      category: '拉繩袋 02',
      url: `${productsPath}draw-tape.html`,
      icon: 'fa-ribbon',
      keywords: ['拉繩袋', '拉繩', '醫療袋', '束口袋', '提把袋', 'drawtape', 'drawstring', 'medical bags']
    },
    {
      title: '耐熱袋系列 (Foodservice Heat-Resistant Bags)',
      desc: '平裝耐熱袋與捲裝耐熱袋，高強度 PE 耐熱食品級配方。',
      category: '耐熱袋 03',
      url: `${productsPath}foodservice.html`,
      icon: 'fa-temperature-high',
      keywords: ['耐熱袋', '平裝', '捲裝', '食品袋', '高溫', 'heat resistant', 'foodservice', 'hdpe']
    },
    {
      title: '密封包裝類 (Zipper & Freezer Bags)',
      desc: '雙軌密封密實袋、立體密實袋、冷凍保鮮袋與夾鏈袋。',
      category: '密封包裝 04',
      url: `${productsPath}foodservice.html`,
      icon: 'fa-lock',
      keywords: ['密實袋', '夾鏈袋', '冷凍袋', '密封袋', '立體袋', 'zipper bags', 'freezer bags', 'seal top']
    },
    {
      title: '衛生手套 (PE Disposable Gloves)',
      desc: '輕薄貼手衛生手套，適合餐飲備料、食品處理與日常清潔家務。',
      category: '其他類 05',
      url: `${productsPath}foodservice.html`,
      icon: 'fa-hand-dots',
      keywords: ['手套', '衛生手套', '塑膠手套', '一次性手套', 'gloves', 'pe gloves', 'disposable gloves']
    },
    {
      title: '台塑遮蔽防塵膠帶 (Pre-taped Masking Film)',
      desc: '台塑專利遮蔽防塵膠帶，適用於建築施工、裝潢修繕與居家防塵。',
      category: '其他類 05',
      url: `${productsPath}foodservice.html`,
      icon: 'fa-tape',
      keywords: ['膠帶', '遮蔽膠帶', '防塵膠帶', '台塑膠帶', 'masking film', 'taped film', 'masking tape']
    },
    {
      title: 'Scale Sheet (生鮮磅秤切片膜與襯墊)',
      desc: '生鮮超市磅秤切片膜與熟食肉品襯墊膜，撕取流暢高透明度。',
      category: 'Scale Sheet 06',
      url: `${productsPath}stretch-films.html`,
      icon: 'fa-sheet-plastic',
      keywords: ['scale sheet', '磅秤', '切片膜', '襯墊', '生鮮膜', '熟食膜', 'deli liner', 'produce sheet']
    },
    {
      title: '國家環保標章產品專區 (Green Mark Certified)',
      desc: '通過環境部審查之台塑環保拉繩清潔袋與台塑環保清潔袋使用證書。',
      category: '永續發展',
      url: `${rootPath}sustainability.html`,
      icon: 'fa-leaf',
      keywords: ['環保標章', '永續發展', 'esg', '再生塑膠', 'sustainability', 'eco mark', 'green mark', 'recycled']
    },
    {
      title: '關於臺灣營德 (About Inteplast Taiwan)',
      desc: '台塑關係企業與美商營德合資大廠，嘉義新港廠區 703 噸/月自動化基地。',
      category: '關於我們',
      url: `${rootPath}about.html`,
      icon: 'fa-building-user',
      keywords: ['關於營德', '新港廠', '嘉義廠', 'iso 9001', '卓越營運獎', 'about us', 'xingang']
    },
    {
      title: '聯繫我們 (Contact Us)',
      desc: '留下您的聯絡資訊與需求，我們的業務團隊將安排專人與您聯繫。',
      category: '聯繫我們',
      url: `${rootPath}contact.html`,
      icon: 'fa-envelope',
      keywords: ['聯繫', '聯絡', '報價', '諮詢', 'contact', 'inquiry']
    }
  ];

  function renderSearchResults(query) {
    const resultsList = document.getElementById('searchResultsList');
    if (!resultsList) return;
    const q = (query || '').trim().toLowerCase();
    resultsList.innerHTML = '';

    const filtered = searchIndex.filter(item => {
      if (!q) return true;
      return item.title.toLowerCase().includes(q) ||
             item.desc.toLowerCase().includes(q) ||
             item.category.toLowerCase().includes(q) ||
             item.keywords.some(k => k.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
      resultsList.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #64748B;">
          <i class="fa-solid fa-magnifying-glass" style="font-size: 2rem; margin-bottom: 12px; opacity: 0.5;"></i>
          <p style="font-size: 0.95rem; font-weight: 700;">找不到與「${query}」相符的產品</p>
          <p style="font-size: 0.85rem; margin-top: 4px;">請嘗試更換關鍵字，或點選下方按鈕直接聯繫團隊報價。</p>
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const itemEl = document.createElement('a');
      itemEl.className = 'search-result-item';
      itemEl.href = item.url;
      itemEl.innerHTML = `
        <div class="search-result-icon"><i class="fa-solid ${item.icon}"></i></div>
        <div class="search-result-info">
          <div class="search-result-title">${item.title}</div>
          <div class="search-result-desc">${item.desc}</div>
        </div>
        <span class="search-result-category">${item.category}</span>
      `;
      resultsList.appendChild(itemEl);
    });
  }

  function initSearchModal() {
    if (!document.body) return;
    if (!document.getElementById('searchModalOverlay')) {
      const modalHTML = `
      <div id="searchModalOverlay" class="search-modal-overlay">
        <div class="search-modal-container">
          <div class="search-input-header">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input type="text" id="searchInputField" class="search-input-field" placeholder="搜尋產品、規格或關鍵字... (例如: 清潔袋, 拉繩, 耐熱袋, 密實袋, 環保標章, Gloves...)" autocomplete="off">
            <button id="closeSearchModal" class="close-search-modal-btn" type="button" onclick="if(typeof closeSearchModal === 'function') closeSearchModal();" aria-label="關閉搜尋"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="search-quick-tags">
            <span class="search-tag-label" data-tw="快速篩選：" data-en="Quick Tags:">快速篩選：</span>
            <button class="quick-tag-btn" type="button" data-query="清潔袋">清潔袋</button>
            <button class="quick-tag-btn" type="button" data-query="拉繩袋">拉繩袋</button>
            <button class="quick-tag-btn" type="button" data-query="耐熱袋">耐熱袋</button>
            <button class="quick-tag-btn" type="button" data-query="密實袋">密實袋</button>
            <button class="quick-tag-btn" type="button" data-query="手套">衛生手套</button>
            <button class="quick-tag-btn" type="button" data-query="環保標章">環保標章</button>
            <button class="quick-tag-btn" type="button" data-query="Scale Sheet">Scale Sheet</button>
          </div>
          <div id="searchResultsList" class="search-results-list"></div>
          <div class="search-modal-footer">
            <span><kbd>ESC</kbd> 關閉搜尋</span>
            <span><kbd>Ctrl + K</kbd> 快速開啟</span>
          </div>
        </div>
      </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    const overlay = document.getElementById('searchModalOverlay');
    const input = document.getElementById('searchInputField');

    if (input && !input.dataset.bound) {
      input.dataset.bound = 'true';
      input.addEventListener('input', function() {
        renderSearchResults(this.value);
      });
    }
  }

  window.openSearchModal = function() {
    initSearchModal();
    const overlay = document.getElementById('searchModalOverlay');
    const input = document.getElementById('searchInputField');
    if (overlay) {
      overlay.classList.add('active');
      renderSearchResults(input ? input.value : '');
      setTimeout(() => { if (input) input.focus(); }, 100);
    }
  };

  window.closeSearchModal = function() {
    const overlay = document.getElementById('searchModalOverlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  };

  document.addEventListener('click', function(e) {
    const overlay = document.getElementById('searchModalOverlay');
    if (!overlay) return;

    if (e.target.closest('#globalSearchTrigger') || e.target.closest('.search-trigger-btn')) {
      window.openSearchModal();
    } else if (e.target === overlay || e.target.closest('#closeSearchModal')) {
      window.closeSearchModal();
    } else if (e.target.classList.contains('quick-tag-btn')) {
      const query = e.target.getAttribute('data-query');
      const input = document.getElementById('searchInputField');
      if (input) input.value = query;
      renderSearchResults(query);
      if (input) input.focus();
    }
  });

  document.addEventListener('keydown', function(e) {
    const overlay = document.getElementById('searchModalOverlay');
    if (!overlay) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (overlay.classList.contains('active')) window.closeSearchModal();
      else window.openSearchModal();
    } else if (e.key === 'Escape' && overlay.classList.contains('active')) {
      window.closeSearchModal();
    }
  });

  function initNavbar() {
    if (!document.body) return;
    let container = document.getElementById('site-header-component');
    if (!container) {
      container = document.createElement('div');
      container.id = 'site-header-component';
      document.body.prepend(container);
    }
    container.innerHTML = navbarHTML;
  }

  // 全站跨頁縮放同步 Engine (支援本地 file:// 與線上伺服器 100% 同步)
  function applySavedSiteZoom() {
    const savedZoom = localStorage.getItem('siteZoomLevel');
    if (savedZoom) {
      document.documentElement.style.zoom = savedZoom;
    }
  }

  applySavedSiteZoom();

  window.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '+' || e.key === '=' || e.key === 'NumpadAdd') {
        let currentZoom = parseFloat(localStorage.getItem('siteZoomLevel') || '1');
        currentZoom = Math.min(1.5, currentZoom + 0.1);
        localStorage.setItem('siteZoomLevel', currentZoom.toFixed(2));
        document.documentElement.style.zoom = currentZoom;
      } else if (e.key === '-' || e.key === 'NumpadSubtract') {
        let currentZoom = parseFloat(localStorage.getItem('siteZoomLevel') || '1');
        currentZoom = Math.max(0.7, currentZoom - 0.1);
        localStorage.setItem('siteZoomLevel', currentZoom.toFixed(2));
        document.documentElement.style.zoom = currentZoom;
      } else if (e.key === '0' || e.key === 'Numpad0') {
        localStorage.removeItem('siteZoomLevel');
        document.documentElement.style.zoom = '1';
      }
    }
  });

  window.addEventListener('wheel', function(e) {
    if (e.ctrlKey || e.metaKey) {
      let currentZoom = parseFloat(localStorage.getItem('siteZoomLevel') || '1');
      if (e.deltaY < 0) {
        currentZoom = Math.min(1.5, currentZoom + 0.05);
      } else {
        currentZoom = Math.max(0.7, currentZoom - 0.05);
      }
      localStorage.setItem('siteZoomLevel', currentZoom.toFixed(2));
      document.documentElement.style.zoom = currentZoom;
    }
  }, { passive: false });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initNavbar();
      initSearchModal();
      applySavedSiteZoom();
    });
  } else {
    initNavbar();
    initSearchModal();
    applySavedSiteZoom();
  }
})();
