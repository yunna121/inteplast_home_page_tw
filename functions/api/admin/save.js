import { json, fail } from "../_lib.js";

/* 編輯頁的唯一寫入端點
   ------------------------------------------------------------
   POST /api/admin/save
   {
     entity: 'product' | 'timeline' | 'synonym' | 'setting' | 'language' | 'suggestion',
     action: 'create' | 'update' | 'delete' | 'approve' | 'reject',
     id:     數字（update／delete 時必填；language 用 code）
     base:   { 欄位: 值 }          ← 基準語言（繁中），寫進該資料表本身
     tr:     { 語言: { 欄位: 值 } } ← 其他語言，寫進 translations
   }

   欄位一律走白名單（下面的 ENTITIES），呼叫端傳什麼欄位名都不會
   變成 SQL —— 只有白名單裡的欄位會被組進語句，值一律用 bind()。

   ⚠ 必須用 Cloudflare Access 保護 /api/admin* —— 沒有的話任何人
     都能改資料。詳見 README-admin.txt。 */

const ENTITIES = {
  product: {
    table: "products",
    base: ["name", "highlight", "desc", "img", "img_home", "items", "patent", "patent_no"],
    translatable: ["name", "highlight", "desc", "items"],
    required: ["name"],
  },
  timeline: {
    table: "timeline",
    base: ["year", "title", "description", "future_outlook"],
    translatable: ["title", "description", "future_outlook"],
    required: ["year"],
  },
  synonym: {
    table: "synonyms",
    base: ["product_id", "say"],
    translatable: [],
    required: ["product_id", "say"],
  },
  setting: {
    table: "settings",
    base: ["value"],
    translatable: ["value"],
    required: [],
  },
  inquiry: {
    // 客戶送來的內容不可編輯（那是紀錄），只能改處理狀態與內部備註
    table: "inquiries",
    base: ["status", "note"],
    translatable: [],
    required: [],
  },
  /* 介面文字：zh_key 是頁面對應用的鍵（永不變），zh 是實際顯示的中文。
     業務改 zh 就等於改網站文案；zh_key 不開放修改。 */
  ui: {
    table: "ui_strings",
    base: ["zh", "note"],
    translatable: ["text"],
    required: ["zh"],
  },
  /* 頁面區塊：版型（layout）只能是固定那幾種，樣式由程式碼決定，
     所以業務填內容、排順序都不會弄壞版面。 */
  block: {
    table: "page_blocks",
    base: ["page", "layout", "eyebrow", "title", "body", "image", "caption", "sort_order", "visible"],
    translatable: ["eyebrow", "title", "body", "caption"],
    required: ["page"],
  },
};

const BLOCK_LAYOUTS = ["image-right", "image-left", "full-image", "text", "quote"];
const BLOCK_PAGES = ["about", "sustainability"];

function clean(value) {
  return value == null ? "" : String(value);
}

