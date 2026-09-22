  兩封詢價信都改走 Resend（業務通知信 + 客戶自動回覆）
============================================================

改了什麼
------------------------------------------------------------
業務的通知信原本走 Google Apps Script（MailApp 寄信 + 寫進 Google
Sheet），現在跟客戶自動回覆一樣走 Resend。Apps Script 整個不再使用。

  業務通知信   寄件人 inquiry@inteplasttw.com.tw
               收件人＝後台「公司資訊」的聯絡信箱（副本＝email_cc）
               回覆地址＝客戶信箱，按回覆就是回客戶
               信裡有客戶填的內容、送出時間、紀錄編號，
               以及一顆「到後台『客戶詢價』查看」的按鈕

  客戶自動回覆 寄件人 noreply@inteplasttw.com.tw（沒有改動）

兩封各自送、各自記 log：任一封失敗都不影響另一封，也不影響資料寫入。


要上傳的檔案（2 個）
------------------------------------------------------------
functions/api/_mail.js        ← 覆蓋（多了 salesNotify）
functions/api/inquiry.js      ← 覆蓋（移除 Apps Script 呼叫）

可以刪掉的：apps-script/inquiry-mailer.gs（留著也不會被呼叫）


環境變數
------------------------------------------------------------
RESEND_API_KEY     必要，已經設好
MAIL_FROM_NOTIFY   選填，業務通知信寄件人，預設 inquiry@inteplasttw.com.tw
MAIL_FROM          選填，客戶自動回覆寄件人，預設 noreply@inteplasttw.com.tw
MAIL_TO            選填，後台聯絡信箱是空的時候的備援收件人
ADMIN_URL          選填，通知信裡的後台連結，預設 https://inteplasttw.com.tw/admin/
GAS_URL            已不使用，可以從 Pages 設定刪掉

※ inquiry@ 不需要真的收信 —— 只要網域 inteplasttw.com.tw 在 Resend
  驗證過，任何 @inteplasttw.com.tw 的位址都可以當寄件人。
  但業務按「回覆」時回的是客戶信箱（reply_to），不是 inquiry@。


上線前要注意的三件事
------------------------------------------------------------
1) Google Sheet 的紀錄從此不再新增
   舊資料還在那張表裡，之後的詢價只會在後台「客戶詢價」。

2) 業務信匣裡的寄件人變了
   從原本部署腳本的 Gmail 帳號變成 inquiry@inteplasttw.com.tw。
   如果他們有設篩選規則或標籤，要請他們改條件；
   也先提醒看一下垃圾信匣（新寄件位址前幾天比較容易被歸過去）。

3) 額度變成一筆詢價 2 封
   Resend 免費版每天 100 封／每月 3,000 封 → 每天約 50 筆詢價。
   超過的話兩封都會寄不出去（資料仍會存進資料庫）。


怎麼測
------------------------------------------------------------
1) 後台「公司資訊」確認聯絡信箱（和副本）填的是對的
2) 開 inteplasttw.com.tw/contact，用自己的信箱填一筆送出
3) 業務信箱要收到通知信，寄件人 inquiry@，按回覆會回到你剛填的信箱
4) 你的信箱要收到自動回覆，寄件人 noreply@
5) 後台「客戶詢價」要有這筆，編號跟信裡的一致
6) 切成英文版再送一次，確認客戶那封是英文
7) Resend 後台 → Logs 可以看每一封的投遞狀態


沒收到信時的排查順序
------------------------------------------------------------
· Resend → Logs：有紀錄就是寄出去了，看 delivered 還是 bounced
· 沒有紀錄 → Cloudflare Pages → Deployments → Functions → Real-time logs
    [inquiry] 業務通知信失敗 <狀態碼> <內容>
    [inquiry] 客戶自動回覆失敗 <狀態碼> <內容>
    [inquiry] 沒有業務收件人：…   ← 後台聯絡信箱是空的
· 401 / 403 → API Key 沒設好，或沒設到 Production 環境
· 422 提到 domain not verified → Resend 的網域驗證還沒過
· 429 → 當天額度用完了

無論哪種失敗，客戶的資料都已經進資料庫、表單也顯示成功 ——
寄信是額外動作，不會讓客戶看到錯誤。
