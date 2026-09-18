/* 單一產品頁：/products/<網址名>
   ============================================================

   為什麼要有這個檔案
   ------------------------------------------------------------
   原本所有產品都擠在 /products/ 一頁，而且是瀏覽器跑 /api/products
   才載入的。Google 抓到的 HTML 裡產品區塊是空的（<div class="ps-list"></div>），
   所以搜 can liner、draw tape liner 永遠找不到這個網站。

   這支程式在伺服器端就把產品內容寫進 HTML，並讓每個產品有自己的網址，
   Google 才有東西可以排。

   語言怎麼處理
   ------------------------------------------------------------
   這裡只輸出**繁中內容 ＋ data-tw 屬性**，完全不管有幾種語言。
   /en/products/… 與 /ja/products/… 由 functions/_middleware.js 接手
   翻譯（它本來就在替全站做這件事）。

   所以新增語言時這支程式不用改一行。
   標題與描述例外 —— 它們不是後台的介面文字，查不到對照表，
   所以直接把各語言版本寫成 data-en／data-ja 讓中介程式挑。
   ============================================================ */

import { loadProducts, productSlug, mainName, aliasOf, imageUrl, splitItems } from './_shared.js';

const SITE = 'https://inteplasttw.com.tw';
const COMPANY_TW = '臺灣營德股份有限公司';
const COMPANY_EN = 'INTEPLAST TAIWAN CORPORATION';

