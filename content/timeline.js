/* ============================================================
   關於我們 — 公司時間軸（唯一資料來源）
   ------------------------------------------------------------
   about.html 的「臺灣營德的製造歷程」整段由這個檔案產生，
   網頁裡不再寫死任何一筆年份或文字。

   要新增／修改／刪除一筆里程碑，只要改這裡的 items 清單：
     year      年份，顯示在左側（要換行就用 \n，例如 '1990s\n–2000s'）
     title_tw  標題（中文）      title_en  標題（英文）
     desc_tw   說明（中文）      desc_en   說明（英文）
     future    true = 未來展望樣式（藍框卡片，目前用在 2026）

   順序＝這裡的排列順序。存檔重新整理網頁即可看到結果。

   不想改程式碼的話：用 tools/timeline-excel.html 下載 Excel（content/timeline.xlsx）
   改完再拖回該工具，轉出新的 timeline.js 覆蓋這支即可。
   ============================================================ */
window.TIMELINE = {
  items: [
    {
      year: '1983',
      title_tw: '台塑塑膠加工組，於前鎮廠起步',
      title_en: 'Formosa Plastics processing group begins at Qianzhen',
      desc_tw: '高雄前鎮廠開始生產購物袋，開啟袋品製造歷程。',
      desc_en: 'The Kaohsiung Qianzhen plant began producing shopping bags, starting its bag manufacturing history.'
    },
    {
      year: '1984',
      title_tw: '市場袋加入產品線',
      title_en: 'Produce bags join the product line',
      desc_tw: '前鎮廠開始生產市場袋，產品線逐步擴展。',
      desc_en: 'The Qianzhen plant began producing produce bags, gradually expanding the product line.'
    },
    {
      year: '1989',
      title_tw: '新港廠整地擴建',
      title_en: 'Xingang plant expansion',
      desc_tw: '建立後續聚乙烯薄膜與袋品生產基地。',
      desc_en: 'Foundation laid for polyethylene film and bag production.'
    },
    {
      year: '1991',
      title_tw: '新港廠正式投產',
      title_en: 'Xingang plant begins production',
      desc_tw: '啟用全自動拌料輸送系統，生產購物袋與清潔袋等產品。',
      desc_en: 'An automated mixing and conveying system was introduced for shopping and refuse bag production.'
    },
    {
      year: '1998',
      title_tw: '引進附拉繩清潔袋設備',
      title_en: 'Draw-tape bag equipment introduced',
      desc_tw: '由歐美引進新型設備，回應國內環保需求。',
      desc_en: 'New equipment was introduced from Europe and the United States to meet domestic environmental needs.'
    },
    {
      year: '1990s\n–2000s',
      title_tw: '跨海技術合作，建立長期默契',
      title_en: 'Cross-Pacific technical collaboration',
      desc_tw: '隨著美國 INTEPLAST 擴建製造能力，新港廠技術人員曾赴美支援現場導入與技術交流。這段跨國協作，讓雙方在塑膠加工、設備運作與製造管理上累積共同經驗，也為後續更深度的合作建立基礎。',
      desc_en: 'As INTEPLAST expanded its manufacturing capability in the United States, technical personnel from Xingang supported on-site implementation and knowledge exchange. The collaboration built shared experience in plastics processing, equipment operations, and manufacturing management.'
    },
    {
      year: '2004',
      title_tw: '高雄前鎮廠遷廠合併',
      title_en: 'Kaohsiung Qianzhen plant consolidated',
      desc_tw: '整合市場袋生產，擴大新港生產配置。',
      desc_en: 'Produce-bag production was consolidated into Xingang.'
    },
    {
      year: '2008',
      title_tw: '全球產品配置重整',
      title_en: 'Global production realignment',
      desc_tw: '購物袋移往越南廠生產，新港聚焦清潔袋、附拉繩清潔袋及市場袋。',
      desc_en: 'Shopping bags moved to Vietnam while Xingang focused on refuse, draw-tape and produce bags.'
    },
    {
      year: '2014',
      title_tw: '塑膠加工組獨立，臺灣營德正式成立',
      title_en: 'Processing group becomes INTEPLAST TAIWAN',
      desc_tw: '台塑塑膠加工組獨立成立臺灣營德股份有限公司，延續製造根基，並持續作為台塑相關企業的一員。',
      desc_en: 'The Formosa Plastics processing group became INTEPLAST TAIWAN CORPORATION, continuing its manufacturing foundation as part of the Formosa Plastics affiliated enterprise network.'
    },
    {
      year: '2017',
      title_tw: '投入研發滑塊袋產品',
      title_en: 'Slider bag development begins',
      desc_tw: '延伸密封包裝產品技術，投入滑塊袋產品的研發與製程能力建置。',
      desc_en: 'Development began on slider bags, extending our resealable packaging capabilities and process expertise.'
    },
    {
      year: '2020',
      title_tw: '開發醫療用點滴外袋',
      title_en: 'Medical IV overwrap developed',
      desc_tw: '因應醫療用袋需求增加，完成點滴用外袋開發。',
      desc_en: 'In response to growing medical demand, IV overwrap production was developed.'
    },
    {
      year: '2026',
      future: true,
      title_tw: '把製造能力，推向下一個可能',
      title_en: 'Advancing manufacturing for what comes next',
      desc_tw: '持續深化功能性薄膜、醫療包裝與永續產品，讓新港基地以更靈活的技術與更穩定的品質，服務下一階段的市場需求。',
      desc_en: 'We are advancing functional films, medical packaging, and sustainable products—bringing more agile technology and dependable quality to the market needs ahead.'
    }
  ]
};
