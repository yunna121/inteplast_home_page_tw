import { json, fail } from "./_lib.js";

/* 客戶詢價接收端
   ------------------------------------------------------------
   POST /api/inquiry   （contact.html 的表單）

   只做一件事：把客戶留的資料寫進 D1 的 inquiries 表。
   不寄信 —— 業務到後台的「客戶詢價」看紀錄並主動聯繫。

   （原本這裡還會用 Microsoft Graph 寄通知信與自動回覆，
     已依需求移除。要恢復的話 git 歷史裡有完整實作。） */

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

    return json({ ok: true, saved: true, id: insert.meta && insert.meta.last_row_id });
  } catch (error) {
    return fail(error);
  }
}