export async function onRequest(context) {
  const { params, env, request } = context;
  const slug = String(params.slug || '');

  /* Pages 的 Functions 優先於靜態檔案，所以 [slug] 也會接到
     /products/ 與 /products/index.html —— 那是產品中心那一頁，
     原封不動交回去，不要被這支程式接走。 */
  if (!slug || slug === 'index' || slug === 'index.html') {
    return env.ASSETS.fetch(request);
  }

  try {
    const rows = await loadProducts(env);
    const row = rows.filter((r) => productSlug(r) === slug)[0];

    if (!row) {
      /* 找不到就回產品中心，並用 404 讓 Google 不要收錄這個網址。
         回 302 到 /products/ 會讓錯誤網址累積成軟性 404。 */
      return new Response(notFoundHtml(), {
        status: 404,
        headers: { 'content-type': 'text/html;charset=UTF-8' },
      });
    }

    return new Response(pageHtml(row, rows), {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
        /* 產品資料在 D1，業務改了要盡快反映；邊緣快取 5 分鐘、
           之後背景更新，不讓每次瀏覽都打資料庫。 */
        'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    return new Response('Product page error: ' + String(error), { status: 500 });
  }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* 描述：重點句優先，不夠長再補敘述；中文約 80 字、英文約 160 字截斷 */
function metaDesc(row, suffix) {
  const parts = [row['highlight' + suffix], row['desc' + suffix]].filter(Boolean);
  const text = parts.join(' ').replace(/\s+/g, ' ').trim();
  const limit = suffix === '' ? 80 : 160;
  return text.length > limit ? text.slice(0, limit - 1).trim() + '…' : text;
}

function pageHtml(row, all) {
  const slug = productSlug(row);
  const nameTw = mainName(row.name);
  const aliasTw = aliasOf(row.name);
  const nameEn = mainName(row.name_en) || nameTw;
  const nameJa = mainName(row.name_ja) || nameEn;

  const img = imageUrl(row);
  const items = splitItems(row.items);
  /* 細項標籤的譯文，依索引配對：第 n 個中文細項對第 n 個英文／日文細項。
     沒填或數量不足時退回中文，不要讓標籤消失。

     為什麼要在這裡帶：細項不在後台的介面文字對照表裡（它們是 products
     表自己的欄位），只寫 data-tw 的話中介程式查不到譯文，切語言不會變。 */
  const itemsEn = splitItems(row.items_en);
  const itemsJa = splitItems(row.items_ja);

  const titleTw = nameTw + '｜' + COMPANY_TW;
  const titleEn = nameEn + ' Manufacturer | ' + COMPANY_EN;
  const titleJa = nameJa + ' メーカー｜' + COMPANY_EN;

  const descTw = metaDesc(row, '') || (nameTw + '產品規格與應用說明。');
  const descEn = metaDesc(row, '_en') || (nameEn + ' specifications and applications.');
  const descJa = metaDesc(row, '_ja') || descEn;

  const canonical = SITE + '/products/' + slug;

  /* 結構化資料：讓 Google 知道這頁講的是一個「產品」。
     B2B 不公開價格，所以沒有 offers —— 仍然是合法的 Product 標記。 */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: nameEn,
    alternateName: [nameTw, aliasTw].filter(Boolean),
    description: descEn,
    url: canonical,
    brand: { '@type': 'Brand', name: 'Formosa Plastics' },
    manufacturer: {
      '@type': 'Organization',
      name: COMPANY_EN,
      url: SITE + '/',
    },
  };
  if (img) jsonLd.image = SITE + img;
  if (items.length) {
    jsonLd.additionalProperty = splitItems(row.items_en || row.items).map((v) => ({
      '@type': 'PropertyValue', name: 'feature', value: v,
    }));
  }

  const others = all.filter((r) => productSlug(r) !== slug);

  return `<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title data-tw="${esc(titleTw)}" data-en="${esc(titleEn)}" data-ja="${esc(titleJa)}">${esc(titleTw)}</title>
  <meta name="description" content="${esc(descTw)}"
    data-desc-tw="${esc(descTw)}" data-desc-en="${esc(descEn)}" data-desc-ja="${esc(descJa)}">
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="index, follow, max-image-preview:large">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(COMPANY_TW)} ${COMPANY_EN}">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${esc(titleTw)}">
  <meta property="og:description" content="${esc(descTw)}">
  <meta property="og:image" content="${SITE}${img || '/assets/img/itc-logo.png'}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(titleTw)}">
  <meta name="twitter:description" content="${esc(descTw)}">
  <meta name="twitter:image" content="${SITE}${img || '/assets/img/itc-logo.png'}">

  <link rel="icon" href="/assets/img/inteplast-logo-blue.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/img/favicon-96.png" sizes="96x96" type="image/png">
  <link rel="icon" href="/assets/img/favicon-192.png" sizes="192x192" type="image/png">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">

  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800;900&family=Noto+Sans+TC:wght@400;500;700;900&display=swap">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

  <!-- 路徑一律用絕對路徑（/assets/…）：這頁的網址像目錄
       （/products/can-liner），相對路徑會被解析成 /products/assets/… -->
  <link rel="stylesheet" href="/assets/css/navbar.css?v=8" id="site-navbar-css">
  <link rel="stylesheet" href="/assets/css/responsive.css?v=11">
  <link id="site-type-css" rel="stylesheet" href="/assets/css/type.css">

  <style>
    :root {
      --navy: #0A2540;
      --blue: #00529B;
      --muted: #64748B;
      --line: #E2E8F0;
      --bg: #F8FAFC;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', 'Noto Sans TC', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1E293B;
      background: #FFFFFF;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    a { color: var(--blue); }
    a:hover { color: #003D75; }

    .pd-wrap { max-width: 1240px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 56px); }

    .pd-crumb {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      padding: 28px 0 0;
      font-size: .82rem; color: var(--muted);
    }
    .pd-crumb a { text-decoration: none; }
    .pd-crumb i { font-size: .62rem; opacity: .5; }

    .pd-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: clamp(28px, 5vw, 64px);
      align-items: center;
      padding: clamp(28px, 4vw, 52px) 0 clamp(36px, 5vw, 64px);
    }
    .pd-figure {
      display: grid; place-items: center;
      /* 満版：不留內距、用 overflow 剪圓角，
         等比固定成 4:3 不管原圖比例如何都不會忽高忽低。 */
      aspect-ratio: 4 / 3;
      min-height: 300px;
      overflow: hidden;
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: 20px;
    }
    .pd-figure img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .pd-figure .pd-noimg { padding: 28px; color: #94A3B8; font-size: .85rem; text-align: center; }

    .pd-eyebrow {
      font-size: .78rem; font-weight: 800; letter-spacing: .22em;
      text-transform: uppercase; color: var(--blue); margin-bottom: 14px;
    }
    .pd-title {
      font-size: clamp(2.1rem, 4.4vw, 3.4rem);
      font-weight: 900; letter-spacing: -.03em; line-height: 1.08;
      color: var(--navy);
      text-wrap: balance;
    }
    .pd-alias { margin-top: 10px; font-size: .95rem; font-weight: 700; color: var(--muted); }
    .pd-highlight {
      margin-top: 20px;
      font-size: clamp(1.05rem, 1.5vw, 1.25rem);
      font-weight: 800; line-height: 1.5; color: var(--blue);
      text-wrap: pretty;
    }
    .pd-desc {
      margin-top: 16px;
      font-size: 1.02rem; line-height: 1.85; color: var(--muted);
      white-space: pre-line;
      text-wrap: pretty;
    }

    .pd-chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
    .pd-chip {
      padding: 7px 15px;
      border: 1px solid #BBD6EE; border-radius: 999px;
      background: #FFFFFF;
      font-size: .88rem; font-weight: 700; color: var(--blue);
    }
    .pd-chip.is-eco { border-color: #A7D9C0; background: #F1FBF6; color: #0F7A4E; }

    .pd-cta {
      display: inline-flex; align-items: center; gap: 10px;
      margin-top: 30px; padding: 14px 30px;
      background: var(--blue); color: #FFFFFF;
      border-radius: 999px;
      font-size: .98rem; font-weight: 800; text-decoration: none;
      transition: background .25s ease, transform .25s ease;
    }
    .pd-cta:hover { background: #003D75; color: #FFFFFF; transform: translateY(-2px); }

    .pd-more { padding: clamp(40px, 5vw, 72px) 0; border-top: 1px solid var(--line); }
    .pd-more h2 {
      font-size: clamp(1.3rem, 2.2vw, 1.75rem);
      font-weight: 900; color: var(--navy); letter-spacing: -.02em;
      margin-bottom: 22px;
    }
    .pd-more-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
      gap: 14px;
    }
    .pd-more-card {
      display: block; padding: 18px 20px;
      border: 1px solid var(--line); border-radius: 14px;
      text-decoration: none; color: var(--navy);
      transition: border-color .25s ease, transform .25s ease, box-shadow .25s ease;
    }
    .pd-more-card:hover {
      border-color: var(--blue); color: var(--blue);
      transform: translateY(-3px);
      box-shadow: 0 12px 26px rgba(10, 37, 64, .08);
    }
    .pd-more-name { font-size: 1.02rem; font-weight: 800; line-height: 1.35; }
    .pd-more-en { margin-top: 4px; font-size: .78rem; font-weight: 700; color: var(--muted); letter-spacing: .04em; }

    @media (max-width: 860px) {
      .pd-hero { grid-template-columns: 1fr; }
      .pd-figure { order: -1; min-height: 220px; }
    }
  </style>
</head>
<body>
  <!-- 頁首與頁尾沿用全站元件，不另外寫一份 -->
  <div id="site-header-component"></div>
  <script src="/assets/js/navbar.js"></script>

  <main class="pd-wrap">
    <nav class="pd-crumb" aria-label="breadcrumb">
      <a href="/" data-tw="首頁" data-en="Home" data-ja="ホーム">首頁</a>
      <i class="fa-solid fa-chevron-right"></i>
      <a href="/products/" data-tw="產品中心" data-en="Products" data-ja="製品一覧">產品中心</a>
      <i class="fa-solid fa-chevron-right"></i>
      <span data-tw="${esc(nameTw)}" data-en="${esc(nameEn || nameTw)}" data-ja="${esc(mainName(row.name_ja) || nameEn || nameTw)}">${esc(nameTw)}</span>
    </nav>

    <article class="pd-hero">
      <div>
        ${row.name_en ? `<div class="pd-eyebrow">${esc(mainName(row.name_en))}</div>` : ''}
        <h1 class="pd-title" data-tw="${esc(nameTw)}" data-en="${esc(nameEn || nameTw)}" data-ja="${esc(mainName(row.name_ja) || nameEn || nameTw)}">${esc(nameTw)}</h1>
        ${aliasTw ? `<div class="pd-alias" data-tw="又稱 ${esc(aliasTw)}" data-en="Also known as ${esc(aliasOf(row.name_en) || aliasTw)}" data-ja="別名 ${esc(aliasOf(row.name_ja) || aliasOf(row.name_en) || aliasTw)}">又稱 ${esc(aliasTw)}</div>` : ''}
        ${row.highlight ? `<p class="pd-highlight" data-tw="${esc(row.highlight)}" data-en="${esc(row.highlight_en || row.highlight)}" data-ja="${esc(row.highlight_ja || row.highlight_en || row.highlight)}">${esc(row.highlight)}</p>` : ''}
        ${row.desc ? `<p class="pd-desc" data-tw="${esc(row.desc)}" data-en="${esc(row.desc_en || row.desc)}" data-ja="${esc(row.desc_ja || row.desc_en || row.desc)}">${esc(row.desc)}</p>` : ''}
        ${items.length ? `<div class="pd-chips">${items.map((v, i) => {
          const en = itemsEn[i] || v;
          const ja = itemsJa[i] || en;
          return `<span class="pd-chip${/環保|認證|標章|回收|再生/.test(v) ? ' is-eco' : ''}" data-tw="${esc(v)}" data-en="${esc(en)}" data-ja="${esc(ja)}">${esc(v)}</span>`;
        }).join('')}</div>` : ''}
        <a class="pd-cta" href="/contact"><span data-tw="聯繫我們" data-en="Contact Us" data-ja="お問い合わせ">聯繫我們</span> <i class="fa-solid fa-arrow-right"></i></a>
      </div>
      <figure class="pd-figure">
        ${img
          ? `<img src="${esc(img)}" alt="${esc(nameTw)} ${esc(nameEn)}" width="1200" height="900" loading="eager" decoding="async">`
          : `<span class="pd-noimg" data-tw="產品照片準備中" data-en="Product photo coming soon" data-ja="製品写真は準備中です">產品照片準備中</span>`}
      </figure>
    </article>

    ${others.length ? `<section class="pd-more">
      <h2 data-tw="其他產品系列" data-en="Other Product Lines" data-ja="その他の製品シリーズ">其他產品系列</h2>
      <div class="pd-more-grid">
        ${others.map((r) => {
          const n = mainName(r.name);
          const e = mainName(r.name_en);
          return `<a class="pd-more-card" href="/products/${productSlug(r)}">
            <div class="pd-more-name" data-tw="${esc(n)}" data-en="${esc(e || n)}" data-ja="${esc(mainName(r.name_ja) || e || n)}">${esc(n)}</div>
            ${e ? `<div class="pd-more-en">${esc(e)}</div>` : ''}
          </a>`;
        }).join('')}
      </div>
    </section>` : ''}
  </main>

  <div id="site-footer-component"></div>
  <script src="/assets/js/footer.js"></script>
  <script src="/assets/js/site-search.js?v=2"></script>
  <script src="/assets/js/mobile-nav.js?v=8"></script>
  <script src="/assets/js/site-lang.js?v=10"></script>
  <script src="/assets/js/site-year.js"></script>
  <script src="/assets/js/cjk-nbsp.js?v=5"></script>
</body>
</html>`;
}

function notFoundHtml() {
  return `<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>找不到這個產品｜${COMPANY_TW}</title>
  <meta name="robots" content="noindex, follow">
  <link rel="icon" href="/assets/img/inteplast-logo-blue.svg" type="image/svg+xml">
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: 'Noto Sans TC', -apple-system, sans-serif; color: #1E293B; background: #F8FAFC; }
    .box { text-align: center; padding: 40px 24px; }
    h1 { margin: 0 0 12px; font-size: 1.5rem; color: #0A2540; }
    p { margin: 0 0 24px; color: #64748B; }
    a { display: inline-block; padding: 12px 26px; background: #00529B; color: #fff;
      border-radius: 999px; text-decoration: none; font-weight: 700; }
  </style>
</head>
<body>
  <div class="box">
    <h1>找不到這個產品</h1>
    <p>這個網址可能已經變更或不存在。</p>
    <a href="/products/">前往產品中心</a>
  </div>
</body>
</html>`;
}
