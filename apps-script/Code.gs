/**
 * 臺灣營德官網「留下聯絡資料」接收端
 * 功能：把 contact.html 表單寫進 Google Sheet + 寄出通知信，並回傳 JSON 讓前端能分辨成功／失敗
 *
 * 部署步驟
 * 1. 開一個新的 Google Sheet，複製網址中的 ID 貼到下面 SHEET_ID（留空＝寫進本程式所屬的 Sheet）
 * 2. 在該 Sheet 選 擴充功能 → Apps Script，把本檔內容整份貼上
 * 3. 部署 → 新增部署作業 → 類型「網頁應用程式」
 *    - 執行身分：我
 *    - 具有存取權的使用者：所有人
 * 4. 複製產生的 /exec 網址，貼到 contact.html 的 GAS_ENDPOINT_URL（改完要重新上傳 contact.html）
 * 5. 測試：直接用瀏覽器開 /exec 網址，看到 {"ok":true,"alive":true} 就是活著
 * 注意：每次改完程式碼要「管理部署作業 → 編輯 → 新版本」才會生效
 */

const SHEET_ID = '';                                 // 空白＝寫進本 Apps Script 所屬的 Sheet
const SHEET_NAME = '聯絡表單';
const NOTIFY_TO = 'lyanchen@wpjk.inteplast.com';     // 收通知信的信箱，多個用逗號分隔
const SEND_AUTO_REPLY = true;                        // 是否自動回覆填表人
const HEADERS = ['送出時間', '公司名稱', '商務信箱', '聯絡電話', '詢問產品類別', '需求內容'];

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};

    // 蜜罐：真人不會填 website，這裡直接假裝成功，不寫入也不寄信
    if (p.website) {
      return json_({ ok: true, skipped: 'honeypot' });
    }
    if (!p.email || !p.message) {
      return json_({ ok: false, error: 'missing required fields' });
    }

    getSheet_().appendRow([
      new Date(),
      p.company || '',
      p.email || '',
      p.phone || '',
      p.product || '',
      p.message || ''
    ]);

    // 寄信失敗（例如超出每日配額）不影響資料已存進 Sheet，另外回報
    const mail = { notify: false, reply: false, error: null };
    try {
      sendNotifyMail_(p);
      mail.notify = true;
      if (SEND_AUTO_REPLY && p.email) {
        sendAutoReply_(p);
        mail.reply = true;
      }
    } catch (mailErr) {
      mail.error = String(mailErr);
    }

    return json_({ ok: true, saved: true, mail: mail });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** 用瀏覽器直接開 /exec 可確認服務是否活著 */
function doGet() {
  return json_({ ok: true, alive: true });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sendNotifyMail_(p) {
  if (!NOTIFY_TO) return;
  MailApp.sendEmail({
    to: NOTIFY_TO,
    subject: '【官網詢價】' + (p.company || '未填公司') + ' · ' + (p.product || '未選類別'),
    body:
      '官網「留下聯絡資料」新進一筆：\n\n' +
      '公司名稱：' + (p.company || '-') + '\n' +
      '商務信箱：' + (p.email || '-') + '\n' +
      '聯絡電話：' + (p.phone || '-') + '\n' +
      '產品類別：' + (p.product || '-') + '\n' +
      '需求內容：\n' + (p.message || '-') + '\n\n' +
      '送出時間：' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm') + '\n',
    replyTo: p.email || undefined
  });
}

function sendAutoReply_(p) {
  MailApp.sendEmail({
    to: p.email,
    subject: '臺灣營德股份有限公司｜已收到您的聯絡資料',
    body:
      (p.company || '您好') + '，您好：\n\n' +
      '我們已收到您在官網留下的聯絡資料，將由專人於工作日內與您聯繫。\n\n' +
      '您填寫的內容：\n' +
      '產品類別：' + (p.product || '-') + '\n' +
      '需求內容：' + (p.message || '-') + '\n\n' +
      '臺灣營德股份有限公司 Inteplast Taiwan Corporation\n' +
      '電話 02-2712-2211 #8109\n'
  });
}
