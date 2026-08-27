/* ============================================================
   手機版導覽抽屜 (Mobile Nav Drawer)
   ------------------------------------------------------------
   1000px 以下桌機選單被隱藏，手機原本沒有任何導覽入口。
   這支腳本會複製頁首既有的 .nav-menu 內容，產生漢堡按鈕與
   側滑抽屜（產品中心以手風琴展開），選單內容自動同步，
   不需要另外維護一份選單。
   ============================================================ */
(function () {
  var CSS = `
  .m-nav-toggle {
    display: none;
    background: #F1F5F9; border: 1px solid #E2E8F0; color: #0F172A;
    width: 40px; height: 40px; border-radius: 10px;
    align-items: center; justify-content: center; font-size: 1.05rem; cursor: pointer;
  }
  .m-nav-toggle:hover { background: #00529B; color: #FFFFFF; border-color: #00529B; }
  .m-nav-backdrop {
    position: fixed; inset: 0; background: rgba(5,19,34,0.55);
    opacity: 0; visibility: hidden; transition: all 0.25s ease; z-index: 11000;
  }
  .m-nav-backdrop.open { opacity: 1; visibility: visible; }
  .m-nav-drawer {
    position: fixed; top: 0; right: 0; height: 100%; width: min(88vw, 360px);
    background: #FFFFFF; z-index: 11001; transform: translateX(102%);
    transition: transform 0.28s cubic-bezier(0.22,0.61,0.36,1);
    display: flex; flex-direction: column;
    box-shadow: -20px 0 50px -20px rgba(10,37,64,0.45);
    font-family: 'Inter','Noto Sans TC',sans-serif;
  }
  .m-nav-drawer.open { transform: translateX(0); }
  .m-nav-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 18px; border-bottom: 1px solid #E2E8F0; flex: 0 0 auto;
  }
  .m-nav-head span { font-size: 0.95rem; font-weight: 900; color: #0A2540; }
  .m-nav-close {
    background: #F1F5F9; border: 1px solid #E2E8F0; color: #475569;
    width: 36px; height: 36px; border-radius: 9px; cursor: pointer; font-size: 0.95rem;
  }
  .m-nav-body { flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .m-nav-link {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 16px 18px; border-bottom: 1px solid #F1F5F9;
    font-size: 1rem; font-weight: 800; color: #0A2540; text-decoration: none;
    min-height: 44px; background: none; border-left: none; border-right: none; border-top: none;
    width: 100%; text-align: left; cursor: pointer; font-family: inherit;
  }
  .m-nav-link:hover { background: #EFF6FF; color: #00529B; }
  .m-nav-link .fa-chevron-down { font-size: 0.75rem; color: #94A3B8; transition: transform 0.2s ease; }
  .m-nav-link.expanded .fa-chevron-down { transform: rotate(180deg); }
  .m-nav-sub { display: none; background: #F8FAFC; padding: 6px 0 10px; }
  .m-nav-sub.open { display: block; }
  .m-nav-group { padding: 10px 18px 4px; }
  .m-nav-group-title {
    font-size: 0.76rem; font-weight: 900; color: #00529B; letter-spacing: 0.5px;
    text-transform: uppercase; margin-bottom: 6px;
  }
  .m-nav-sub a {
    display: block; padding: 11px 6px; font-size: 0.92rem; font-weight: 600;
    color: #334155; text-decoration: none; border-bottom: 1px solid #EEF2F6; min-height: 44px;
    box-sizing: border-box;
  }
  .m-nav-sub a:hover { color: #00529B; }
  .m-nav-foot {
    flex: 0 0 auto; padding: 16px 18px; border-top: 1px solid #E2E8F0;
    display: flex; flex-direction: column; gap: 10px; background: #F8FAFC;
  }
  .m-nav-foot a, .m-nav-foot button {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 46px; border-radius: 10px; font-size: 0.92rem; font-weight: 800;
    text-decoration: none; cursor: pointer; font-family: inherit;
  }
  .m-nav-cta { background: #00529B; color: #FFFFFF; border: none; }
  .m-nav-lang { background: #FFFFFF; color: #334155; border: 1px solid #CBD5E1; }
  .m-nav-util { margin-top: 10px; padding-top: 14px; border-top: 1px solid #E2E8F0; }
  @media (max-width: 1024px) {
    .m-nav-toggle { display: inline-flex; }
  }
  @media print {
    .m-nav-toggle, .m-nav-drawer, .m-nav-backdrop { display: none !important; }
  }
  `;

  function injectCss() {
    if (document.getElementById('mNavCss')) return;
    var st = document.createElement('style');
    st.id = 'mNavCss';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* 從頁首既有選單抓出結構，抽屜內容自動同步 */
  function readMenu() {
    var out = [];
    document.querySelectorAll('.nav-menu > .nav-item').forEach(function (li) {
      var link = li.querySelector(':scope > a');
      if (!link) return;
      var entry = {
        label: (link.getAttribute('data-tw') || link.textContent || '').trim(),
        href: link.getAttribute('href') || '#',
        groups: []
      };
      li.querySelectorAll('.mega-grid-6 > div').forEach(function (col) {
        var titleEl = col.querySelector('.mega-col-title-sm');
        var title = titleEl ? (titleEl.querySelector('span') ? titleEl.querySelector('span').textContent : titleEl.textContent).trim() : '';
        var links = [];
        col.querySelectorAll('.mega-sub-links a').forEach(function (a) {
          links.push({ label: (a.getAttribute('data-tw') || a.textContent || '').trim(), href: a.getAttribute('href') || '#' });
        });
        // Scale Sheet 這欄的標題本身就是連結
        if (!links.length) {
          var colLink = col.querySelector('a');
          if (colLink) links.push({ label: title, href: colLink.getAttribute('href') || '#' });
        }
        if (title || links.length) entry.groups.push({ title: title, links: links });
      });
      out.push(entry);
    });
    return out;
  }

  function build() {
    if (document.getElementById('mNavDrawer')) return;
    var header = document.querySelector('.header');
    var right = document.querySelector('.header-right');
    if (!header || !right) return;

    injectCss();

    var toggle = document.createElement('button');
    toggle.className = 'm-nav-toggle';
    toggle.id = 'mNavToggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', '開啟選單');
    toggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
    right.appendChild(toggle);

    var items = readMenu();
    var contactHref = 'contact.html';
    var contactItem = items.filter(function (i) { return /contact/.test(i.href); })[0];
    if (contactItem) contactHref = contactItem.href;

    /* 頂欄（.top-utility-bar）在 1024px 以下隱藏，裡面的相關連結沒有別的入口，
       所以直接從頂欄讀出來放進抽屜（頂欄改了這裡自動跟上）。 */
    function readUtility(menuItems) {
      var seen = {};
      (menuItems || []).forEach(function (i) { seen[(i.href || '').replace(/^\.\//, '')] = true; });
      var out = [];
      document.querySelectorAll('.top-utility-bar a').forEach(function (a) {
        var sp = a.querySelector('span');
        var label = ((sp ? sp.getAttribute('data-tw') || sp.textContent : a.textContent) || '').trim();
        var href = a.getAttribute('href') || '#';
        // 主選單已經有的（例：永續發展）就不重複放
        if (!label || seen[href.replace(/^\.\//, '')]) return;
        out.push({ label: label, href: href, external: a.getAttribute('target') === '_blank' });
      });
      return out;
    }

    var body = items.map(function (it, idx) {
      if (!it.groups.length) {
        return '<a class="m-nav-link" href="' + esc(it.href) + '">' + esc(it.label) + '</a>';
      }
      var groups = it.groups.map(function (g) {
        return '<div class="m-nav-group">' +
          (g.title ? '<div class="m-nav-group-title">' + esc(g.title) + '</div>' : '') +
          g.links.map(function (l) { return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>'; }).join('') +
        '</div>';
      }).join('');
      return '<button class="m-nav-link" type="button" data-acc="' + idx + '">' + esc(it.label) +
        ' <i class="fa-solid fa-chevron-down"></i></button>' +
        '<div class="m-nav-sub" data-sub="' + idx + '">' +
          '<div class="m-nav-group"><a href="' + esc(it.href) + '" style="font-weight:800;color:#00529B;">查看全部產品 →</a></div>' +
          groups +
        '</div>';
    }).join('');

    var utility = readUtility(items);
    var utilityBlock = utility.length
      ? '<div class="m-nav-group m-nav-util">' +
          '<div class="m-nav-group-title">相關連結</div>' +
          utility.map(function (u) {
            return '<a href="' + esc(u.href) + '"' + (u.external ? ' target="_blank" rel="noopener"' : '') + '>' +
              esc(u.label) + (u.external ? ' <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:.66rem;opacity:.6"></i>' : '') +
            '</a>';
          }).join('') +
        '</div>'
      : '';

    var html =
      '<div class="m-nav-backdrop" id="mNavBackdrop"></div>' +
      '<aside class="m-nav-drawer" id="mNavDrawer" aria-hidden="true">' +
        '<div class="m-nav-head">' +
          '<span>選單 MENU</span>' +
          '<button class="m-nav-close" id="mNavClose" type="button" aria-label="關閉選單"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="m-nav-body">' + body + utilityBlock + '</div>' +
        '<div class="m-nav-foot">' +
          '<a class="m-nav-cta" href="' + esc(contactHref) + '"><i class="fa-solid fa-envelope"></i> 聯繫我們</a>' +
          '<button class="m-nav-lang" id="mNavLang" type="button">EN / 繁中</button>' +
        '</div>' +
      '</aside>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function open() {
    var d = document.getElementById('mNavDrawer'), b = document.getElementById('mNavBackdrop');
    if (!d) return;
    d.classList.add('open'); b.classList.add('open');
    d.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    var d = document.getElementById('mNavDrawer'), b = document.getElementById('mNavBackdrop');
    if (!d) return;
    d.classList.remove('open'); b.classList.remove('open');
    d.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest('#mNavToggle')) { e.preventDefault(); open(); return; }
    if (t.closest('#mNavClose') || t.closest('#mNavBackdrop')) { close(); return; }
    if (t.closest('#mNavLang')) {
      if (typeof window.toggleLanguage === 'function') window.toggleLanguage();
      return;
    }
    var acc = t.closest('[data-acc]');
    if (acc) {
      var sub = document.querySelector('[data-sub="' + acc.getAttribute('data-acc') + '"]');
      if (sub) { sub.classList.toggle('open'); acc.classList.toggle('expanded'); }
      return;
    }
    if (t.closest('.m-nav-drawer a')) close();
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', function () { if (window.innerWidth > 1000) close(); });

  function init() {
    build();
    // 頁首若由 navbar.js 稍後注入，等它出現再建立
    if (!document.getElementById('mNavDrawer')) {
      var tries = 0;
      var timer = setInterval(function () {
        build();
        if (document.getElementById('mNavDrawer') || ++tries > 40) clearInterval(timer);
      }, 100);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
