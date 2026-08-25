/* Inteplast Taiwan — 全站語言切換（單一來源）
   原本每個頁面的 <script> 都複製一份同樣的 applyLanguage / toggleLanguage，
   改成統一載入這一支。各頁面請刪掉自己頁內的語言切換程式碼。

   用法：<script src="../src/site-lang.js"></script>（放在 navbar.js 之後）
   需要翻譯的元素照舊掛 data-tw / data-en。
*/
(function () {
  var STORAGE_KEY = 'preferredLang';
  var currentLang = localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'tw';

  function applyLanguage(lang) {
    currentLang = lang === 'en' ? 'en' : 'tw';
    localStorage.setItem(STORAGE_KEY, currentLang);
    document.documentElement.lang = currentLang === 'tw' ? 'zh-TW' : 'en';

    var langBtn = document.getElementById('langBtn');
    if (langBtn) {
      langBtn.textContent = currentLang === 'tw' ? 'EN / 繁中' : '繁中 / EN';
    }

    document.querySelectorAll('[data-tw]').forEach(function (el) {
      var text = el.getAttribute('data-' + currentLang);
      if (!text) return;
      // 首次翻譯前先保存原本的圖示，避免重複切換時圖示被吃掉
      if (!el.dataset.langIcon) {
        var icon = el.querySelector('i');
        el.dataset.langIcon = icon ? icon.outerHTML : '';
      }
      el.innerHTML = el.dataset.langIcon
        ? el.dataset.langIcon + ' ' + text
        : '';
      if (!el.dataset.langIcon) el.textContent = text;
    });
  }

  window.applyLanguage = applyLanguage;
  window.toggleLanguage = function () {
    applyLanguage(currentLang === 'tw' ? 'en' : 'tw');
  };

  function init() {
    // navbar.js 會在 DOMContentLoaded 注入頁首，晚一拍再套用才翻得到選單
    setTimeout(function () { applyLanguage(currentLang); }, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
