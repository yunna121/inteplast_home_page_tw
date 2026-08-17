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
      <a href="https://www.fpc.com.tw/fpcw/" target="_blank" rel="noopener"><span class="region-badge">TAIWAN HQ</span> 臺灣塑膠工業股份有限公司</a>
      <a href="https://www.inteplast.com/" target="_blank" rel="noopener">USA Division 美國總部</a>
    </div>
    <div class="utility-right">
      <a href="${rootPath}sustainability.html" data-tw="永續發展" data-en="Sustainability"><i class="fa-solid fa-leaf"></i> 永續發展</a>
      <a href="${rootPath}contact.html" data-tw="人才招募" data-en="Careers"><i class="fa-solid fa-user-tie"></i> 人才招募</a>
    </div>
  </div>
  <header class="header">
    <a href="${rootPath}index.html" class="header-logo">
      <img src="${rootPath}src/inteplast-logo-blue.svg" alt="Inteplast Logo" class="logo-image">
      <div class="logo-text-wrapper">
        <span class="logo-text-tw">臺灣營德股份有限公司</span>
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
              <div class="mega-col-title-sm"><i class="fa-solid fa-dumpster"></i> 01 清潔袋</div>
              <ul class="mega-sub-links">
                <li><a href="${productsPath}can-liners.html">連捲清潔袋</a></li>
                <li><a href="${productsPath}can-liners.html">單張抽取</a></li>
                <li><a href="${productsPath}can-liners.html">環保清潔袋</a></li>
              </ul>
            </div>
            <div>
              <div class="mega-col-title-sm"><i class="fa-solid fa-ribbon"></i> 02 拉繩袋</div>
              <ul class="mega-sub-links">
                <li><a href="${productsPath}draw-tape.html">清潔袋</a></li>
                <li><a href="${productsPath}draw-tape.html">醫療袋</a></li>
              </ul>
            </div>
            <div>
              <div class="mega-col-title-sm"><i class="fa-solid fa-temperature-high"></i> 03 耐熱袋</div>
              <ul class="mega-sub-links">
                <li><a href="${productsPath}foodservice.html">平裝耐熱袋</a></li>
                <li><a href="${productsPath}foodservice.html">捲裝耐熱袋</a></li>
              </ul>
            </div>
            <div>
              <div class="mega-col-title-sm"><i class="fa-solid fa-lock"></i> 04 密封包裝類</div>
              <ul class="mega-sub-links">
                <li><a href="${productsPath}foodservice.html">密實袋</a></li>
                <li><a href="${productsPath}foodservice.html">立體密實袋</a></li>
                <li><a href="${productsPath}foodservice.html">冷凍袋</a></li>
                <li><a href="${productsPath}foodservice.html">夾鏈袋</a></li>
              </ul>
            </div>
            <div>
              <div class="mega-col-title-sm"><i class="fa-solid fa-box"></i> 05 其他類</div>
              <ul class="mega-sub-links">
                <li><a href="${productsPath}foodservice.html">衛生手套</a></li>
                <li><a href="${productsPath}foodservice.html">台塑遮蔽防塵膠帶</a></li>
              </ul>
            </div>
            <div>
              <div class="mega-col-title-sm"><i class="fa-solid fa-sheet-plastic"></i> 06 Scale Sheet</div>
              <ul class="mega-sub-links">
                <li><a href="${productsPath}stretch-films.html">生鮮磅秤切片膜</a></li>
                <li><a href="${productsPath}stretch-films.html">熟食肉品磅秤襯墊</a></li>
              </ul>
            </div>
          </div>
        </div>
      </li>
      <li class="nav-item"><a href="${rootPath}sustainability.html" class="nav-link-item ${activePage === 'sustainability' ? 'active' : ''}" data-tw="永續發展" data-en="Sustainability">永續發展</a></li>
      <li class="nav-item"><a href="${rootPath}contact.html" class="nav-link-item ${activePage === 'contact' ? 'active' : ''}" data-tw="聯繫與詢價" data-en="Contact & RFQ">聯繫與詢價</a></li>
    </ul>

    <div class="header-right">
      <button class="lang-toggle" id="langBtn" type="button" onclick="if(typeof toggleLanguage === 'function') toggleLanguage();" aria-label="切換語言">EN / 繁中</button>
      <a href="${rootPath}contact.html" class="rfq-btn"><i class="fa-solid fa-paper-plane"></i><span data-tw="立即詢價" data-en="Get a Quote">立即詢價</span></a>
    </div>
  </header>
  `;

  function initNavbar() {
    let container = document.getElementById('site-header-component');
    if (!container) {
      container = document.createElement('div');
      container.id = 'site-header-component';
      document.body.prepend(container);
    }
    container.innerHTML = navbarHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavbar);
  } else {
    initNavbar();
  }
})();
