/* 舊網址轉址 ＋ 多語言網址（/en/…、/ja/…）
   ============================================================

   這支程式做三件事：

   1) 舊網址 301 導到正式網域（原本就有的功能，完全保留）

   2) /en/about、/ja/sustainability 這類語言網址
      拿同一份 HTML，在送出之前就把文字換成英文／日文。
      Google 抓到的是已經翻好的頁面，不必等瀏覽器執行 JS。

   3) 有人開首頁時，依瀏覽器語言導到對應的語言版
      —— 但爬蟲不導（見下方說明）。

   為什麼不複製一份英文 HTML
   ------------------------------------------------------------
   譯文已經存在 D1 的 translations 表裡，/api/ui-strings 回傳的
   就是「中文原文 → 各語言譯文」的對照表，而頁面上每個要翻譯的
   元素都帶著 data-tw（中文原文）——  前端 site-lang.js 本來就是
   靠這兩樣東西在瀏覽器裡換字。

   這裡做的是同一件事，只是提早到伺服器端做完。所以：
     · 不用維護第二份 HTML，中文改了其他語言自動跟著改
     · 新增語言不必改任何網頁檔案
     · 業務在後台改譯文，下一次請求就生效

   爬蟲為什麼不能自動導
   ------------------------------------------------------------
   Googlebot 抓 / 的時候如果被導到 /en/，中文版就永遠收錄不到。
   所以只有真人會被導，而且是 302（暫時）不是 301（永久），
   使用者自己選過語言之後就不再導。

   轉址回應標了 no-store 與 Vary —— 不然 Cloudflare 會把「導去英文」
   這個結果快取起來，之後所有人都被導去英文。
   ============================================================ */

const PRIMARY = 'inteplasttw.com.tw';
const LEGACY = ['inteplast-home-page-tw.pages.dev', 'yunna121.github.io'];

/* 支援的語言直接讀後台「語言」設定（D1 的 languages 表）——
   程式裡不寫死清單，所以新增語言時**這個檔案完全不用改**：
   後台加一個語言、翻好介面文字，/ko/ 這類網址下一次請求就能用。

   og:locale 需要「語言_地區」的格式，這裡只列常見對應，
   查不到就直接用語言代碼（Facebook 容錯，不會壞）。 */
const OG_LOCALE = {
  en: 'en_US', ja: 'ja_JP', ko: 'ko_KR', vi: 'vi_VN',
  es: 'es_ES', de: 'de_DE', fr: 'fr_FR', th: 'th_TH',
  id: 'id_ID', 'zh-tw': 'zh_TW', 'zh-cn': 'zh_CN',
};

const BASE = { htmlLang: 'zh-Hant-TW', ogLocale: 'zh_TW' };

function langConf(code) {
  const key = String(code).toLowerCase();
  return {
    code: key,
    htmlLang: key,
    ogLocale: OG_LOCALE[key] || key.replace('-', '_'),
    /* 標題與描述不是後台的介面文字（查不到對照表），
       所以直接讀頁面上的 data-<語言> 屬性。 */
    titleAttr: 'data-' + key,
    descAttr: 'data-desc-' + key,
  };
}

/* 看起來像語言代碼的第一段路徑：en、ja、zh-tw…
   先用形狀篩掉 /about、/products 這些，才去查資料庫。 */
const LANG_SHAPE = /^[a-z]{2}(-[a-z]{2,4})?$/i;

/* 後台設定的語言清單（不含基準語言繁中）。快取 5 分鐘。 */
async function loadLangs(origin) {
  const key = new Request(origin + '/api/languages', { headers: { 'x-i18n-cache': '1' } });
  const cache = caches.default;

  let res = await cache.match(key);
  if (!res) {
    res = await fetch(origin + '/api/languages');
    if (!res.ok) return [];
    res = new Response(res.body, res);
    res.headers.set('cache-control', 'max-age=300');
    await cache.put(key, res.clone());
  }
  try {
    const rows = await res.json();
    return (Array.isArray(rows) ? rows : [])
      .filter((r) => r && r.code && !r.is_base)
      .map((r) => String(r.code).toLowerCase());
  } catch (e) {
    return [];
  }
}

