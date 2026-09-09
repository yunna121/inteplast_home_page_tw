/* 後台的登入把關（/api/admin/* 全都會經過這裡）
   ------------------------------------------------------------
   Cloudflare Pages 的 middleware：放在 functions/api/admin/ 底下，
   這個資料夾內所有端點在執行前都會先跑這一支。

   支援三種登入方式，並存不衝突：

   1) Cloudflare Access —— 請求帶著 cf-access-jwt-assertion 標頭
      （Cloudflare 在邊緣驗過身分才會加上）。身分直接取
      cf-access-authenticated-user-email，最準確。

   2) 帳號＋密碼 —— 在 Pages 設環境變數 ADMIN_USERS，一人一組：

        ADMIN_USERS = dev:密碼A,sales:密碼B

      通過後拿到一個有簽章的 Cookie，Cookie 裡帶著帳號名，
      所以寫入資料時記得下來的是「是誰改的」，不是共用的 admin。
      離職／換人只要刪掉那一段，其他人的密碼不用動。

   3) 舊的單一密碼 ADMIN_PASSWORD —— 只設這個時仍然可以登入，
      帳號一律記成 admin（相容既有設定，不必立刻搬）。

   都沒設定時「放行」但回報 auth: 'none' —— 編輯頁會顯示紅色警告。
   刻意不擋死：否則你還沒設定就先把自己鎖在外面。

   Cookie 內容是「帳號 + 到期時間 + HMAC 簽章」，沒有存密碼本身；
   簽章金鑰是整份使用者設定，所以改任何人的密碼＝所有人重新登入。 */

const COOKIE = "itc_admin";
const MAX_AGE = 60 * 60 * 12; // 12 小時

function b64url(bytes) {
  let str = "";
  new Uint8Array(bytes).forEach((b) => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeName(name) {
  return b64url(new TextEncoder().encode(String(name)));
}

function decodeName(seg) {
  try {
    const b64 = String(seg).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

/** 簽章金鑰：優先用 ADMIN_USERS（整份設定），退回舊的 ADMIN_PASSWORD */
export function authSecret(env) {
  return env.ADMIN_USERS || env.ADMIN_PASSWORD || "";
}

/** ADMIN_USERS 解析成 { 帳號: 密碼 }。逗號、分號、換行都可以當分隔
    —— 全形的，：也一併接受：中文輸入法很容易打出全形，
    而這裡認不出來的後果是「一個帳號都沒有」—— 所有人都登不進來。 */
export function parseUsers(env) {
  const out = {};
  String(env.ADMIN_USERS || "")
    .replace(/\uFF1A/g, ":")
    .replace(/[\uFF0C\u3001]/g, ",")
    .split(/[,;\n\r]+/)
    .forEach((pair) => {
      const at = pair.indexOf(":");
      if (at < 1) return;
      const name = pair.slice(0, at).trim();
      const pass = pair.slice(at + 1).trim();
      if (name && pass) out[name] = pass;
    });
  return out;
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return b64url(mac);
}

/** 產生 Cookie 用的憑證：<帳號>.<到期時間>.<簽章> */
export async function makeToken(secret, user) {
  const name = encodeName(user || "admin");
  const expiry = String(Date.now() + MAX_AGE * 1000);
  return name + "." + expiry + "." + (await sign(name + ":" + expiry, secret));
}

export function cookieHeader(token) {
  return `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

/** 有效就回傳帳號名，無效回傳 null */
async function cookieUser(request, secret) {
  const raw = request.headers.get("cookie") || "";
  const hit = raw.split(/;\s*/).map((c) => c.split("=")).find((p) => p[0] === COOKIE);
  if (!hit || !hit[1]) return null;

  const parts = decodeURIComponent(hit[1]).split(".");
  /* 兩段是舊格式（只有到期時間 + 簽章），視為 admin，
     這樣既有的登入 Cookie 不會因為改版被踢出去。 */
  const legacy = parts.length === 2;
  const name = legacy ? "" : parts[0];
  const expiry = legacy ? parts[0] : parts[1];
  const mac = legacy ? parts[1] : parts[2];
  if (!expiry || !mac) return null;
  if (Number(expiry) < Date.now()) return null;

  const expect = await sign(legacy ? expiry : name + ":" + expiry, secret);
  if (expect.length !== mac.length) return null;
  // 逐字元比較，避免用 === 比較字串時的時間差
  let diff = 0;
  for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ mac.charCodeAt(i);
  if (diff !== 0) return null;

  return legacy ? "admin" : (decodeName(name) || "admin");
}

export async function onRequest(context) {
  const { request, env, next, data } = context;
  const path = new URL(request.url).pathname;

  // 登入端點本身不能被擋住，否則沒人進得來
  if (path.endsWith("/login") || path.endsWith("/logout")) return next();

  if (request.headers.get("cf-access-jwt-assertion")) {
    data.auth = "access";
    data.user = request.headers.get("cf-access-authenticated-user-email") || "access";
    return next();
  }

  const secret = authSecret(env);
  if (!secret) {
    // 尚未設定任何保護 —— 放行，但讓編輯頁知道要顯示警告
    data.auth = "none";
    data.user = "";
    return next();
  }

  const user = await cookieUser(request, secret);
  if (user) {
    data.auth = "password";
    data.user = user;
    return next();
  }

  return new Response(JSON.stringify({ error: "尚未登入", needLogin: true }), {
    status: 401,
    headers: { "content-type": "application/json;charset=UTF-8" },
  });
}
