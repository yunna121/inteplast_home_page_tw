/* sitemap.xml（動態產生）
   ============================================================

   為什麼不用靜態檔案
   ------------------------------------------------------------
   產品住在 D1，業務在後台新增或改名之後，靜態 sitemap 就過期了 ——
   而且沒有人會記得回來改。這裡每次請求都從資料庫算出目前的產品清單，
   永遠是最新的。

   內容
   ------------------------------------------------------------
   固定頁面 5 個 ＋ 每個產品 1 個，各乘以三種語言。
   每筆都用 xhtml:link 互相指認，Google 才知道那是同一頁的不同語言，
   而不是三份重複內容。

   注意
   ------------------------------------------------------------
   Pages 的 Functions 優先於靜態檔案，所以這支程式會蓋掉原本的
   sitemap.xml —— 那個靜態檔可以刪掉，留著也不會被用到。
   ============================================================ */

import { loadProducts, productSlug } from './products/_shared.js';

const SITE = 'https://inteplasttw.com.tw';

/* 語言前綴與 hreflang 標記。新增語言時這裡與 _middleware.js 各加一行。 */
const LANGS = [
  { prefix: '', hreflang: 'zh-Hant-TW' },
  { prefix: '/en', hreflang: 'en' },
  { prefix: '/ja', hreflang: 'ja' },
];

/* 固定頁面。priority 是相對重要性，給 Google 參考用。 */
const PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/products/', priority: '0.9', changefreq: 'weekly' },
  { path: '/about', priority: '0.8', changefreq: 'monthly' },
  { path: '/sustainability', priority: '0.8', changefreq: 'monthly' },
  { path: '/contact', priority: '0.7', changefreq: 'monthly' },
];

export async function onRequest(context) {
  try {
    let paths = PAGES.slice();

    /* 產品頁：讀不到資料庫也不要讓整份 sitemap 掛掉 ——
       至少把固定的五頁交出去。 */
    try {
      const rows = await loadProducts(context.env);
      rows.forEach((r) => {
        paths.push({ path: '/products/' + productSlug(r), priority: '0.9', changefreq: 'monthly' });
      });
    } catch (e) {
      // 略過產品，固定頁面照出
    }

    const today = new Date().toISOString().slice(0, 10);
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
      + '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

    paths.forEach((p) => {
      LANGS.forEach((l) => {
        xml += '  <url>\n'
          + '    <loc>' + SITE + l.prefix + p.path + '</loc>\n';
        LANGS.forEach((a) => {
          xml += '    <xhtml:link rel="alternate" hreflang="' + a.hreflang
            + '" href="' + SITE + a.prefix + p.path + '"/>\n';
        });
        xml += '    <xhtml:link rel="alternate" hreflang="x-default" href="' + SITE + p.path + '"/>\n'
          + '    <lastmod>' + today + '</lastmod>\n'
          + '    <changefreq>' + p.changefreq + '</changefreq>\n'
          + '    <priority>' + p.priority + '</priority>\n'
          + '  </url>\n';
      });
    });

    xml += '</urlset>\n';

    return new Response(xml, {
      headers: {
        'content-type': 'application/xml;charset=UTF-8',
        /* Google 一天最多讀幾次，快取一小時足夠，也擋掉無謂的資料庫查詢 */
        'cache-control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    return new Response('Sitemap error: ' + String(error), { status: 500 });
  }
}
