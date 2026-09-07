import { json, fail } from "./_lib.js";

/* 客戶詢價接收端
   ------------------------------------------------------------
   POST /api/inquiry   （contact.html 的表單）

   做兩件事，順序刻意如此：
   1. 先寫進 D1 的 inquiries 表 —— 這一步成功就不會漏掉客戶
   2. 再用 Microsoft Graph 寄通知信與自動回覆

   寄信失敗不會讓整個請求失敗：資料已經存下來了，回傳
   mailed: false，前端會改用原本的 Apps Script 那條路寄信。
   所以「客戶資料遺失」這件事需要兩套系統同時壞掉才會發生。

   寄信需要的環境變數（Pages → 設定 → 變數與密鑰）：
     MS_TENANT_ID      Entra ID 的目錄 ID
     MS_CLIENT_ID      應用程式（用戶端）ID
     MS_CLIENT_SECRET  用戶端密碼 ← 設成 Secret，不要用純文字
     MS_SENDER         寄件信箱，例如 no-reply@wpjk.inteplast.com
   四個都沒設就只寫資料庫、不寄信。設定步驟見 README-microsoft.txt */

const GRAPH = "https://graph.microsoft.com/v1.0";

function cap(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function looksLikeEmail(value) {
  return /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(value);
}

function esc(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 取 Graph 的存取權杖（用戶端憑證流程，代表應用程式而非某個人） */
async function getToken(env) {
  const res = await fetch(`https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.MS_CLIENT_ID,
      client_secret: env.MS_CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error("取得 Microsoft 權杖失敗：" + (data.error_description || data.error || res.status));
  }
  return data.access_token;
}

async function sendMail(env, token, mail) {
  const res = await fetch(`${GRAPH}/users/${encodeURIComponent(env.MS_SENDER)}/sendMail`, {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify(mail),
  });
  if (res.status !== 202) {
    const text = await res.text();
    throw new Error("Graph 寄信失敗（" + res.status + "）：" + text.slice(0, 300));
  }
}

function notifyMail(to, cc, replyTo, row) {
  const rows = [
    ["公司名稱", row.company],
    ["商務信箱", row.email],
    ["聯絡電話", row.phone],
    ["產品類別", row.product],
  ]
    .map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#5f7182">${k}</td><td style="padding:6px 0"><b>${esc(v || "-")}</b></td></tr>`)
    .join("");

  return {
    message: {
      subject: `【官網詢價】${row.company || "未填公司"}・${row.product || "未選類別"}`,
      body: {
        contentType: "HTML",
        content: `<div style="font-family:'Noto Sans TC',sans-serif;color:#142638;line-height:1.7">
          <p style="font-size:15px">官網「留下聯絡資料」新進一筆：</p>
          <table style="border-collapse:collapse;font-size:14px">${rows}</table>
          <p style="margin-top:16px;font-size:14px"><b>需求內容</b><br>${esc(row.message).replace(/\n/g, "<br>")}</p>
          <p style="margin-top:18px;color:#5f7182;font-size:12px">送出頁面：${esc(row.page)}｜語言：${esc(row.lang)}</p>
        </div>`,
      },
      toRecipients: to.map((address) => ({ emailAddress: { address } })),
      ccRecipients: cc.map((address) => ({ emailAddress: { address } })),
      replyTo: replyTo ? [{ emailAddress: { address: replyTo } }] : undefined,
    },
    saveToSentItems: true,
  };
}

function autoReplyMail(row, settings) {
  const isEn = String(row.lang || "").toLowerCase().indexOf("en") === 0;
  const company = settings.company_name || "臺灣營德股份有限公司";
  const phone = settings.phone || "";

  const zh = `<div style="font-family:'Noto Sans TC',sans-serif;color:#142638;line-height:1.8">
      <p>${esc(row.company || "您好")}，您好：</p>
      <p>我們已收到您在官網留下的聯絡資料，將由專人於工作日內與您聯繫。</p>
      <p style="color:#5f7182;font-size:14px">您填寫的內容<br>產品類別：${esc(row.product || "-")}<br>需求內容：${esc(row.message || "-")}</p>
      <p style="margin-top:18px">${esc(company)}<br>${esc(phone)}</p>
    </div>`;

  const en = `<div style="font-family:sans-serif;color:#142638;line-height:1.8">
      <p>Dear ${esc(row.company || "Sir/Madam")},</p>
      <p>We have received your enquiry and a member of our team will be in touch within one business day.</p>
      <p style="color:#5f7182;font-size:14px">Product: ${esc(row.product || "-")}<br>Message: ${esc(row.message || "-")}</p>
      <p style="margin-top:18px">INTEPLAST TAIWAN CORPORATION<br>${esc(phone)}</p>
    </div>`;

  return {
    message: {
      subject: isEn
        ? "INTEPLAST TAIWAN｜We have received your enquiry"
        : `${company}｜已收到您的聯絡資料`,
      body: { contentType: "HTML", content: isEn ? en : zh },
      toRecipients: [{ emailAddress: { address: row.email } }],
    },
    saveToSentItems: false,
  };
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

    /* 先存資料庫 —— 這一步成功就不會漏掉客戶 */
    const insert = await env.DB.prepare(
      `INSERT INTO inquiries (company, email, phone, product, message, lang, page)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(row.company, row.email, row.phone, row.product, row.message, row.lang, row.page).run();

    const id = insert.meta && insert.meta.last_row_id;

    /* 再寄信。四個環境變數沒設齊就跳過，讓前端走 Apps Script 那條路 */
    const configured = env.MS_TENANT_ID && env.MS_CLIENT_ID && env.MS_CLIENT_SECRET && env.MS_SENDER;
    if (!configured) {
      return json({ ok: true, saved: true, id, mailed: false, reason: "尚未設定 Microsoft 寄信" });
    }

    try {
      const settingsRows = await env.DB.prepare("SELECT key, value FROM settings").all();
      const settings = {};
      (settingsRows.results || []).forEach((s) => { settings[s.key] = s.value; });

      const to = String(settings.email || env.MS_SENDER).split(",").map((s) => s.trim()).filter(Boolean);
      const cc = String(settings.email_cc || "").split(",").map((s) => s.trim()).filter(Boolean);

      const token = await getToken(env);
      await sendMail(env, token, notifyMail(to, cc, row.email, row));

      // 自動回覆失敗不算失敗：內部通知已經寄到了
      try {
        await sendMail(env, token, autoReplyMail(row, settings));
      } catch (err) { /* 略過 */ }

      if (id) await env.DB.prepare("UPDATE inquiries SET mailed = 1 WHERE id = ?").bind(id).run();

      return json({ ok: true, saved: true, id, mailed: true });
    } catch (err) {
      // 資料已存下來，只是信沒寄出 —— 明確告訴前端，讓它走備援
      return json({ ok: true, saved: true, id, mailed: false, reason: String(err.message || err) });
    }
  } catch (error) {
    return fail(error);
  }
}