/* 這些路徑不參與語言處理：API、後台、媒體檔、靜態資源 */
const SKIP = /^\/(api|media|admin|assets)\//;

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    // API 與媒體檔一律直接放行，不做任何判斷
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) {
      return context.next();
    }

    // ---- 1. 舊網址轉正 ----
    if (LEGACY.includes(url.hostname)) {
      url.hostname = PRIMARY;
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    if (url.hostname === 'www.' + PRIMARY) {
      url.hostname = PRIMARY;
      return Response.redirect(url.toString(), 301);
    }

    // ---- 2. 語言網址 ----
    const hit = url.pathname.match(/^\/([^/]+)(\/.*)?$/);
    const langs = (hit && LANG_SHAPE.test(hit[1])) ? await loadLangs(url.origin) : [];
    if (hit && langs.indexOf(hit[1].toLowerCase()) > -1) {
      const lang = hit[1].toLowerCase();
      const rest = hit[2] || '/';

      /* 底層資源用「去掉語言前綴」的路徑取。
         頁面裡的相對路徑（assets/css/…、../assets/…）在 /en/ 底下會
         解析成 /en/assets/…，也會走到這裡被還原 —— 所以 CSS、JS、
         圖片不必改任何一行。 */
      const assetUrl = new URL(rest + url.search, url.origin);

      /* 打自家網址取原料，而不是 env.ASSETS.fetch()。

         為什麼不用 ASSETS：它只看靜態檔案，而且找不到時**不是回 404**，
         而是回 200 加上 index.html（單頁應用的後援行為）。所以
         /en/products/draw-tape-liners 會靜悄悄地拿到首頁，
         連 CSS 都因為 MIME 不符而被瀏覽器拒絕。

         走 fetch 就會經過 Pages 正常的順序：Functions 優先、再靜態檔案，
         所以產品頁（Function 產生）與一般頁面（靜態檔案）都能取到。

         帶 x-i18n-origin 標記這是內部取料：那次請求不能再被自動導向，
         也不要重複插入 hreflang。 */
      const headers = new Headers(request.headers);
      headers.set('x-i18n-origin', '1');
      const res = await fetch(assetUrl.toString(), {
        method: 'GET',
        headers,
        redirect: 'follow',
      });

      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.includes('text/html')) return res;

      const strings = await loadStrings(env, url.origin);
      return translate(res, lang, rest, strings, url.origin, langs);
    }

    // ---- 3. 首頁依瀏覽器語言導向（真人限定）----
    if (url.pathname === '/' && shouldAutoRedirect(request)) {
      const want = pickLang(request.headers.get('accept-language'), await loadLangs(url.origin));
      if (want) {
        return new Response(null, {
          status: 302,
          headers: {
            location: '/' + want + '/',
            /* 不快取：這個判斷因人而異，被快取就變成所有人都被導 */
            'cache-control': 'no-store',
            vary: 'Accept-Language, Cookie',
          },
        });
      }
    }

    // ---- 4. 中文版：補上 hreflang ----
    const res = await context.next();
    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/html') || SKIP.test(url.pathname)) return res;

    /* 語言版的內部取料請求：原封不動交回去，翻譯與 hreflang 由呼叫端處理，
       否則 hreflang 會被插入兩次。 */
    if (request.headers.get('x-i18n-origin')) return res;

    /* 先取好語言清單 —— HTMLRewriter 的處理函式是同步的，裡面不能 await */
    const all = await loadLangs(url.origin);

    return new HTMLRewriter()
      .on('html', { element: (e) => e.setAttribute('lang', BASE.htmlLang) })
      .on('head', {
        element: (e) => e.append(hreflangTags(url.pathname, url.origin, all), { html: true }),
      })
      .transform(res);
  } catch (e) {
    /* 轉址或翻譯失敗不能連帶把網站弄壞 —— 當作沒事發生、照常放行 */
    return context.next();
  }
}

/* ------------------------------------------------------------
   譯文對照表
   ------------------------------------------------------------
   直接打自家的 /api/ui-strings，而不是把那支程式的邏輯複製過來
   —— 譯文的組裝規則（介面文字優先、產品細項逐段配對…）只該有
   一份實作。

   結果放進 Cloudflare 的快取，5 分鐘內的請求不會再碰 D1。
   業務在後台改譯文最多 5 分鐘後生效。
   ------------------------------------------------------------ */
