/* ============================================================
   全站頁尾（單一來源）
   ------------------------------------------------------------
   為什麼用 JS 注入：五個頁面原本各寫一份頁尾（欄位、內距、顏色都不同），
   要加網站導覽就得改五個檔案、日後也會各自長歪。這裡集中一份，
   有 <footer class="footer"> 或 #site-footer-component 就換掉它的內容。

   語言切換沿用 data-tw / data-en（src/site-lang.js）；
   公司資訊沿用 data-site（src/content.js 會用後台內容覆蓋）；
   年份沿用 {{year}}（src/site-year.js）。
   ============================================================ */
(function () {
  var inProducts = /\/products\//.test(location.pathname);
  var ROOT = inProducts ? '../' : '';

  var CSS = `
  .site-footer {
    padding: 56px 40px 24px;
    color: rgba(255,255,255,0.72);
    background: #0A2540;
    font-size: 0.9rem;
    text-align: left;
  }
  .sf-grid {
    max-width: 1350px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(0, 1fr));
    gap: 40px;
  }
  /* logo 本身是深藍色，直接放在深藍頁尾上會看不見；
     用白色圓角牌襯底（與首頁封面那顆品牌牌一致），不必另做白色版圖檔。 */
  .sf-brand {
    display: inline-flex;
    align-items: center;
    padding: 12px 20px;
    background: #FFFFFF;
    border-radius: 14px;
  }
  .sf-logo { height: 46px; width: auto; object-fit: contain; display: block; }
  .sf-contact { margin-top: 18px; display: grid; gap: 8px; font-size: 0.84rem; line-height: 1.6; }
  .sf-contact div { display: flex; gap: 9px; align-items: flex-start; }
  .sf-contact i { margin-top: 3px; color: #7FC4F0; font-size: 0.82rem; flex: 0 0 14px; }
  .sf-contact a { color: rgba(255,255,255,0.82); text-decoration: none; overflow-wrap: anywhere; }
  .sf-contact a:hover { color: #7FC4F0; }

  .sf-col-title {
    margin-bottom: 14px;
    color: #FFFFFF;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .sf-links { display: grid; gap: 9px; }
  .sf-links a {
    color: rgba(255,255,255,0.72);
    text-decoration: none;
    font-size: 0.86rem;
    line-height: 1.5;
    width: fit-content;
  }
  .sf-links a:hover { color: #FFFFFF; }
  .sf-links a i { margin-left: 6px; font-size: 0.68rem; opacity: 0.6; }

  .sf-bottom {
    max-width: 1350px;
    margin: 40px auto 0;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.12);
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    align-items: center;
    justify-content: space-between;
    font-size: 0.78rem;
    color: rgba(255,255,255,0.55);
  }
  .sf-bottom a { color: rgba(255,255,255,0.55); text-decoration: none; }
  .sf-bottom a:hover { color: #FFFFFF; }

  /* 回到頁首：首頁本來就有自己的一顆（#backToTopBtn），
     其餘頁面由本檔補上，樣式與首頁一致。 */
  .sf-top-btn {
    position: fixed;
    right: 32px;
    bottom: 32px;
    z-index: 900;
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 50%;
    background: rgba(10, 37, 64, 0.72);
    backdrop-filter: blur(10px);
    color: #FFFFFF;
    font-size: 1rem;
    cursor: pointer;
    opacity: 0;
    visibility: hidden;
    transform: translateY(8px);
    transition: opacity .3s ease, visibility .3s ease, transform .3s ease, background .2s ease;
  }
  .sf-top-btn.visible { opacity: 1; visibility: visible; transform: none; }
  .sf-top-btn:hover { background: rgba(0, 82, 155, 0.92); border-color: rgba(0, 168, 255, 0.5); }

  @media (max-width: 1024px) {
    .sf-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; }
  }
  @media (max-width: 768px) {
    .sf-top-btn { right: 20px; bottom: 24px; width: 44px; height: 44px; }
  }
  @media (max-width: 768px) {
    .site-footer { padding: 36px 14px 20px; }
    .sf-brand { padding: 10px 16px; }
    .sf-logo { height: 40px; }
    /* 單欄時 16 個連結會排成近 1000px 的長條；
       短標題（網站導覽、產品分類）改兩欄，並用細分隔線分段。 */
    .sf-grid { grid-template-columns: 1fr; gap: 0; }
    .sf-col { padding: 20px 0; border-top: 1px solid rgba(255,255,255,0.12); }
    .sf-col-title { margin-bottom: 12px; }
    .sf-col--nav .sf-links,
    .sf-col--cat .sf-links { grid-template-columns: 1fr 1fr; column-gap: 16px; row-gap: 12px; }
    .sf-links a { font-size: 0.88rem; }
    .sf-bottom { margin-top: 4px; flex-direction: column; align-items: flex-start; gap: 6px; }
  }
  `;

  /* 文字放在內層 span：src/site-lang.js 會整段換掉 [data-tw] 的 innerHTML，
     外連圖示若跟文字同層會被搬到前面。 */
  function link(href, tw, en, external) {
    return '<a href="' + href + '"' + (external ? ' target="_blank" rel="noopener"' : '') + '>' +
      '<span data-tw="' + tw + '" data-en="' + en + '">' + tw + '</span>' +
      (external ? '<i class="fa-solid fa-arrow-up-right-from-square"></i>' : '') + '</a>';
  }

  var P = ROOT + 'products/index.html';

  var HTML =
    '<div class="sf-grid">' +
      '<div>' +
        '<a class="sf-brand" href="' + ROOT + 'index.html" title="臺灣營德股份有限公司 INTEPLAST TAIWAN CORPORATION">' +
          '<img class="sf-logo" src="' + ROOT + 'src/ITC Logo.png" alt="臺灣營德股份有限公司 INTEPLAST TAIWAN CORPORATION">' +
        '</a>' +
        '<div class="sf-contact">' +
          '<div><i class="fa-solid fa-location-dot"></i><span data-site="address" data-tw="臺北市松山區敦化北路205號6樓609室" data-en="Rm. 609, 6F., No. 205, Dunhua N. Rd., Songshan Dist., Taipei City, Taiwan">臺北市松山區敦化北路205號6樓609室</span></div>' +
          '<div><i class="fa-solid fa-phone"></i><a href="tel:0227122211,8109" data-site="phone">02-2712-2211 #8109</a></div>' +
          '<div><i class="fa-solid fa-envelope"></i><a href="mailto:lyanchen@wpjk.inteplast.com" data-site-href="email" data-site="email">lyanchen@wpjk.inteplast.com</a></div>' +
        '</div>' +
      '</div>' +

      '<div class="sf-col sf-col--nav">' +
        '<div class="sf-col-title" data-tw="網站導覽" data-en="Site Map">網站導覽</div>' +
        '<div class="sf-links">' +
          link(ROOT + 'index.html', '首頁', 'Home') +
          link(ROOT + 'about.html', '關於營德', 'About Us') +
          link(P, '產品中心', 'Products') +
          link(ROOT + 'sustainability.html', '永續發展', 'Sustainability') +
          link(ROOT + 'contact.html', '聯繫我們', 'Contact Us') +
        '</div>' +
      '</div>' +

      '<div class="sf-col sf-col--cat">' +
        '<div class="sf-col-title" data-tw="產品分類" data-en="Categories">產品分類</div>' +
        '<div class="sf-links">' +
          link(P + '#cat-can-liners', '清潔袋', 'Can Liners') +
          link(P + '#cat-draw-tape', '拉繩袋', 'Draw Tape Liners') +
          link(P + '#cat-heat-bags', '蔬果袋', 'Produce Bags') +
          link(P + '#cat-sealed-packaging', '夾鏈袋', 'Zipper Bags') +
          link(P + '#cat-gloves', '多功能手套', 'Gloves') +
          link(P + '#cat-masking-film', '遮蔽防塵膠帶', 'Masking Film') +
          link(P + '#cat-stretch-films', 'Scale Sheet', 'Scale Sheet') +
        '</div>' +
      '</div>' +

      '<div class="sf-col sf-col--rel">' +
        '<div class="sf-col-title" data-tw="相關連結" data-en="Related Links">相關連結</div>' +
        '<div class="sf-links">' +
          link('https://www.fpc.com.tw/fpcw/', '台灣塑膠工業股份有限公司', 'Formosa Plastics Corp.', true) +
          link('https://www.inteplast.com/', 'Inteplast USA', 'Inteplast USA', true) +
          link('https://www.104.com.tw/company/1a2x6bkjw0?jobsource=vipshare', '人才招募', 'Careers', true) +
          link(ROOT + 'sustainability.html', '環保標章產品', 'Green Mark Products') +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="sf-bottom">' +
      '<span data-site="copyright">© {{year}} INTEPLAST TAIWAN CORPORATION. All Rights Reserved.</span>' +
      '<span data-tw="嘉義新港生產基地 · ISO 9001 品質管理系統認證" data-en="Xingang, Chiayi production hub · ISO 9001 certified">嘉義新港生產基地 · ISO 9001 品質管理系統認證</span>' +
    '</div>';

  function injectCss() {
    if (document.getElementById('siteFooterCss')) return;
    var st = document.createElement('style');
    st.id = 'siteFooterCss';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* 回到頁首按鈕（首頁已有自己的一顆就不重複加） */
  function buildTopButton() {
    if (document.getElementById('backToTopBtn') || document.querySelector('.sf-top-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sf-top-btn';
    btn.setAttribute('aria-label', '回到頁首 / Back to top');
    btn.title = '回到頁首';
    btn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);

    var onScroll = function () {
      btn.classList.toggle('visible', window.scrollY > 350);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function build() {
    if (document.querySelector('.site-footer')) { injectCss(); buildTopButton(); return; }
    var host = document.getElementById('site-footer-component') || document.querySelector('footer.footer');
    if (!host) return;
    injectCss();
    // 舊頁尾各自帶著 padding／背景色的行內樣式，一律清掉再換內容
    host.removeAttribute('style');
    host.className = 'site-footer';
    host.innerHTML = HTML;
    // 年份與語言的套用時機可能早於本檔，補跑一次
    if (typeof window.applyYearTokens === 'function') window.applyYearTokens(host);
    else host.innerHTML = host.innerHTML.replace(/\{\{year\}\}/g, new Date().getFullYear());
    if (typeof window.applyLanguage === 'function') window.applyLanguage();
    buildTopButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
