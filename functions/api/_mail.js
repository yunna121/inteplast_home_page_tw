/* 客戶自動回覆信（Resend）
   ------------------------------------------------------------
   只負責一件事：寄一封「已收到您的詢價」給客戶，寄件人是
   noreply@inteplasttw.com.tw。實際回覆仍由業務主動聯繫。

   給業務的通知信不在這裡 —— 那個繼續走原本的 Google Apps Script，
   完全沒有改動。

   為什麼用 Resend：Cloudflare Workers 沒有 SMTP，不能自己寄信。
   Resend 是 HTTP API，免費方案每月 3,000 封／每天 100 封，
   驗證網域後寄件人就是 noreply@inteplasttw.com.tw。

   需要的環境變數（Pages → Settings → Variables and Secrets）：
     RESEND_API_KEY   Resend 後台建立的 API Key（設成 Secret）
     MAIL_FROM        選填，預設 noreply@inteplasttw.com.tw

   沒設 RESEND_API_KEY 時就不寄自動回覆，其他流程照常，
   所以可以先部署程式、之後再驗證網域，中間不會有空窗。 */

export const MAIL_FROM_NAME = '臺灣營德股份有限公司';

const CONTACT = {
  phone: '+886-2-2712-2211 #8109',
  addressTw: '台北市松山區敦化北路 205 號 6 樓 609 室',
  addressEn: '6F., No. 205, Dunhua N. Rd., Songshan Dist., Taipei City, Taiwan',
  site: 'https://inteplasttw.com.tw',
  hoursTw: '週一至週五 08:30–17:30（國定假日休息）',
  hoursEn: 'Mon–Fri 08:30–17:30 (GMT+8), closed on national holidays',
  hoursJa: '月曜日〜金曜日 8:00〜17:00（祝日休業）',
};

/* 三種語言的自動回覆。刻意不承諾具體回覆時間 ——
   要加「一個工作日內」就改 thanks 那一行。 */
const TEXTS = {
  'zh-TW': {
    subject: '已收到您的詢價 — 臺灣營德股份有限公司',
    greeting: '您好，',
    thanks: '感謝您與臺灣營德聯繫。我們已收到您的詢價，專人將盡快與您聯繫。',
    recap: '以下是您送出的內容：',
    fields: { company: '公司名稱', email: '商務信箱', phone: '聯絡電話', product: '詢問產品', message: '需求內容' },
    closing: '此信件由系統自動發送，請勿直接回覆。若需補充資料，請來電或再次填寫網站表單。',
    hoursLabel: '服務時間',
  },
  en: {
    subject: 'We have received your inquiry — INTEPLAST TAIWAN CORPORATION',
    greeting: 'Hello,',
    thanks: 'Thank you for contacting INTEPLAST TAIWAN CORPORATION. We have received your inquiry and a member of our team will be in touch shortly.',
    recap: 'Here is a copy of what you submitted:',
    fields: { company: 'Company', email: 'Business email', phone: 'Phone', product: 'Product of interest', message: 'Message' },
    closing: 'This message was sent automatically — please do not reply to this address. To add information, call us or submit the form again.',
    hoursLabel: 'Office hours',
  },
  ja: {
    subject: 'お問い合わせを受け付けました — INTEPLAST TAIWAN CORPORATION',
    greeting: 'お世話になっております。',
    thanks: 'この度はお問い合わせいただき、誠にありがとうございます。内容を確認のうえ、担当者より順次ご連絡いたします。',
    recap: 'ご送信いただいた内容は以下のとおりです。',
    fields: { company: '会社名', email: 'メールアドレス', phone: 'お電話番号', product: 'ご興味のある製品', message: 'お問い合わせ内容' },
    closing: 'このメールは自動送信です。ご返信いただいてもお答えできません。追加のご連絡はお電話または再度フォームよりお願いいたします。',
    hoursLabel: '営業時間',
  },
};

