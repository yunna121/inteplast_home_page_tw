/**
 * INTEPLAST Taiwan — 全站頁首元件（單一來源）
 *
 * 職責：注入集團頂欄 + 頁首導覽、產品錨點平滑滾動、跨頁縮放記憶。
 *
 * 不負責搜尋。搜尋（索引、結果、視窗）一律由 src/site-search.js 提供，
 * 本檔只保留頁首那顆 .search-trigger-btn 按鈕，site-search.js 會接手它的點擊。
 * 原本這裡另有一份 10 筆的 searchIndex 與自己的 modal，與 site-search.js 重複
 * （且 site-search.js 載入時會直接移除它的 #searchModalOverlay），已整段刪除。
 *
 * 頁面用法：<div id="site-header-component"></div>，其餘交給本檔。
 * 頁面內不要再手寫 .top-utility-bar / header.header 的 HTML。
 */
(function () {
  const isSubfolder = window.location.pathname.includes('/products/');
  const rootPath = isSubfolder ? '../' : './';
  const productsPath = isSubfolder ? './' : './products/';

  // 頁面沒自己載 navbar.css 時自動補上
  if (!document.getElementById('site-navbar-css')) {
    const cssLink = document.createElement('link');
    cssLink.id = 'site-navbar-css';
    cssLink.rel = 'stylesheet';
    cssLink.href = `${rootPath}src/navbar.css`;
    document.head.appendChild(cssLink);
  }

  // 瀏覽器分頁圖示（favicon）。原本各頁都沒設，分頁上會顯示瀏覽器預設地球圖示。
  // 集中在這裡注入，五個頁面都不用改 <head>；rootPath 已處理 products/ 子目錄。
  if (!document.querySelector('link[rel="icon"]')) {
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/svg+xml';
    icon.href = `${rootPath}src/inteplast-logo-blue.svg`;
    document.head.appendChild(icon);
    // Safari 分頁釘選用
    const mask = document.createElement('link');
    mask.rel = 'mask-icon';
    mask.href = `${rootPath}src/inteplast-logo-blue.svg`;
    mask.setAttribute('color', '#175EA9');
    document.head.appendChild(mask);
  }

  // 全站字體與字級（src/type.css）。原本五個頁面各自定義字體與級數，
  // 同樣寫 2rem 在不同字體下看起來就是不一樣大。這裡集中注入，五頁都不用改 <head>。
  // 附加在 navbar.css 之後、且在各頁區域樣式之後（head 最後），所以同權重時勝出。
  if (!document.getElementById('site-type-css')) {
    const typeLink = document.createElement('link');
    typeLink.id = 'site-type-css';
    typeLink.rel = 'stylesheet';
    typeLink.href = `${rootPath}src/type.css`;
    document.head.appendChild(typeLink);
  }

  // 公司資訊套用層（src/site-info.js）。頁尾與聯繫我們的電話、信箱、地址
  // 來自 D1 的 settings 表（GET /api/settings），由編輯頁維護。
  // 集中在這裡注入，五個頁面都不用改。
  if (!document.getElementById('site-info-js')) {
    const infoScript = document.createElement('script');
    infoScript.id = 'site-info-js';
    infoScript.src = `${rootPath}src/site-info.js`;
    document.head.appendChild(infoScript);
  }

  // 統一的字體來源。五頁原本各自請求不同組合（Inter+Oswald / Barlow Condensed /
  // Outfit / DM Sans），改為同一組，外部字體請求也跟著減少。
  if (!document.getElementById('site-type-fonts')) {
    const pre1 = document.createElement('link');
    pre1.rel = 'preconnect';
    pre1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(pre1);
    const pre2 = document.createElement('link');
    pre2.rel = 'preconnect';
    pre2.href = 'https://fonts.gstatic.com';
    pre2.crossOrigin = 'anonymous';
    document.head.appendChild(pre2);
    const fonts = document.createElement('link');
    fonts.id = 'site-type-fonts';
    fonts.rel = 'stylesheet';
    fonts.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700;800&family=Noto+Sans+TC:wght@400;500;700;900&display=swap';
    document.head.appendChild(fonts);
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
      <span><i class="fa-solid fa-earth-americas"></i> <span data-tw="相關連結" data-en="Related Links">相關連結</span></span>
      <a href="https://www.fpc.com.tw/fpcw/" target="_blank" rel="noopener"><span data-tw="台灣塑膠工業股份有限公司" data-en="Formosa Plastics Corp.">台灣塑膠工業股份有限公司</span></a>
      <a href="https://www.INTEPLAST.com/" target="_blank" rel="noopener"><span data-tw="INTEPLAST USA" data-en="INTEPLAST USA">INTEPLAST USA</span></a>
    </div>
    <div class="utility-right">
      <a href="${rootPath}sustainability.html"><i class="fa-solid fa-leaf"></i> <span data-tw="永續發展" data-en="Sustainability">永續發展</span></a>
      <a href="https://www.104.com.tw/company/1a2x6bkjw0?jobsource=vipshare" target="_blank" rel="noopener"><i class="fa-solid fa-user-tie"></i> <span data-tw="人才招募" data-en="Careers">人才招募</span></a>
    </div>
  </div>
  <header class="header">
    <a href="${rootPath}index.html" class="header-logo" title="臺灣營德股份有限公司 INTEPLAST TAIWAN CORPORATION">
      <img src="${rootPath}src/ITC Logo.png" alt="臺灣營德股份有限公司 INTEPLAST TAIWAN CORPORATION" class="logo-image">
    </a>

    <ul class="nav-menu">
      <li class="nav-item"><a href="${rootPath}index.html" class="nav-link-item ${activePage === 'home' ? 'active' : ''}" data-tw="首頁" data-en="Home">首頁</a></li>
      <li class="nav-item"><a href="${rootPath}about.html" class="nav-link-item ${activePage === 'about' ? 'active' : ''}" data-tw="關於營德" data-en="About Us">關於營德</a></li>
      <li class="nav-item"><a href="${productsPath}index.html" class="nav-link-item ${activePage === 'products' ? 'active' : ''}" data-tw="產品中心" data-en="Products">產品中心</a></li>
      <li class="nav-item"><a href="${rootPath}sustainability.html" class="nav-link-item ${activePage === 'sustainability' ? 'active' : ''}" data-tw="永續發展" data-en="Sustainability">永續發展</a></li>
      <li class="nav-item"><a href="${rootPath}contact.html" class="nav-link-item ${activePage === 'contact' ? 'active' : ''}" data-tw="聯繫我們" data-en="Contact Us">聯繫我們</a></li>
    </ul>

    <div class="header-right">
      <button class="search-trigger-btn" id="globalSearchTrigger" type="button" aria-label="全站搜尋" title="搜尋產品 (Ctrl+K)">
        <i class="fa-solid fa-magnifying-glass"></i>
      </button>
      <button class="lang-toggle" id="langBtn" type="button" onclick="if (typeof toggleLanguage === 'function') toggleLanguage();" aria-label="切換語言">EN / 繁中</button>
      <a href="${rootPath}contact.html" class="contact-btn"><i class="fa-solid fa-envelope"></i><span data-tw="聯繫我們" data-en="Contact Us">聯繫我們</span></a>
    </div>
  </header>
  `;

  function initNavbar() {
    if (!document.body) return;
    const container = document.getElementById('site-header-component');
    if (container) {
      container.innerHTML = navbarHTML;
      return;
    }
    // 舊頁面還手寫著 header 時的相容路徑：整段換掉，避免兩份頁首並存
    const existingHeader = document.querySelector('header.header');
    const existingUtility = document.querySelector('.top-utility-bar');
    const wrapper = document.createElement('div');
    wrapper.id = 'site-header-component';
    wrapper.innerHTML = navbarHTML;
    if (existingHeader) {
      existingHeader.replaceWith(wrapper);
      if (existingUtility) existingUtility.remove();
    } else {
      document.body.prepend(wrapper);
    }
  }

  // 產品中心下拉細項：同頁錨點改為平滑滾動並避開固定頁首
  document.addEventListener('click', function (e) {
    const link = e.target.closest('.mega-menu-panel-6cat a, .m-nav-sub a');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    const hashIndex = href.indexOf('#');
    if (hashIndex === -1) return;

    const hash = href.substring(hashIndex);
    const isProductsPage = window.location.pathname.includes('/products/') || window.location.pathname.endsWith('products/index.html');
    if (!isProductsPage) return;

    const targetEl = document.getElementById(hash.replace('#', ''));
    if (!targetEl) return;

    e.preventDefault();
    const headerEl = document.querySelector('.header');
    const headerHeight = headerEl ? headerEl.offsetHeight : 80;
    const targetPos = targetEl.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;
    window.scrollTo({ top: targetPos, behavior: 'smooth' });
    if (history.pushState) history.pushState(null, null, hash);
    else location.hash = hash;
  });

  // 跨頁縮放記憶（支援 file:// 直接開啟的情境）
  function applySavedSiteZoom() {
    const savedZoom = localStorage.getItem('siteZoomLevel');
    if (savedZoom) document.documentElement.style.zoom = savedZoom;
  }

  function setZoom(value) {
    const z = Math.min(1.5, Math.max(0.7, value));
    localStorage.setItem('siteZoomLevel', z.toFixed(2));
    document.documentElement.style.zoom = z;
  }

  function currentZoom() {
    return parseFloat(localStorage.getItem('siteZoomLevel') || '1');
  }

  applySavedSiteZoom();

  window.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === '+' || e.key === '=' || e.key === 'NumpadAdd') setZoom(currentZoom() + 0.1);
    else if (e.key === '-' || e.key === 'NumpadSubtract') setZoom(currentZoom() - 0.1);
    else if (e.key === '0' || e.key === 'Numpad0') {
      localStorage.removeItem('siteZoomLevel');
      document.documentElement.style.zoom = '1';
    }
  });

  // 本檔放在 <body> 最上方、placeholder 之後，所以通常這裡就能立刻注入
  // （不等 DOMContentLoaded，頁首才不會在慢速連線下晚一大截才出現）
  if (document.getElementById('site-header-component')) {
    initNavbar();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavbar);
  } else {
    initNavbar();
  }
})();
