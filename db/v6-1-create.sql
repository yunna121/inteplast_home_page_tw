-- 臺灣營德網站 — 介面文字（v6）
-- ============================================================
-- 選單、按鈕、標題、標語等寫在 HTML 裡的文字，改由資料庫管理。
--
-- 設計重點：**用繁體中文原文當索引鍵**。
--   頁面上的 data-tw="首頁" 就是鍵，所以現有 HTML 一行都不用改。
--   同一句話在頁首與頁尾出現兩次，只會有一筆資料、翻一次就好。
--
-- 其他語言存在既有的 translations 表（entity='ui'），
-- 所以之後加日文、越南文一樣不必新增資料表。
--
-- 執行：整份貼進 Cloudflare D1 Console 按 Execute
-- ============================================================

CREATE TABLE IF NOT EXISTS ui_strings (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  zh    TEXT NOT NULL UNIQUE,          -- 繁中原文，同時是頁面上的索引鍵
  page  TEXT NOT NULL DEFAULT '',      -- 出現在哪一頁（後台分組用）
  note  TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_ui_page ON ui_strings (page);

-- 從現有頁面抽出的 186 條字串（含 184 條既有英文）