import { json, fail } from "./_lib.js";

/* 客戶詢價接收端
   ------------------------------------------------------------
   POST /api/inquiry   （contact.html 的表單）

   1. 把客戶留的資料寫進 D1 的 inquiries 表（一定會做）
   2. 透過 Google Apps Script 寄一封通知信給業務（做不到也不影響第 1 步）

   不回覆客戶 —— 由業務主動聯繫。

   為什麼繞一圈走 Apps Script：Cloudflare Workers 沒有 SMTP，不能自己寄信。
   Apps Script 用公司現有的 Gmail 帳號代寄，不用驗證網域也不用第三方服務。

   收件人不寫在程式裡：讀後台「公司資訊」的聯絡信箱（settings.email）
   和副本收件人（settings.email_cc），所以業務自己在後台就能改。

   需要的環境變數（Pages → 設定 → 環境變數）：
     GAS_URL      Apps Script 部署後的 .../exec 網址

   沒設就只存資料庫、不寄信，表單不會因此失敗。 */

function cap(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function looksLikeEmail(value) {
  return /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(value);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ error: "只接受 POST" }, 405);

  try {
    /* 表單可能以 FormData 或 JSON 送來，兩種都收 */
    let input = {};
    const type = request.headers.get("content-type") || "";
    if (type.indexOf("application/json") > -1) {
      input = await request.json();
    } else {
      const form = await request.formData();
      form.forEach((value, key) => { input[key] = value; });
    }

    // 蜜罐：真人看不到 website 這一欄，機器人一填就當作已處理但不寄出
    if (cap(input.website, 200)) return json({ ok: true, skipped: "honeypot" });

    const row = {
      company: cap(input.company, 120),
      email: cap(input.email, 160),
      phone: cap(input.phone, 60),
      product: cap(input.product, 120),
      message: cap(input.message, 4000),
      lang: cap(input.lang || request.headers.get("accept-language"), 12),
      page: cap(input.page, 200),
    };

    if (!row.email || !row.message) return json({ error: "請填寫商務信箱與需求內容" }, 400);
    if (!looksLikeEmail(row.email)) return json({ error: "商務信箱格式不正確" }, 400);

    const insert = await env.DB.prepare(
      `INSERT INTO inquiries (company, email, phone, product, message, lang, page)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(row.company, row.email, row.phone, row.product, row.message, row.lang, row.page).run();

    const id = insert.meta && insert.meta.last_row_id;

    /* 寄信不能讓客戶等 —— 資料已經進資料庫，表單立刻回覆、
       通知信丟到背景繼續跑（waitUntil）。
       這樣即使 Apps Script 慢、掛掉、或被改成要登入，客戶那邊也不會卡住。 */
    const gasUrl = env.GAS_URL;
    if (gasUrl) {
      /* 收件人跟後台走，不寫在程式裡也不寫在環境變數 ——
         業務換人或加一個副本，在後台改完下一筆詢價就生效。 */
      const conf = await env.DB.prepare(
        `SELECT key, value FROM settings WHERE key IN ('email', 'email_cc')`
      ).all().catch(() => null);
      const pick = (k) => {
        const hit = conf && conf.results && conf.results.filter(r => r.key === k)[0];
        return (hit && String(hit.value || "").trim()) || "";
      };

      const body = new URLSearchParams({
        company: row.company,
        email: row.email,
        phone: row.phone,
        product: row.product,
        message: row.message,
      });
      const notifyTo = pick("email") || env.MAIL_TO || "";
      const notifyCc = pick("email_cc");
      if (notifyTo) body.set("notifyTo", notifyTo);
      if (notifyCc) body.set("notifyCc", notifyCc);

      /* Apps Script 的 doPost 讀 e.parameter，只接表單編碼（JSON 收不到）。
         notifyTo 帶後台設的公司信箱，腳本端有網域白名單把關。 */
      const send = fetch(gasUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      }).catch(() => null);

      if (context.waitUntil) context.waitUntil(send);
    }

    return json({ ok: true, saved: true, id });
  } catch (error) {
    return fail(error);
  }
}
