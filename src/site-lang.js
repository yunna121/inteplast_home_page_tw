/* Inteplast Taiwan — 全站語言切換
   ------------------------------------------------------------
   支援任意數量的語言。語言清單來自 D1（GET /api/languages），
   翻譯內容來自 D1（GET /api/ui-strings），兩者都由後台維護 ——
   新增日文、越南文不需要改這支，也不需要改任何 HTML。

   運作方式
   --------
   頁面上的元素照舊掛 data-tw（繁中原文）。那個原文同時是
   「索引鍵」：/api/ui-strings 回傳 { "首頁": { en:"Home", ja:"ホーム" } }，
   這裡依目前語言查表覆寫文字。

   data-en 這類寫在 HTML 裡的屬性仍然有效，當作「資料庫還沒載入完」
   或「API 掛掉」時的後備 —— 所以英文版在任何情況下都不會壞。

   語言代碼與屬性的對應：
     zh-TW → data-tw（歷史原因，繁中用 tw）
     en    → data-en
     ja    → data-ja        依此類推
*/
(function () {
  var STORAGE_KEY = 'preferredLang';
  var BASE = 'zh-TW';

  /* 舊版只存 'tw' / 'en'，這裡相容轉換 */
  function normalize(code) {
    var v = String(code || '').trim();
    if (!v || v === 'tw' || v.toLowerCase() === 'zh-tw') return BASE;
    return v;
  }

  function suffixOf(code) {
    return code === BASE ? 'tw' : String(code).toLowerCase().replace(/-/g, '-');
  }

  var currentLang = normalize(localStorage.getItem(STORAGE_KEY));
  var languages = [{ code: BASE, label: '繁體中文', is_base: 1 }];
  var strings = null;      // { 中文原文: { en: '…', ja: '…' } }
  var stringsReady = false;

  function labelOf(code) {
    for (var i = 0; i < languages.length; i++) {
      if (languages[i].code === code) return languages[i].label;
    }
    return code;
  }

  /** 某個中文原文在目前語言下該顯示什麼 */
  function translate(zh, lang, fallbackAttr) {
    if (lang === BASE) return zh;
    if (strings && strings[zh] && strings[zh][lang]) return strings[zh][lang];
    return fallbackAttr || '';
  }

  function applyLanguage(lang) {
    /* 沒帶參數＝「照目前語言再套一次」（頁尾、漢堡選單、產品卡片等
       動態插入內容後會這樣呼叫）。不能落回預設語言，否則每次換頁
       都會把使用者選的語言清掉。 */
    if (lang === undefined || lang === null) lang = currentLang;
    currentLang = normalize(lang);
    localStorage.setItem(STORAGE_KEY, currentLang);
    document.documentElement.lang = currentLang;

    /* 各頁 head 會在非繁中時加上 lang-loading（body opacity:0 防閃爍），
       這裡是唯一負責解除它的地方。

       什麼時候可以解除：
         · 繁中 —— 頁面上寫的就是繁中，立刻可顯示
         · 英文 —— HTML 裡有 data-en，不必等網路
         · 其他語言 —— 只有資料庫有翻譯，要等對照表載入，
           否則會先閃一下中文再變成日文
       init() 另外有 2.5 秒保險，API 掛掉也不會卡在空白畫面。 */
    if (currentLang === BASE || currentLang === 'en' || stringsReady) {
      document.documentElement.classList.remove('lang-loading');
    }

    var suffix = suffixOf(currentLang);
    renderSwitcher();

    // 頁面標題與 meta description：Google 搜尋結果顯示的就是這兩行
    document.querySelectorAll('[data-desc-tw]').forEach(function (el) {
      var zh = el.getAttribute('data-desc-tw');
      var text = translate(zh, currentLang, el.getAttribute('data-desc-' + suffix));
      if (text) el.setAttribute('content', text);
    });

    // 輸入框提示文字
    document.querySelectorAll('[data-ph-tw]').forEach(function (el) {
      var zh = el.getAttribute('data-ph-tw');
      var text = translate(zh, currentLang, el.getAttribute('data-ph-' + suffix));
      if (text !== null && text !== undefined && text !== '') el.setAttribute('placeholder', text);
    });

    document.querySelectorAll('[data-tw]').forEach(function (el) {
      var zh = el.getAttribute('data-tw');
      var text = translate(zh, currentLang, el.getAttribute('data-' + suffix));
      if (!text) return;

      // 首次翻譯前先保存原本的圖示，避免重複切換時圖示被吃掉
      if (!el.dataset.langIcon) {
        var icon = el.querySelector('i');
        el.dataset.langIcon = icon ? icon.outerHTML : '';
      }
      // 用 innerHTML 而不是 innerText：data-tw 裡本來就寫了 <br> 當刻意換行
      el.innerHTML = el.dataset.langIcon ? el.dataset.langIcon + ' ' + text : text;
    });
  }

  /* 語言鈕：兩種語言時維持原本的兩段式切換；
     三種以上自動變成下拉選單。 */
  function renderSwitcher() {
    var btn = document.getElementById('langBtn');
    if (!btn) return;

    if (languages.length <= 2) {
      var other = languages.filter(function (l) { return l.code !== currentLang; })[0];
      btn.textContent = other
        ? shortLabel(other.code) + ' / ' + shortLabel(currentLang)
        : shortLabel(currentLang);
      btn.onclick = function () { applyLanguage(other ? other.code : currentLang); };
      return;
    }

    btn.textContent = shortLabel(currentLang);
    btn.onclick = function (e) {
      e.stopPropagation();
      openMenu(btn);
    };
  }

  function shortLabel(code) {
    if (code === BASE) return '繁中';
    var l = labelOf(code);
    // 「日本語」保留原樣；'English' 縮成 EN
    return /^[a-z]+$/i.test(l) ? l.slice(0, 2).toUpperCase() : l;
  }

  function openMenu(btn) {
    var old = document.getElementById('langMenu');
    if (old) { old.remove(); return; }

    var menu = document.createElement('div');
    menu.id = 'langMenu';
    menu.style.cssText =
      'position:absolute; z-index:2000; min-width:132px; padding:6px;' +
      'background:#fff; border:1px solid #dbe4ec; border-radius:8px;' +
      'box-shadow:0 12px 30px -10px rgba(10,37,64,.35); font-size:.9rem;';

    languages.forEach(function (l) {
      var item = document.createElement('button');
      item.type = 'button';
      item.textContent = l.label;
      item.style.cssText =
        'display:block; width:100%; padding:8px 12px; text-align:left; cursor:pointer;' +
        'background:' + (l.code === currentLang ? '#eff6fb' : 'none') + ';' +
        'border:0; border-radius:5px; font:inherit;' +
        'color:' + (l.code === currentLang ? '#00529b' : '#142638') + ';' +
        'font-weight:' + (l.code === currentLang ? '700' : '500') + ';';
      item.addEventListener('mouseenter', function () { if (l.code !== currentLang) this.style.background = '#f4f7fa'; });
      item.addEventListener('mouseleave', function () { if (l.code !== currentLang) this.style.background = 'none'; });
      item.addEventListener('click', function () {
        menu.remove();
        applyLanguage(l.code);
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);
    var box = btn.getBoundingClientRect();
    menu.style.top = (box.bottom + window.scrollY + 6) + 'px';
    menu.style.left = Math.max(8, Math.min(box.left + window.scrollX, window.innerWidth - menu.offsetWidth - 8)) + 'px';

    setTimeout(function () {
      document.addEventListener('click', function close() {
        menu.remove();
        document.removeEventListener('click', close);
      });
    }, 0);
  }

  window.applyLanguage = applyLanguage;
  window.toggleLanguage = function () {
    // 舊的 onclick 還會呼叫這支：兩種語言時互換，多語言時開選單
    if (languages.length <= 2) {
      var other = languages.filter(function (l) { return l.code !== currentLang; })[0];
      applyLanguage(other ? other.code : currentLang);
    } else {
      openMenu(document.getElementById('langBtn'));
    }
  };
  window.getCurrentLang = function () { return currentLang; };

  /* 先用 HTML 內建的 data-en 立刻套用（不等網路），
     資料庫回來後再套一次補上新語言 —— 這樣 API 慢或掛掉都不影響瀏覽。 */
  function init() {
    setTimeout(function () { applyLanguage(currentLang); }, 0);

    // 保險：對照表遲遲沒回來也要把頁面放出來，寧可顯示中文也不要空白
    setTimeout(function () {
      if (!stringsReady) document.documentElement.classList.remove('lang-loading');
    }, 2500);

    Promise.all([
      fetch('/api/languages', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch('/api/ui-strings', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (out) {
      if (Array.isArray(out[0]) && out[0].length) languages = out[0];
      if (out[1] && typeof out[1] === 'object') strings = out[1];
      stringsReady = true;

      // 使用者上次選的語言若已被刪除，退回基準語言
      var ok = languages.some(function (l) { return l.code === currentLang; });
      applyLanguage(ok ? currentLang : BASE);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