/* 前端送來的 lang（zh-TW / tw / en-US / ja…）都吃，認不出來用繁中 */
export function pickLang(raw) {
  const v = String(raw || '').toLowerCase();
  if (v.startsWith('ja')) return 'ja';
  if (v.startsWith('en')) return 'en';
  return 'zh-TW';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function row(label, value) {
  if (!String(value || '').trim()) return '';
  return '<tr>'
    + `<td style="padding:8px 16px 8px 0;color:#64748B;font-size:14px;vertical-align:top;white-space:nowrap">${esc(label)}</td>`
    + `<td style="padding:8px 0;color:#1E293B;font-size:14px;vertical-align:top">${esc(value).replace(/\n/g, '<br>')}</td>`
    + '</tr>';
}

function shell(inner) {
  return '<div style="margin:0;padding:24px;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',\'Noto Sans TC\',sans-serif">'
    + '<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden">'
    + '<div style="padding:24px 28px;background:#0A2540">'
    + '<div style="color:#FFFFFF;font-size:17px;font-weight:700;letter-spacing:.5px">臺灣營德股份有限公司</div>'
    + '<div style="color:#8FB4D4;font-size:11px;font-weight:600;letter-spacing:1.5px;margin-top:4px">INTEPLAST TAIWAN CORPORATION</div>'
    + '</div>'
    + inner
    + '</div></div>';
}

/* 給客戶的自動回覆 */
export function customerAck(data, lang) {
  const t = TEXTS[lang] || TEXTS['zh-TW'];
  const address = lang === 'zh-TW' ? CONTACT.addressTw : CONTACT.addressEn;
  const hours = lang === 'ja' ? CONTACT.hoursJa : (lang === 'en' ? CONTACT.hoursEn : CONTACT.hoursTw);
  const f = t.fields;

  const html = shell(''
    + '<div style="padding:28px">'
    + `<p style="margin:0 0 14px;color:#1E293B;font-size:15px">${esc(t.greeting)}</p>`
    + `<p style="margin:0 0 24px;color:#1E293B;font-size:15px;line-height:1.7">${esc(t.thanks)}</p>`
    + `<div style="margin:0 0 10px;color:#64748B;font-size:13px;font-weight:700">${esc(t.recap)}</div>`
    + '<table style="width:100%;border-collapse:collapse;border-top:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0">'
    + row(f.company, data.company) + row(f.email, data.email) + row(f.phone, data.phone)
    + row(f.product, data.product) + row(f.message, data.message)
    + '</table>'
    + `<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #E2E8F0;color:#64748B;font-size:12px;line-height:1.7">${esc(t.closing)}</p>`
    + '</div>'
    + '<div style="padding:20px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;color:#64748B;font-size:12px;line-height:1.8">'
    + `<div>${esc(address)}</div>`
    + `<div>Tel ${esc(CONTACT.phone)}</div>`
    + `<div>${esc(t.hoursLabel)}：${esc(hours)}</div>`
    + `<div style="margin-top:6px"><a href="${CONTACT.site}" style="color:#00529B;text-decoration:none">${CONTACT.site.replace('https://', '')}</a></div>`
    + '</div>');

  const lines = [t.greeting, '', t.thanks, '', t.recap];
  [[f.company, data.company], [f.email, data.email], [f.phone, data.phone],
   [f.product, data.product], [f.message, data.message]].forEach(([label, value]) => {
    if (String(value || '').trim()) lines.push(`${label}：${value}`);
  });
  lines.push('', t.closing, '', CONTACT.site);

  return { subject: t.subject, html, text: lines.join('\n') };
}

/* 送給 Resend。回傳 { ok, status, body } —— 呼叫端自己決定要不要在意結果。
   刻意不 throw：寄信失敗不應該讓客戶的表單顯示錯誤（資料已經進資料庫了）。 */
export async function resendSend(env, { to, subject, html, text }) {
  const key = env.RESEND_API_KEY;
  if (!key) return { ok: false, status: 0, body: 'RESEND_API_KEY 未設定' };

  const from = env.MAIL_FROM || 'noreply@inteplasttw.com.tw';

  const payload = {
    from: `${MAIL_FROM_NAME} <${from}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (error) {
    return { ok: false, status: 0, body: String(error) };
  }
}
