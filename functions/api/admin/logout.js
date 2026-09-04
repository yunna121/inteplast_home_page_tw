import { json } from "../_lib.js";
import { makeToken, cookieHeader, clearCookie } from "./_middleware.js";

/* 密碼登入
   ------------------------------------------------------------
   POST /api/admin/login   { password }
   POST /api/admin/logout

   密碼存在 Pages 的環境變數 ADMIN_PASSWORD（設成 Secret，
   不要寫進程式碼）。這裡不回報「密碼錯誤」與「還沒設密碼」的
   差別以外的細節，也刻意不記錄嘗試次數 —— 真的要防暴力破解
   應該用 Cloudflare Access 或 WAF 規則，不是在這裡自己寫。 */

function slowEquals(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequest(context) {
  const { request, env } = context;
  const path = new URL(request.url).pathname;

  if (path.endsWith("/logout")) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "content-type": "application/json;charset=UTF-8",
        "set-cookie": clearCookie(),
      },
    });
  }

  if (request.method !== "POST") return json({ error: "只接受 POST" }, 405);

  const secret = env.ADMIN_PASSWORD;
  if (!secret) {
    return json({ error: "還沒設定密碼。請在 Pages → Settings → Variables and Secrets 新增 ADMIN_PASSWORD" }, 500);
  }

  const body = await request.json().catch(() => ({}));
  if (!slowEquals(String(body.password || ""), String(secret))) {
    return json({ error: "密碼不正確" }, 401);
  }

  const token = await makeToken(secret);
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "set-cookie": cookieHeader(token),
    },
  });
}
