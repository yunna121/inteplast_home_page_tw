/* 提供存在 D1 裡的圖片：/media/<檔名>
   ------------------------------------------------------------
   圖檔以 base64 存在 media 表（見 functions/api/admin/upload.js）。
   這裡解碼後回傳，並帶上長效快取與 ETag —— 圖片內容變了檔名通常
   也會換，就算同名覆蓋，ETag 會跟著變，瀏覽器不會拿到舊的。 */

function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function onRequest(context) {
  const { env, params, request } = context;

  const key = decodeURIComponent(
    Array.isArray(params.path) ? params.path.join("/") : String(params.path || "")
  );
  if (!key) return new Response("Not found", { status: 404 });

  try {
    const row = await env.DB.prepare(
      "SELECT mime, data, bytes, created_at FROM media WHERE name = ?"
    ).bind(key).first();

    if (!row) return new Response("Not found", { status: 404 });

    const etag = '"' + String(row.bytes) + "-" + String(row.created_at).replace(/\D/g, "") + '"';
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { etag: etag } });
    }

    return new Response(fromBase64(row.data), {
      headers: {
        "content-type": row.mime || "image/webp",
        "cache-control": "public, max-age=31536000",
        etag: etag,
      },
    });
  } catch (error) {
    return new Response("圖片讀取失敗：" + String(error && error.message), { status: 500 });
  }
}
