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
    // 各頁 head 會在 preferredLang === 'en' 時加上 lang-loading（body opacity:0 防閃爍），
    // 這裡是唯一負責解除它的地方；不解除的話英文使用者會看到整頁空白。
    document.documentElement.classList.remove('lang-loading');

    var langBtn = document.getElementById('langBtn');
    if (langBtn) {
      langBtn.textContent = currentLang === 'tw' ? 'EN / 繁中' : '繁中 / EN';
    }

    // 輸入框提示文字：掛 data-ph-tw / data-ph-en 的欄位跟著切語言
    document.querySelectorAll('[data-ph-tw]').forEach(function (el) {
      var ph = el.getAttribute('data-ph-' + currentLang);
      if (ph !== null) el.setAttribute('placeholder', ph);
    });

    document.querySelectorAll('[data-tw]').forEach(function (el) {
      var text = el.getAttribute('data-' + currentLang);
      if (!text) return;
      // 首次翻譯前先保存原本的圖示，避免重複切換時圖示被吃掉
      if (!el.dataset.langIcon) {
        var icon = el.querySelector('i');
        el.dataset.langIcon = icon ? icon.outerHTML : '';
      }
      // 用 innerHTML 而不是 innerText：data-tw / data-en 裡本來就寫了 <br> 當刻意換行
      // （原本用 innerText，永續發展頁的標題會直接印出一堆「<br>」字樣）
      el.innerHTML = el.dataset.langIcon ? el.dataset.langIcon + ' ' + text : text;
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
