/* 後台的登入把關（/api/admin/* 全都會經過這裡）
   ------------------------------------------------------------
   Cloudflare Pages 的 middleware：放在 functions/api/admin/ 底下，
   這個資料夾內所有端點在執行前都會先跑這一支。

   支援兩種登入方式，並存不衝突：

   1) Cloudflare Access —— 請求帶著 cf-access-jwt-assertion 標頭
      （Cloudflare 在邊緣驗過身分才會加上）。這是比較好的方式：
      每個人用自己的信箱、有登入紀錄、離職從名單移除即可。

   2) 密碼登入 —— 在 Pages 設一個環境變數 ADMIN_PASSWORD，
      同事在編輯頁輸入密碼，通過後拿到一個有簽章的 Cookie。
      一組共用密碼、沒有個人紀錄，換人要換密碼。

   兩個都沒設定時，這裡「放行」但回報 auth: 'none' ——
   編輯頁會顯示紅色警告。刻意不擋死：否則你還沒設定就先把
   自己鎖在外面，而且會以為是程式壞了。

   Cookie 內容是「到期時間 + HMAC 簽章」，沒有存密碼本身；
   簽章用 ADMIN_PASSWORD 當金鑰，所以改密碼＝所有人重新登入。 */

const COOKIE = "itc_admin";
const MAX_AGE = 60 * 60 * 12; // 12 小時

function b64url(bytes) {
  let str = "";
  new Uint8Array(bytes).forEach((b) => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

/** 產生 Cookie 用的憑證：<到期時間>.<簽章> */
export async function makeToken(secret) {
  const expiry = String(Date.now() + MAX_AGE * 1000);
  return expiry + "." + (await sign(expiry, secret));
}

export function cookieHeader(token) {
  return `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

async function validCookie(request, secret) {
  const raw = request.headers.get("cookie") || "";
  const hit = raw.split(/;\s*/).map((c) => c.split("=")).find((p) => p[0] === COOKIE);
  if (!hit || !hit[1]) return false;

  const [expiry, mac] = decodeURIComponent(hit[1]).split(".");
  if (!expiry || !mac) return false;
  if (Number(expiry) < Date.now()) return false;

  // 逐字元比較，避免用 === 比較字串時的時間差
  const expect = await sign(expiry, secret);
  if (expect.length !== mac.length) return false;
  let diff = 0;
  for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ mac.charCodeAt(i);
  return diff === 0;
}

export async function onRequest(context) {
  const { request, env, next, data } = context;
  const path = new URL(request.url).pathname;

  // 登入端點本身不能被擋住，否則沒人進得來
  if (path.endsWith("/login") || path.endsWith("/logout")) return next();

  if (request.headers.get("cf-access-jwt-assertion")) {
    data.auth = "access";
    return next();
  }

  const secret = env.ADMIN_PASSWORD;
  if (!secret) {
    // 尚未設定任何保護 —— 放行，但讓編輯頁知道要顯示警告
    data.auth = "none";
    return next();
  }

  if (await validCookie(request, secret)) {
    data.auth = "password";
    return next();
  }

  return new Response(JSON.stringify({ error: "尚未登入", needLogin: true }), {
    status: 401,
    headers: { "content-type": "application/json;charset=UTF-8" },
  });
}
