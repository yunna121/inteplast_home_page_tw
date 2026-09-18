/* 產品網址與資料讀取（共用）
   ------------------------------------------------------------
   產品頁與 sitemap 都要算出同一組網址，所以規則放在這裡一份。

   網址取自英文品名：
     Can Liner            → /products/can-liner
     Scale Sheet / Tare…  → /products/scale-sheet   （取斜線前的主名）

   為什麼不用中文品名或 id：
     · 中文做網址會變成一長串百分號編碼，買家看不懂也不好貼
     · 英文品名本身就是買家會搜的字（can liner、draw tape liner），
       出現在網址裡對排名有幫助
     · id 沒有語意，而且未來重排會亂

   沒有英文品名時退回 product-<id>，至少網址穩定不會撞。
   ------------------------------------------------------------ */

import { attachTranslations } from "../api/_lib.js";

export function slugify(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // 去掉重音符號
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // 非英數一律變連字號
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/* 品名可能寫成「Scale Sheet / Tare Sheet」（主名／別稱），取主名 */
export function mainName(name) {
  return String(name || '').split('/')[0].trim();
}

export function aliasOf(name) {
  const parts = String(name || '').split('/').map((s) => s.trim()).filter(Boolean);
  parts.shift();
  return parts.join(' / ');
}

export function productSlug(row) {
  return slugify(mainName(row.name_en)) || ('product-' + row.id);
}

/* 一次把產品與各語言譯文讀出來（欄位會多出 name_en、desc_ja… 見 _lib.js） */
export async function loadProducts(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM products ORDER BY sort_order, id'
  ).all();
  return await attachTranslations(env.DB, 'product', results || []);
}

/* 產品照：後台上傳的存 /media/…，舊資料只有檔名。
   產品頁用 img（首頁才用 img_home）。 */
export function imageUrl(row) {
  const raw = String(row.img || row.img_home || '').trim();
  if (!raw) return '';
  if (/^(https?:)?\/\//.test(raw) || raw.charAt(0) === '/') return raw;
  const n = raw.replace(/^\.?\/?(src|assets\/img)\//, '');
  return '/media/' + encodeURIComponent(n);
}

/* 產品細項是用「、」分隔的一串字 */
export function splitItems(s) {
  return String(s || '')
    .split(/[、,，\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}
