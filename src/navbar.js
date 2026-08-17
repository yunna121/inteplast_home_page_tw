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
