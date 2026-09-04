import { json, fail } from "../_lib.js";

/* 產品圖片上傳 → Cloudflare R2
   ------------------------------------------------------------
   POST /api/admin/upload（FormData，欄位名 file）
   回傳 { name, url }

   D1 只存檔名／路徑，圖檔本身放 R2。上傳後的圖由
   functions/media/[[path]].js 提供，網址是 /media/<檔名>。

   同名會直接覆蓋 —— 這是刻意的：同事重新上傳修好的圖時，
   網站上那張就跟著換，不必再回來改資料庫欄位。

   需要在 Pages → Settings → Bindings 綁一個 R2 bucket，變數名 MEDIA。 */

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];

function safeName(name) {
  // 去掉路徑與控制字元，保留中文（R2 的 key 支援 unicode）
  return String(name || "")
    .split(/[\\/]/).pop()
    .replace(/[\u0000-\u001F\u007F"?#%<>]/g, "")
    .trim()
    .slice(0, 120) || "image";
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") return json({ error: "只接受 POST" }, 405);
  if (!env.MEDIA) {
    return json({ error: "還沒綁定 R2。請到 Pages → Settings → Bindings 新增 R2 bucket，變數名 MEDIA" }, 500);
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return json({ error: "沒有收到檔案" }, 400);

    if (file.size > MAX_BYTES) {
      return json({ error: "檔案太大（上限 10MB），請先壓縮" }, 400);
    }
    const type = file.type || "application/octet-stream";
    if (!ALLOWED.includes(type)) {
      return json({ error: "只接受圖片檔（png／jpg／webp／svg／gif），收到的是 " + type }, 400);
    }

    const name = safeName(form.get("name") || file.name);

    await env.MEDIA.put(name, file.stream(), {
      httpMetadata: {
        contentType: type,
        cacheControl: "public, max-age=31536000",
      },
    });

    return json({ ok: true, name, url: "/media/" + encodeURIComponent(name) });
  } catch (error) {
    return fail(error);
  }
}
