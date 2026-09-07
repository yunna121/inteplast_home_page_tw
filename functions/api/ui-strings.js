import { json, fail } from "./_lib.js";

/* 全站文字對照表（公開讀取）
   ------------------------------------------------------------
   回傳 { "首頁": { en:"Home", ja:"ホーム" }, "清潔袋": { en:"Can Liner", ja:"ゴミ袋" }, … }

   鍵一律是**繁體中文原文** —— 也就是頁面上 data-tw 的值。
   src/site-lang.js 拿這份表去查，所以：
     · 新增語言不必改任何 HTML
     · 產品卡片、時間軸這些由 JS 產生的內容也自動翻譯，
       因為它們吐出來的 data-tw 就是中文原文

   涵蓋三個來源：
     ui_strings  介面文字（選單、按鈕、標語）
     products    產品名稱、重點、敘述、細項
     timeline    年份事件的標題與說明

   後兩者原本只在 API 回傳 name_en 這種欄位，前端要自己判斷語言；
   併進這張表之後前端完全不用管有幾種語言。

   繁中本身不在回傳裡：它就是鍵，也是頁面上的預設顯示。 */

const SOURCES = [
  { entity: "ui", table: "ui_strings", fields: { text: "zh" } },
  {
    entity: "product",
    table: "products",
    fields: { name: "name", highlight: "highlight", desc: "desc", items: "items" },
  },
  {
    entity: "timeline",
    table: "timeline",
    fields: { title: "title", description: "description", future_outlook: "future_outlook" },
  },
];

export async function onRequest(context) {
  try {
    const { DB } = context.env;
    const out = {};

    const [translations, ui, products, timeline] = await DB.batch([
      DB.prepare("SELECT entity, entity_id, field, lang, value FROM translations WHERE value <> ''"),
      DB.prepare("SELECT id, zh FROM ui_strings"),
      DB.prepare("SELECT id, name, highlight, desc, items FROM products"),
      DB.prepare("SELECT id, title, description, future_outlook FROM timeline"),
    ]);

    // entity → id → 該筆的繁中欄位值
    const base = { ui: {}, product: {}, timeline: {} };
    (ui.results || []).forEach((r) => { base.ui[r.id] = { text: r.zh }; });
    (products.results || []).forEach((r) => {
      base.product[r.id] = { name: r.name, highlight: r.highlight, desc: r.desc, items: r.items };
    });
    (timeline.results || []).forEach((r) => {
      base.timeline[r.id] = { title: r.title, description: r.description, future_outlook: r.future_outlook };
    });

    /* 依 SOURCES 的順序處理：介面文字優先，語意最明確；
       同一句中文若在多處出現，先寫入的那個翻譯勝出。 */
    const order = { ui: 0, product: 1, timeline: 2 };
    const rows = (translations.results || []).slice().sort(
      (a, b) => (order[a.entity] ?? 9) - (order[b.entity] ?? 9)
    );

    function put(zh, lang, value) {
      const key = String(zh || "").trim();
      const val = String(value || "").trim();
      if (!key || !val) return;
      if (!out[key]) out[key] = {};
      if (!out[key][lang]) out[key][lang] = val;
    }

    rows.forEach((t) => {
      const row = base[t.entity] && base[t.entity][t.entity_id];
      if (!row) return;
      const zh = row[t.field];
      if (zh == null || !String(zh).trim()) return;

      put(zh, t.lang, t.value);

      /* 產品細項在頁面上會被「、」拆成一顆一顆標籤，
         所以整串對不到 —— 這裡把每一段也各自建索引。
         只有兩邊段數相同才配對，數量不一致就跳過（寧可不翻，不要錯位）。 */
      if (t.entity === "product" && t.field === "items") {
        const zhParts = String(zh).split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
        const trParts = String(t.value).split(/[、,，･·]/).map((s) => s.trim()).filter(Boolean);
        if (zhParts.length === trParts.length) {
          zhParts.forEach((p, i) => put(p, t.lang, trParts[i]));
        }
      }
    });

    return json(out);
  } catch (error) {
    return fail(error);
  }
}
