import { json, fail } from "./_lib.js";

/* 客戶詢價接收端
   ------------------------------------------------------------
   POST /api/inquiry   （contact.html 的表單）

   1. 把客戶留的資料寫進 D1 的 inquiries 表（一定會做）
   2. 用 Resend 寄一封通知信給業務（做不到也不影響第 1 步）

   不寄自動回覆給客戶 —— 由業務主動聯繫。

   需要的環境變數（Pages → 設定 → 環境變數）：
     RESEND_API_KEY   Resend 的 API 金鑰
     MAIL_TO          業務收件信箱，多人用逗號分隔
     MAIL_FROM        寄件者，必須是 Resend 已驗證的網域
                      例：inteplast.com.tw
     MAIL_BCC         選填，副本

   金鑰或收件人沒設就只存資料庫、不寄信，表單不會因此失敗。 */

function cap(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function looksLikeEmail(value) {
  return /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(value);
}

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function splitList(value) {
  return String(value || "").split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

/* 通知信內容：業務打開就能判斷要不要回、回什麼。
   欄位順序照業務實際在意的程度排，訊息放最後才不必上下捲。 */
function buildMail(row, id) {
  const when = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  const rows = [
    ["公司名稱", row.company || "（未填）"],
    ["商務信箱", row.email],
    ["聯絡電話", row.phone || "（未填）"],
    ["詢問產品", row.product || "（未選）"],
    ["來源頁面", row.page || "—"],
    ["送出時間", when],
  ].map(([k, v]) => (
    `<tr>` +
    `<td style="padding:7px 14px 7px 0;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td>` +
    `<td style="padding:7px 0;color:#0f172a;font-size:14px;font-weight:600">${esc(v)}</td>` +
    `</tr>`
  )).join("");

  const html =
    `<div style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif">` +
      `<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">` +
        `<div style="padding:18px 24px;background:#0f3a63;color:#ffffff">` +
          `<div style="font-size:15px;font-weight:700">網站詢價通知</div>` +
          `<div style="font-size:12px;opacity:.75;margin-top:2px">臺灣營德股份有限公司 · 編號 #${esc(id)}</div>` +
        `</div>` +
        `<div style="padding:22px 24px">` +
          `<table style="border-collapse:collapse;width:100%">${rows}</table>` +
          `<div style="margin-top:20px;padding-top:18px;border-top:1px solid #e2e8f0">` +
            `<div style="color:#64748b;font-size:13px;margin-bottom:7px">需求內容</div>` +
            `<div style="color:#0f172a;font-size:14px;line-height:1.7;white-space:pre-wrap">${esc(row.message)}</div>` +
          `</div>` +
          `<div style="margin-top:22px">` +
            `<a href="mailto:${esc(row.email)}" style="display:inline-block;padding:10px 20px;background:#0f3a63;color:#ffffff;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none">回覆客戶</a>` +
          `</div>` +
        `</div>` +
      `</div>` +
    `</div>`;

  const text = [
    `網站詢價通知 #${id}`, "",
    `公司名稱：${row.company || "（未填）"}`,
    `商務信箱：${row.email}`,
    `聯絡電話：${row.phone || "（未填）"}`,
    `詢問產品：${row.product || "（未選）"}`,
    `來源頁面：${row.page || "—"}`,
    `送出時間：${when}`, "",
    "需求內容：", row.message,
  ].join("\n");

  return { html, text };
}

async function notify(env, row, id) {
  const key = env.RESEND_API_KEY;
  const to = splitList(env.MAIL_TO);
  if (!key || !to.length) return { sent: false, reason: "未設定" };

  const mail = buildMail(row, id);
  const payload = {
    from: env.MAIL_FROM || "no-reply@inteplast.com.tw",
    to,
    subject: `[網站詢價] ${row.company || row.email}${row.product ? " · " + row.product : ""}`,
    html: mail.html,
    text: mail.text,
    /* 業務直接按「回覆」就是回給客戶，不用複製貼上信箱 */
    reply_to: row.email,
  };
  const bcc = splitList(env.MAIL_BCC);
  if (bcc.length) payload.bcc = bcc;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "authorization": `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { sent: false, reason: `resend ${res.status}` };
  return { sent: true };
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

    // 蜜罐：真人看不到 website 這一欄，機器人一填就當作已處理但不寫入
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

    /* 寄信失敗不能讓客戶看到錯誤 —— 資料已經進資料庫，
       業務照樣能在後台看到，通知只是加快反應速度。 */
    let mail = { sent: false, reason: "未執行" };
    try {
      mail = await notify(env, row, id);
    } catch (mailError) {
      mail = { sent: false, reason: String(mailError && mailError.message || mailError) };
    }

    return json({ ok: true, saved: true, id, mailed: mail.sent });
  } catch (error) {
    return fail(error);
  }
}
