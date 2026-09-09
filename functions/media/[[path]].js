/* 提供存在 D1 裡的圖片：/media/<檔名>
   ------------------------------------------------------------
   圖檔以 base64 存在 media 表（見 functions/api/admin/upload.js）。

   快取策略：每次都跟伺服器確認（must-revalidate），由 ETag 決定回
   304 還是新內容。原本寫 max-age=31536000，但那樣瀏覽器根本不會回頭
   問，ETag 永遠沒機會作用 —— 同事用同一個檔名重新上傳修好的圖，
   網站上還是舊的那張，而且他會以為是自己傳錯了。
   304 的成本很低（只有標頭、沒有圖檔本體），換得到「改了就一定看得到」。 */

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
      return new Response(null, {
        status: 304,
        headers: { etag: etag, "cache-control": "public, max-age=0, must-revalidate" },
      });
    }

    return new Response(fromBase64(row.data), {
      headers: {
        "content-type": row.mime || "image/webp",
        "cache-control": "public, max-age=0, must-revalidate",
        etag: etag,
      },
    });
  } catch (error) {
    return new Response("圖片讀取失敗：" + String(error && error.message), { status: 500 });
  }
}
