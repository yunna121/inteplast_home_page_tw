-- 臺灣營德網站 — 編輯頁所需的資料表（v3）
-- ============================================================
-- 這份 SQL 分兩階段。先跑「階段一」，確認網站正常後再跑「階段二」。
-- 階段一只新增東西，不動既有資料，所以隨時可以停下來。
--
-- 執行：npx wrangler d1 execute <你的資料庫名> --remote --file=schema-v3.sql
-- （或整份貼進 Cloudflare D1 Console）
-- ============================================================


-- ════════════════════════════════════════════════════════════
--  階段一：新增資料表 + 把現有英文欄位搬進 translations
-- ════════════════════════════════════════════════════════════

-- ── 語言清單 ────────────────────────────────────────────────
-- 之後要加日文、越南文，就在編輯頁的「語言」頁籤新增一列，
-- 不需要改任何程式碼或資料表結構。
CREATE TABLE IF NOT EXISTS languages (
  code       TEXT PRIMARY KEY,              -- 'zh-TW'、'en'、'ja'
  label      TEXT NOT NULL,                 -- 顯示名稱：繁體中文、English
  is_base    INTEGER NOT NULL DEFAULT 0,    -- 1 = 基準語言（內容存在 products／timeline 本表）
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO languages (code, label, is_base, sort_order) VALUES
  ('zh-TW', '繁體中文', 1, 0),
  ('en',    'English',  0, 1);


-- ── 翻譯總表 ────────────────────────────────────────────────
-- 一列＝「某筆資料的某個欄位，在某個語言下的內容」。
--
-- 為什麼是一張表而不是一個語言一張表：
--   加一種語言 = 多幾列資料，不必 CREATE TABLE、不必改 API、
--   不必改前端。編輯頁的語言頁籤也會自己長出來。
--
-- 基準語言（繁中）不放這裡 —— 它在 products／timeline／settings 本表，
-- 那是「唯一真相」，翻譯都掛在它身上。
CREATE TABLE IF NOT EXISTS translations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  entity    TEXT NOT NULL,                  -- 'product'、'timeline'、'setting'
  entity_id INTEGER NOT NULL,               -- 對應那張表的 id
  field     TEXT NOT NULL,                  -- 'name'、'desc'、'items'、'title'…
  lang      TEXT NOT NULL REFERENCES languages(code) ON DELETE CASCADE,
  value     TEXT NOT NULL DEFAULT '',
  UNIQUE (entity, entity_id, field, lang)
);

CREATE INDEX IF NOT EXISTS idx_tr_lookup ON translations (entity, lang, entity_id);


-- ── 公司資訊 ────────────────────────────────────────────────
-- 原本在 content/site.json，改由編輯頁維護。
-- translatable = 1 的欄位（地址）可以有各語言版本。
CREATE TABLE IF NOT EXISTS settings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  key          TEXT NOT NULL UNIQUE,
  value        TEXT NOT NULL DEFAULT '',
  label        TEXT NOT NULL DEFAULT '',    -- 編輯頁上顯示的欄位名稱
  hint         TEXT NOT NULL DEFAULT '',
  translatable INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO settings (key, value, label, hint, translatable, sort_order) VALUES
  ('company_name', '臺灣營德股份有限公司', '公司名稱', '', 1, 1),
  ('address', '臺北市松山區敦化北路205號6樓609室', '公司地址', '各語言可以有自己的寫法', 1, 2),
  ('phone', '02-2712-2211 #8109', '總機電話（顯示用）', '例：02-2712-2211 #8109', 0, 3),
  ('phone_link', '0227122211,8109', '總機電話（撥號用）', '只留數字與逗號', 0, 4),
  ('email', 'lyanchen@wpjk.inteplast.com', '聯絡信箱', '詢價通知會寄到這裡', 0, 5),
  ('email_cc', '', '副本收件人', '可留空', 0, 6),
  ('copyright', '© 2026 INTEPLAST TAIWAN CORPORATION. All Rights Reserved.', '頁尾版權文字', '', 1, 7);

INSERT OR IGNORE INTO translations (entity, entity_id, field, lang, value)
SELECT 'setting', id, 'value', 'en', '6F., No. 205, Dunhua N. Rd., Songshan Dist., Taipei City, Taiwan'
  FROM settings WHERE key = 'address';

