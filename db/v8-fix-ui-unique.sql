-- 修正：中文文案不該有唯一限制
-- ============================================================
-- 症狀：在「介面文字」改中文並儲存時出現
--       UNIQUE constraint failed: ui_strings.zh
--
-- 原因：這張表建立時，zh（繁中原文）同時扮演「索引鍵」，
--       所以加了 UNIQUE。後來把鍵獨立成 zh_key、讓 zh 變成
--       可編輯的顯示文案，那條 UNIQUE 就變成錯的限制 ——
--       兩個不同位置的文案本來就可能被改成同一句話
--       （例如兩處都改成「聯繫我們」）。
--
-- 修法：唯一限制改掛在 zh_key（那才是真正不能重複的鍵），
--       zh 放開。SQLite 不能直接移除限制，必須重建整張表。
--
-- id 會原樣保留 —— translations 靠 entity_id 對應這張表，
-- 換了 id 所有翻譯都會對不上。
--
-- 整份貼進 D1 Console 按 Execute
-- ============================================================

CREATE TABLE ui_strings_new (
  id      INTEGER PRIMARY KEY,            -- 沿用原 id，不重新編號
  zh      TEXT NOT NULL,                  -- 顯示用的中文，可重複、可編輯
  zh_key  TEXT NOT NULL UNIQUE,           -- 頁面對應用的原始那句，不可重複
  page    TEXT NOT NULL DEFAULT '',
  note    TEXT NOT NULL DEFAULT '',
  hidden  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO ui_strings_new (id, zh, zh_key, page, note, hidden)
SELECT id,
       zh,
       COALESCE(NULLIF(zh_key, ''), zh),  -- 保險：zh_key 空的就補回 zh
       COALESCE(page, ''),
       COALESCE(note, ''),
       COALESCE(hidden, 0)
  FROM ui_strings;

DROP TABLE ui_strings;

ALTER TABLE ui_strings_new RENAME TO ui_strings;

CREATE INDEX IF NOT EXISTS idx_ui_page ON ui_strings (page);
CREATE INDEX IF NOT EXISTS idx_ui_key ON ui_strings (zh_key);

-- 確認：筆數應與修改前相同（174 左右），且沒有空的 zh_key
SELECT COUNT(*) AS 總筆數,
       SUM(CASE WHEN zh_key = '' OR zh_key IS NULL THEN 1 ELSE 0 END) AS 缺少鍵的,
       SUM(CASE WHEN zh <> zh_key THEN 1 ELSE 0 END) AS 已改過文案的
  FROM ui_strings;
