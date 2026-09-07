-- 清掉誤抓進來的程式碼片段
-- ============================================================
-- 抽取程式把 JS 字串串接裡的 data-tw 也當成文字了，例如
--   '<h3 data-tw="' + esc(tw.main) + '">'
-- 這種不是給人看的字，一併把它們的翻譯也刪掉。
--
-- 整份貼進 D1 Console 按 Execute
-- ============================================================

DELETE FROM translations
 WHERE entity = 'ui'
   AND entity_id IN (SELECT id FROM ui_strings WHERE zh IN (
     ''' + esc(s) + ''',
     ''' + esc(tw.main) + ''',
     '又稱 '' + esc(tw.alias) + ''',
     ''' + esc(row.highlight) + ''',
     ''' + esc(cat.highlight) + ''',
     ''' + esc(cat.desc) + ''',
     ''' + esc(noStr + '' '' + nameTw) + ''',
     ''' + tw + '''
   ));

DELETE FROM ui_strings WHERE zh IN (
  ''' + esc(s) + ''',
  ''' + esc(tw.main) + ''',
  '又稱 '' + esc(tw.alias) + ''',
  ''' + esc(row.highlight) + ''',
  ''' + esc(cat.highlight) + ''',
  ''' + esc(cat.desc) + ''',
  ''' + esc(noStr + '' '' + nameTw) + ''',
  ''' + tw + '''
);

-- 確認：應該剩下 178 條
SELECT COUNT(*) AS 介面文字筆數 FROM ui_strings;
