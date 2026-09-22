import { json, fail } from "./_lib.js";
import { addrList, customerAck, pickLang, resendSend, salesNotify } from "./_mail.js";

/* 客戶詢價接收端
   ------------------------------------------------------------
   POST /api/inquiry   （contact.html 的表單）

   1. 把客戶留的資料寫進 D1 的 inquiries 表（一定會做）
   2. 透過 Resend 寄通知信給業務，寄件人 inquiry@，回覆地址＝客戶信箱
   3. 透過 Resend 寄一封「已收到」的自動回覆給客戶，寄件人 noreply@

   第 3 步是收件確認，實際回覆仍由業務主動聯繫。
   兩封信各自送、各自記 log：任一封失敗都不影響另一封，也不影響第 1 步。

   Google Apps Script 已經拿掉（原本業務那封走 MailApp，同時把資料寫進
   Google Sheet）。紀錄改以 D1ˊ後台「客戶詢價」為單一來源，GAS_URL 這個
   環境變數不再使用，可以從 Pages 設定裡刪掉。

   收件人不寫在程式裡：讀後台「公司資訊」的聯絡信箱（settings.email）
   和副本收件人（settings.email_cc），所以業務自己在後台就能改。

   環境變數（Pages → Settings → Variables and Secrets）：
     RESEND_API_KEY     Resend 的 API Key，設成 Secret（兩封信都靠它）
     MAIL_FROM          選填，客戶自動回覆的寄件人，預設 noreply@inteplasttw.com.tw
     MAIL_FROM_NOTIFY   選填，業務通知信的寄件人，預設 inquiry@inteplasttw.com.tw
     MAIL_TO            選填，後台沒填聯絡信箱時的備援收件人
     ADMIN_URL          選填，通知信裡的後台連結，預設 https://inteplasttw.com.tw/admin/

   沒設 RESEND_API_KEY 就只存資料庫、不寄信，表單不會因此失敗。 */

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
       信丟到背景繼續跑（waitUntil）。寄失敗只寫進 Pages 的即時記錄。 */
    if (env.RESEND_API_KEY) {
      /* 業務通知信的收件人跟後台走，不寫在程式裡也不寫在環境變數 ——
         業務換人或加一個副本，在後台改完下一筆詢價就生效。 */
      const conf = await env.DB.prepare(
        `SELECT key, value FROM settings WHERE key IN ('email', 'email_cc')`
      ).all().catch(() => null);
      const pick = (k) => {
        const hit = conf && conf.results && conf.results.filter(r => r.key === k)[0];
        return (hit && String(hit.value || "").trim()) || "";
      };

      const notifyTo = addrList(pick("email") || env.MAIL_TO || "");
      const notifyCc = addrList(pick("email_cc"));

      if (notifyTo.length) {
        const notice = salesNotify(row, id, env.ADMIN_URL);
        const sendNotice = resendSend(env, {
          to: notifyTo,
          cc: notifyCc,
          from: env.MAIL_FROM_NOTIFY || "inquiry@inteplasttw.com.tw",
          ...notice,
        }).then((r) => {
          if (!r.ok) console.error("[inquiry] 業務通知信失敗 " + r.status + " " + r.body);
        });
        if (context.waitUntil) context.waitUntil(sendNotice);
      } else {
        console.error("[inquiry] 沒有業務收件人：後台公司資訊的聯絡信箱是空的，也沒設 MAIL_TO");
      }

      /* 客戶自動回覆 —— 與上面業務那封各走各的，互不影響。 */
      const ack = customerAck(row, pickLang(row.lang));
      const sendAck = resendSend(env, { to: row.email, ...ack }).then((r) => {
        if (!r.ok) console.error("[inquiry] 客戶自動回覆失敗 " + r.status + " " + r.body);
      });
      if (context.waitUntil) context.waitUntil(sendAck);
    }

    return json({ ok: true, saved: true, id });
  } catch (error) {
    return fail(error);
  }
}