export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  if (request.method !== "POST") {
    return json({ error: "只接受 POST" }, 405);
  }

  try {
    const body = await request.json();
    const entity = String(body.entity || "");
    const action = String(body.action || "");

    /* ── 語言：主鍵是 code（文字），單獨處理 ── */
    if (entity === "language") {
      const code = String((body.base && body.base.code) || body.id || "").trim();
      if (!code) return json({ error: "語言代碼不能空白" }, 400);

      if (action === "delete") {
        const base = await DB.prepare("SELECT is_base FROM languages WHERE code = ?").bind(code).first();
        if (base && base.is_base) return json({ error: "基準語言不能刪除" }, 400);
        // translations 有 ON DELETE CASCADE，但 D1 不一定啟用外鍵，這裡明確刪
        await DB.batch([
          DB.prepare("DELETE FROM translations WHERE lang = ?").bind(code),
          DB.prepare("DELETE FROM languages WHERE code = ?").bind(code),
        ]);
        return json({ ok: true, deleted: code });
      }

      const label = clean(body.base && body.base.label).trim() || code;
      const sort = Number((body.base && body.base.sort_order) || 0) || 0;
      await DB.prepare(
        `INSERT INTO languages (code, label, sort_order) VALUES (?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET label = excluded.label, sort_order = excluded.sort_order`
      ).bind(code, label, sort).run();
      return json({ ok: true, code });
    }

    /* ── 別名建議：核准／退回 ── */
    if (entity === "suggestion") {
      const id = Number(body.id || 0);
      if (!id) return json({ error: "缺少 id" }, 400);

      if (action === "approve") {
        await DB.batch([
          DB.prepare(
            `INSERT OR IGNORE INTO synonyms (product_id, say)
             SELECT product_id, say FROM synonym_suggestions WHERE id = ?`
          ).bind(id),
          DB.prepare("UPDATE synonym_suggestions SET status = 'approved' WHERE id = ?").bind(id),
        ]);
        return json({ ok: true, approved: id });
      }

      if (action === "reject") {
        await DB.prepare("UPDATE synonym_suggestions SET status = 'rejected' WHERE id = ?").bind(id).run();
        return json({ ok: true, rejected: id });
      }

      if (action === "delete") {
        await DB.prepare("DELETE FROM synonym_suggestions WHERE id = ?").bind(id).run();
        return json({ ok: true, deleted: id });
      }

      return json({ error: "不支援的動作：" + action }, 400);
    }

    /* ── 一般資料表 ── */
    const conf = ENTITIES[entity];
    if (!conf) return json({ error: "不支援的資料類型：" + entity }, 400);

    /* 區塊：版型與頁面只接受白名單裡的值 —— 這是「版面壞不掉」的保證，
       不能靠前端下拉選單擋，API 收到什麼都要自己驗。 */
    if (entity === "block" && body.base) {
      if (body.base.layout != null && BLOCK_LAYOUTS.indexOf(String(body.base.layout)) === -1) {
        return json({ error: "不支援的版型：" + body.base.layout }, 400);
      }
      if (body.base.page != null && BLOCK_PAGES.indexOf(String(body.base.page)) === -1) {
        return json({ error: "不支援的頁面：" + body.base.page }, 400);
      }
    }

    /* 區塊排序：一次送整批新順序 */
    if (entity === "block" && action === "reorder") {
      const order = Array.isArray(body.order) ? body.order : [];
      if (!order.length) return json({ error: "沒有收到順序" }, 400);
      await DB.batch(
        order.map((id, i) =>
          DB.prepare("UPDATE page_blocks SET sort_order = ? WHERE id = ?").bind(i, Number(id))
        )
      );
      return json({ ok: true, ordered: order.length });
    }

    const id = Number(body.id || 0);

    if (action === "delete") {
      if (!id) return json({ error: "缺少 id" }, 400);
      if (entity === "setting") return json({ error: "公司資訊的欄位不能刪除" }, 400);

      const stmts = [DB.prepare(`DELETE FROM ${conf.table} WHERE id = ?`).bind(id)];
      if (conf.translatable.length) {
        stmts.push(
          DB.prepare("DELETE FROM translations WHERE entity = ? AND entity_id = ?").bind(entity, id)
        );
      }
      if (entity === "product") {
        // 產品刪掉時它的別名與待審建議一併清掉，免得留下指向不存在產品的孤兒
        stmts.push(DB.prepare("DELETE FROM synonyms WHERE product_id = ?").bind(id));
        stmts.push(DB.prepare("DELETE FROM synonym_suggestions WHERE product_id = ?").bind(id));
      }
      await DB.batch(stmts);
      return json({ ok: true, deleted: id });
    }

    const incoming = body.base || {};
    const cols = conf.base.filter((c) => Object.prototype.hasOwnProperty.call(incoming, c));

    for (const need of conf.required) {
      const provided = Object.prototype.hasOwnProperty.call(incoming, need);
      if (action === "create" && (!provided || !clean(incoming[need]).trim())) {
        return json({ error: "「" + need + "」不能空白" }, 400);
      }
      if (action === "update" && provided && !clean(incoming[need]).trim()) {
        return json({ error: "「" + need + "」不能空白" }, 400);
      }
    }

    let rowId = id;

    if (action === "create") {
      if (!cols.length) return json({ error: "沒有可寫入的欄位" }, 400);
      const marks = cols.map(() => "?").join(", ");
      const res = await DB.prepare(
        `INSERT INTO ${conf.table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${marks})`
      ).bind(...cols.map((c) => clean(incoming[c]))).run();
      rowId = res.meta && res.meta.last_row_id;
      if (!rowId) return json({ error: "新增後取不到 id" }, 500);
    } else if (action === "update") {
      if (!rowId) return json({ error: "缺少 id" }, 400);
      if (cols.length) {
        const sets = cols.map((c) => `"${c}" = ?`).join(", ");
        await DB.prepare(`UPDATE ${conf.table} SET ${sets} WHERE id = ?`)
          .bind(...cols.map((c) => clean(incoming[c])), rowId)
          .run();
      }
    } else {
      return json({ error: "不支援的動作：" + action }, 400);
    }

    /* ── 其他語言寫進 translations ──
       值清空時直接刪掉那一列，表裡不留空字串。 */
    const tr = body.tr || {};
    const stmts = [];
    Object.keys(tr).forEach((lang) => {
      const fields = tr[lang] || {};
      conf.translatable.forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(fields, field)) return;
        const value = clean(fields[field]);
        if (value.trim() === "") {
          stmts.push(
            DB.prepare(
              "DELETE FROM translations WHERE entity = ? AND entity_id = ? AND field = ? AND lang = ?"
            ).bind(entity, rowId, field, lang)
          );
        } else {
          stmts.push(
            DB.prepare(
              `INSERT INTO translations (entity, entity_id, field, lang, value) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(entity, entity_id, field, lang) DO UPDATE SET value = excluded.value`
            ).bind(entity, rowId, field, lang, value)
          );
        }
      });
    });
    if (stmts.length) await DB.batch(stmts);

    return json({ ok: true, id: rowId });
  } catch (error) {
    return fail(error);
  }
}
