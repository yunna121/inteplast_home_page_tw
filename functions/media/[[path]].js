/* 提供 R2 上的圖片：/media/<檔名>
   ------------------------------------------------------------
   R2 的物件不會自動對外，要嘛開公開網域、要嘛像這樣用 Function 代理。
   用 Function 的好處是網址在自己的網域底下（/media/…），
   換 bucket 或改權限都不影響前端寫的路徑。 */
export async function onRequest(context) {
  const { env, params, request } = context;

  if (!env.MEDIA) {
    return new Response("R2 尚未綁定（變數名 MEDIA）", { status: 500 });
  }

  const key = decodeURIComponent(
    Array.isArray(params.path) ? params.path.join("/") : String(params.path || "")
  );
  if (!key) return new Response("Not found", { status: 404 });

  const object = await env.MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "public, max-age=31536000");
  }

  // 瀏覽器帶 If-None-Match 時回 304，省流量
  if (request.headers.get("if-none-match") === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { headers });
}
