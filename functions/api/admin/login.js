import { json } from "../_lib.js";
import { makeToken, cookieHeader, clearCookie, authSecret, parseUsers } from "./_middleware.js";

/* 帳號密碼登入
   ------------------------------------------------------------
   POST /api/admin/login   { user, password }
   POST /api/admin/logout

   帳號與密碼存在 Pages 的環境變數 ADMIN_USERS（設成 Secret），
   一人一組、用逗號分隔：

     ADMIN_USERS = dev:密碼A,sales:密碼B

   通過後 Cookie 裡會帶著帳號名，寫入資料時就記得下來是誰改的
   （save.js 的 updated_by）。刪掉某一段就等於停用那個人，
   其他人的密碼不受影響。

   只設了舊的 ADMIN_PASSWORD 時仍然可以登入（帳號記成 admin），
   所以不必為了升級先改設定。

   刻意不記錄嘗試次數 —— 真的要防暴力破解應該用 Cloudflare Access
   或 WAF 規則，不是在這裡自己寫。 */

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

  const users = parseUsers(env);
  const legacy = env.ADMIN_PASSWORD;
  if (!Object.keys(users).length && !legacy) {
    return json({ error: "還沒設定帳號。請在 Pages → Settings → Variables and Secrets 新增 ADMIN_USERS（格式：dev:密碼A,sales:密碼B）" }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.user || "").trim();
  const password = String(body.password || "");

  let who = "";

  if (Object.keys(users).length) {
    /* 帳號不存在時不直接回「沒有這個帳號」—— 那等於告訴對方哪些帳號存在。
       一律回同一句「帳號或密碼不正確」。 */
    const expect = users[name];
    if (expect && slowEquals(password, expect)) who = name;
  }

  // 舊設定：只有一組密碼，帳號欄填什麼都可以
  if (!who && legacy && slowEquals(password, String(legacy))) who = name || "admin";

  if (!who) {
    /* 分開回報「設定有問題」與「打錯了」—— 兩者的處理方式完全不同。
       ADMIN_USERS 有值但一個帳號都解析不出來，通常是用了全形符號
       或漏了冒號，這種情況要講清楚，不然會一直以為是密碼記錯。 */
    if (env.ADMIN_USERS && !Object.keys(users).length) {
      return json({ error: "ADMIN_USERS 格式看不懂，應為 dev:密碼A,sales:密碼B（半形冒號與逗號）" }, 500);
    }
    return json({ error: "帳號或密碼不正確" }, 401);
  }

  const token = await makeToken(authSecret(env), who);
  return new Response(JSON.stringify({ ok: true, user: who }), {
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "set-cookie": cookieHeader(token),
    },
  });
}