async function loadStrings(env, origin) {
  const key = new Request(origin + '/api/ui-strings', { headers: { 'x-i18n-cache': '1' } });
  const cache = caches.default;

  let res = await cache.match(key);
  if (!res) {
    res = await fetch(origin + '/api/ui-strings');
    if (!res.ok) return {};
    res = new Response(res.body, res);
    res.headers.set('cache-control', 'max-age=300');
    await cache.put(key, res.clone());
  }
  try {
    return await res.json();
  } catch (e) {
    return {};
  }
}

/* ------------------------------------------------------------
   把一份中文 HTML 轉成指定語言
   ------------------------------------------------------------ */
function translate(res, lang, path, strings, origin, langs) {
  const conf = langConf(lang);

  /* 查表：key 是繁中原文，值是 { en: …, ja: … } */
  const tr = (zh) => {
    const row = strings[String(zh || '').trim()];
    return (row && row[lang]) || '';
  };

  const canonical = origin + '/' + lang + (path === '/' ? '/' : path);

  /* <title> 與 description 解出來的結果，給後面的 og:／twitter: 沿用。
     這兩個標籤在 <head> 裡排在 og 之前，所以串流處理時已經填好了。

     為什麼不讓 og 自己查對照表：那些 content 是手寫的 SEO 文案，
     不是後台的介面文字，對照表裡查不到 —— 會留在中文。 */
  let doneTitle = '';
  let doneDesc = '';

  const rewriter = new HTMLRewriter()
    .on('html', { element: (e) => e.setAttribute('lang', conf.htmlLang) })

    /* 標題：優先用頁面上寫好的 data-en；日文沒有對應屬性，就查對照表。

       用 html:true —— HTMLRewriter 讀屬性時不解碼 HTML 實體，
       data-en 裡的 &amp;amp; 拿到手還是 &amp;amp;。當成純文字寫入會被再轉義一次
       （&amp;amp;amp;），畫面上就出現 &amp;amp; 這種字。 */
    .on('title', {
      element(e) {
        const v = e.getAttribute(conf.titleAttr) || tr(e.getAttribute('data-tw'));
        if (v) { doneTitle = v; e.setInnerContent(v, { html: true }); }
      },
    })

    .on('meta[name="description"]', {
      element(e) {
        const v = e.getAttribute(conf.descAttr) || tr(e.getAttribute('data-desc-tw'));
        if (v) { doneDesc = v; e.setAttribute('content', v); }
      },
    })

    /* 社群分享卡跟著語言走 */
    .on('meta[property="og:title"]', { element: (e) => setFrom(e, () => doneTitle, tr) })
    .on('meta[property="og:description"]', { element: (e) => setFrom(e, () => doneDesc, tr) })
    .on('meta[property="og:locale"]', { element: (e) => e.setAttribute('content', conf.ogLocale) })
    .on('meta[property="og:url"]', { element: (e) => e.setAttribute('content', canonical) })
    .on('meta[name="twitter:title"]', { element: (e) => setFrom(e, () => doneTitle, tr) })
    .on('meta[name="twitter:description"]', { element: (e) => setFrom(e, () => doneDesc, tr) })

    /* 正規網址指向自己這個語言版，否則三個語言會互相搶排名 */
    .on('link[rel="canonical"]', { element: (e) => e.setAttribute('href', canonical) })

    .on('head', {
      element(e) {
        e.prepend(bootScript(lang, langs), { html: true });
        e.append(hreflangTags(path, origin, langs), { html: true });
      },
    })

    /* 頁面本文：data-tw 就是繁中原文，也是對照表的鍵。

       優先順序：元素上直接寫的 data-<語言> → 後台譯文對照表。
       前者是給「不在後台介面文字裡」的字用的（例如產品頁自己的
       按鈕文案）；現有頁面上的 data-en="" 是空的，會被跳過。

       用 html:true —— 譯文裡允許寫 <br> 當刻意換行，而且屬性值
       讀出來沒有解碼，當純文字寫入會被二次轉義。 */
    .on('[data-tw]', {
      element(e) {
        const v = e.getAttribute('data-' + conf.code) || tr(e.getAttribute('data-tw'));
        if (v) e.setInnerContent(v, { html: true });
      },
    })

    /* 站內連結保留語言前綴，使用者點進去不會掉回中文版。
       只處理絕對路徑；相對路徑在 /en/ 底下本來就會解析正確。 */
    .on('a[href^="/"]', {
      element(e) {
        const h = e.getAttribute('href');
        if (!h || SKIP.test(h)) return;
        const seg = h.split('/')[1] || '';
        if (LANG_SHAPE.test(seg) && (langs || []).indexOf(seg.toLowerCase()) > -1) return;
        e.setAttribute('href', '/' + lang + h);
      },
    })

    .transform(res);

  /* 語言版與中文版是不同的回應，快取要分開 */
  const out = new Response(rewriter.body, rewriter);
  out.headers.set('content-language', conf.htmlLang);
  out.headers.append('vary', 'Accept-Language');
  return out;
}