INSERT OR IGNORE INTO translations (entity, entity_id, field, lang, value)
SELECT 'setting', id, 'value', 'en', 'INTEPLAST TAIWAN CORPORATION'
  FROM settings WHERE key = 'company_name';


-- ── 別名建議（LLM 產生，待人工核准）─────────────────────────
-- 機器產的別名不直接進 synonyms —— 錯的別名會把客戶導到錯的產品，
-- 而且沒人會發現。所以先進這張待審表，核准後才寫進 synonyms。
CREATE TABLE IF NOT EXISTS synonym_suggestions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  say        TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'ai',        -- ai｜search（0 筆搜尋詞）
  status     TEXT NOT NULL DEFAULT 'pending',   -- pending｜approved｜rejected
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, say)
);

CREATE INDEX IF NOT EXISTS idx_sugg_status ON synonym_suggestions (status, product_id);


-- ── 把現有的英文欄位搬進 translations ───────────────────────
-- 原本每個語言一個欄位（name_en、desc_en…），加第三種語言就要
-- ALTER TABLE。搬進 translations 之後，語言是資料而不是結構。
-- 這裡只複製、不刪欄位，所以網站不會有任何變化。

INSERT OR IGNORE INTO translations (entity, entity_id, field, lang, value)
SELECT 'product', id, 'name', 'en', name_en FROM products WHERE COALESCE(name_en, '') <> '';

INSERT OR IGNORE INTO translations (entity, entity_id, field, lang, value)
SELECT 'product', id, 'highlight', 'en', highlight_en FROM products WHERE COALESCE(highlight_en, '') <> '';

INSERT OR IGNORE INTO translations (entity, entity_id, field, lang, value)
SELECT 'product', id, 'desc', 'en', desc_en FROM products WHERE COALESCE(desc_en, '') <> '';

INSERT OR IGNORE INTO translations (entity, entity_id, field, lang, value)
SELECT 'product', id, 'items', 'en', items_en FROM products WHERE COALESCE(items_en, '') <> '';

INSERT OR IGNORE INTO translations (entity, entity_id, field, lang, value)
SELECT 'timeline', id, 'title', 'en', title_en FROM timeline WHERE COALESCE(title_en, '') <> '';

INSERT OR IGNORE INTO translations (entity, entity_id, field, lang, value)
SELECT 'timeline', id, 'description', 'en', description_en FROM timeline WHERE COALESCE(description_en, '') <> '';


-- ── 階段一確認 ──────────────────────────────────────────────
SELECT '語言' AS 表, COUNT(*) AS 列數 FROM languages
UNION ALL SELECT '翻譯', COUNT(*) FROM translations
UNION ALL SELECT '公司資訊', COUNT(*) FROM settings
UNION ALL SELECT '別名', COUNT(*) FROM synonyms
UNION ALL SELECT '待審別名', COUNT(*) FROM synonym_suggestions;

-- 搬過來的英文應該跟原本的欄位一致
SELECT p.id, p.name, p.name_en AS 原欄位, t.value AS 搬進translations
  FROM products p
  LEFT JOIN translations t
    ON t.entity = 'product' AND t.entity_id = p.id AND t.field = 'name' AND t.lang = 'en'
 ORDER BY p.id;


-- ════════════════════════════════════════════════════════════
--  階段二：刪掉舊的英文欄位
--  ------------------------------------------------------------
--  ⚠ 上面確認無誤、而且新版 API 與頁面都部署好、網站英文版正常
--    之後，才跑這一段。跑之前先確認 /api/products 回傳的
--    name_en 還在（它會改由 translations 組出來）。
--
--  跑法：把下面六行的註解拿掉再執行。
--  若你的 D1 版本不支援 DROP COLUMN 會報錯 —— 那就別跑，
--  留著那些欄位也不影響運作（API 會以 translations 為準）。
-- ════════════════════════════════════════════════════════════

-- ALTER TABLE products DROP COLUMN name_en;
-- ALTER TABLE products DROP COLUMN highlight_en;
-- ALTER TABLE products DROP COLUMN desc_en;
-- ALTER TABLE products DROP COLUMN items_en;
-- ALTER TABLE timeline DROP COLUMN title_en;
-- ALTER TABLE timeline DROP COLUMN description_en;
