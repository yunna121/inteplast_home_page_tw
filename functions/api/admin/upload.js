import { json, fail } from "../_lib.js";

/* 圖片上傳 → 存進 D1
   ------------------------------------------------------------
   POST /api/admin/upload（FormData：file、可選 name）
   回傳 { name, url, bytes }

   不使用 R2，所以不需要另外開服務也不必綁付款方式。
   圖檔以 base64 存在 media 表，由 functions/media/[[path]].js 提供，
   網址仍是 /media/<檔名>。

   壓縮在瀏覽器端做（admin/index.html）：最長邊 1600px、轉 WebP。
   這裡只做最後的守門 —— 前端可以被繞過，大小限制要在後端擋。

   同名直接覆蓋：同事重新上傳修好的圖，網站上那張就跟著換，
   不必回來改資料庫欄位。 */

const MAX_BYTES = 900 * 1024;   // D1 單筆上限 1MB，留一點餘裕給 base64 以外的欄位
const ALLOWED = ["image/webp", "image/png", "image/jpeg", "image/gif", "image/svg+xml"];

function safeName(name) {
  return String(name || "")
    .split(/[\\/]/).pop()
    .replace(/[\u0000-\u001F\u007F"?#%<>]/g, "")
    .trim()
    .slice(0, 120) || "image";
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;   // 一次轉太多會爆掉呼叫堆疊
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ error: "只接受 POST" }, 405);

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return json({ error: "沒有收到檔案" }, 400);

    const type = file.type || "application/octet-stream";
    if (ALLOWED.indexOf(type) === -1) {
      return json({ error: "只接受圖片檔（webp／png／jpg／gif／svg），收到的是 " + type }, 400);
    }

    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return json({
        error: "圖片太大（" + Math.round(buffer.byteLength / 1024) + "KB，上限 " +
               Math.round(MAX_BYTES / 1024) + "KB）。請用小一點的原圖再試一次。"
      }, 400);
    }

    const name = safeName(form.get("name") || file.name);
    const width = Number(form.get("width") || 0) || 0;
    const height = Number(form.get("height") || 0) || 0;

    await env.DB.prepare(
      `INSERT INTO media (name, mime, data, bytes, width, height) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         mime = excluded.mime, data = excluded.data, bytes = excluded.bytes,
         width = excluded.width, height = excluded.height, created_at = datetime('now')`
    ).bind(name, type, toBase64(buffer), buffer.byteLength, width, height).run();

    return json({
      ok: true,
      name: name,
      url: "/media/" + encodeURIComponent(name),
      bytes: buffer.byteLength,
    });
  } catch (error) {
    if (String(error && error.message).indexOf("no such table") > -1) {
      return json({ error: "還沒建立 media 表。請先在 D1 執行 db/v8-media.sql" }, 500);
    }
    return fail(error);
  }
}