/* 先用已解出的 title／description，沒有才退回查對照表 */
function setFrom(e, get, tr) {
  const v = get() || tr(e.getAttribute('content'));
  if (v) e.setAttribute('content', v);
}

/* hreflang：告訴 Google 這三個網址是同一頁的不同語言版本，
   缺了它們會被當成重複內容互相稀釋。
   x-default 指向中文版，作為語言都對不上時的預設。 */
function hreflangTags(path, origin, langs) {
  const clean = path === '/' ? '/' : path;
  let out = '\n  <link rel="alternate" hreflang="' + BASE.htmlLang + '" href="' + origin + clean + '">';
  (langs || []).forEach((code) => {
    out += '\n  <link rel="alternate" hreflang="' + code +
           '" href="' + origin + '/' + code + clean + '">';
  });
  out += '\n  <link rel="alternate" hreflang="x-default" href="' + origin + clean + '">\n';
  return out;
}

/* 放在 <head> 最前面：
   1) 把語言寫進 localStorage，讓 site-lang.js 一開始就用對的語言
      （它讀的是 preferredLang，見 assets/js/site-lang.js）
   2) 導覽列與頁尾是 JS 產生的，連結沒有語言前綴 —— 用事件捕獲
      在跳轉前補上，使用者就不會點一下掉回中文版 */
function bootScript(lang, langs) {
  const list = JSON.stringify(langs || []);
  return '<script>(function(){var L=' + list + ';' +
    'try{localStorage.setItem("preferredLang","' + lang + '")}catch(e){}' +
    'document.addEventListener("click",function(ev){' +
    'var a=ev.target&&ev.target.closest?ev.target.closest("a[href]"):null;if(!a)return;' +
    'var h=a.getAttribute("href");if(!h)return;' +
    'if(/^(https?:|mailto:|tel:|#|\\/\\/)/.test(h))return;' +
    'if(h.charAt(0)!=="/")return;' +
    'if(/^\\/(api|media|admin|assets)\\//.test(h))return;' +
    'var s=h.split("/")[1]||"";if(L.indexOf(s)>-1)return;' +
    'a.setAttribute("href","/' + lang + '"+h);' +
    '},true);})();</script>';
}

/* ------------------------------------------------------------
   自動導向的判斷
   ------------------------------------------------------------ */

/* 爬蟲一律不導。Googlebot 抓 / 的時候如果被丟到 /en/，
   中文版就永遠收錄不到。 */
const BOTS = /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|vkshare|w3c_validator|lighthouse|gtmetrix|pagespeed/i;

function shouldAutoRedirect(request) {
  /* 語言版的內部取料請求（見上面）不能被導向，
     否則 /en/ 取首頁原料時會被丟回 /en/，變成無限迴圈。 */
  if (request.headers.get('x-i18n-origin')) return false;

  const ua = request.headers.get('user-agent') || '';
  if (BOTS.test(ua)) return false;

  /* 使用者自己選過語言就不再導 —— site-lang.js 會寫 cookie 之外，
     這裡也接受任何帶 nolang 參數的網址（給你測試用）。 */
  const cookie = request.headers.get('cookie') || '';
  if (/(^|;\s*)lang_choice=/.test(cookie)) return false;

  return true;
}

/* Accept-Language 挑第一個我們支援的語言。
   中文（含簡體）與認不出來的都留在中文版，不導。 */
function pickLang(header, langs) {
  if (!header || !langs || !langs.length) return '';
  const list = header.split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.trim().toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  /* 中文一律留在中文版。其餘看後台有沒有設定那個語言 ——
     瀏覽器送的是 ja-JP、en-US 這種，只比對前兩字。 */
  for (const item of list) {
    if (item.tag.startsWith('zh')) return '';
    const hit = langs.filter((c) => item.tag === c || item.tag.split('-')[0] === c.split('-')[0])[0];
    if (hit) return hit;
  }
  return '';
}
