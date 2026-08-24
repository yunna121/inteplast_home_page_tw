/* 產品資料檔（Excel 的快照）
   正式資料來源：src/data/products-data.xlsx（單一工作表「產品資料」）
   由 tools/products-excel.html 轉出，請勿手改。

   欄位：類型（分類／產品）｜分類｜產品名稱｜英文名稱｜產品敘述｜產品圖片｜已去背
   · 類型＝分類 的六列 → 首頁「六大核心產品」，顯示順序＝Excel 列順序，序號自動編
   · 類型＝產品 的列   → 各分類頁的產品項目
   · 產品圖片只寫檔名＝放在 src/product-img/；找不到時自動改試 src/ 根目錄
   · 已去背＝Y 時產品名會壓在照片上；N＝白底或實拍方框，文字自動退開 */
window.PRODUCT_DATA = [
 { "type": "分類", "cat": "清潔袋",     "name": "清潔袋系列",     "name_en": "CAN LINERS & TRASH BAGS",   "desc": "連捲、單張抽取與環保清潔袋，台塑原料自製吹膜。",        "img": "封面-清潔袋.png",           "cutout": "Y" },
 { "type": "分類", "cat": "拉繩袋",     "name": "拉繩袋系列",     "name_en": "DRAW-TAPE BAGS",            "desc": "一拉即束口，清潔袋與醫療感染袋兩條產線。",              "img": "封面-拉繩袋.png",           "cutout": "Y" },
 { "type": "分類", "cat": "蔬果袋",     "name": "蔬果袋 · 耐熱袋", "name_en": "HEAT-RESISTANT & PRODUCE",  "desc": "食品級原料，平裝、捲裝耐熱袋與蔬果袋。",                "img": "封面-蔬果袋.png",           "cutout": "Y" },
 { "type": "分類", "cat": "夾鏈袋",     "name": "夾鏈袋系列",     "name_en": "STORAGE & ZIPPER BAGS",     "desc": "密實袋、立體密實袋、冷凍袋與 00–12 號夾鏈袋。",         "img": "封面-夾鏈袋.png",           "cutout": "Y" },
 { "type": "分類", "cat": "其他類",     "name": "其他類",         "name_en": "SPECIALTY PRODUCTS",        "desc": "PE 手套與台塑遮蔽防塵膠帶。",                          "img": "ai_specialty.png",          "cutout": "N" },
 { "type": "分類", "cat": "Scale Sheet", "name": "Scale Sheet",   "name_en": "PATENTED POP-UP SHEET",     "desc": "集團專利抽取式包裝紙，一張接一張自動彈出。",            "img": "scale sheet.png",           "cutout": "N" },

 { "type": "產品", "cat": "清潔袋",     "name": "連捲清潔袋",       "name_en": "Coreless Roll Liners",      "desc": "實心捲取、平底封口，抽取不斷卷。",                      "img": "封面-清潔袋.png",           "cutout": "Y" },
 { "type": "產品", "cat": "清潔袋",     "name": "單張抽取清潔袋",   "name_en": "Interleaved Flat Bags",     "desc": "單張抽取式，適合商業場所快速換袋。",                    "img": "",                          "cutout": "" },
 { "type": "產品", "cat": "清潔袋",     "name": "環保清潔袋",       "name_en": "Eco Recycled Bags",        "desc": "通過環保標章審查，50% 再生塑膠原料。",                  "img": "封面-環保清潔袋.webp",      "cutout": "Y" },
 { "type": "產品", "cat": "拉繩袋",     "name": "拉繩清潔袋",       "name_en": "Drawtape Trash Bags",      "desc": "袋口拉繩一拉即封，經濟包與超量包規格。",                "img": "封面-拉繩袋.png",           "cutout": "Y" },
 { "type": "產品", "cat": "拉繩袋",     "name": "拉繩醫療袋",       "name_en": "Medical Drawtape Bags",    "desc": "高辨識度紅色拉繩，感染性廢棄物隔離用。",                "img": "封面-拉繩感染袋.png",       "cutout": "Y" },
 { "type": "產品", "cat": "拉繩袋",     "name": "環保拉繩清潔袋",   "name_en": "Eco Drawtape Bags",        "desc": "再生料拉繩清潔袋，本色與黑色可客製。",                  "img": "",                          "cutout": "" },
 { "type": "產品", "cat": "蔬果袋",     "name": "平裝耐熱袋",       "name_en": "Flat Heat-Resistant Bags", "desc": "食品級 PE 平裝耐熱袋，熱食分裝適用。",                  "img": "封面-平裝耐熱袋.webp",      "cutout": "Y" },
 { "type": "產品", "cat": "蔬果袋",     "name": "卷裝耐熱袋",       "name_en": "Roll Heat-Resistant Bags", "desc": "整卷包裝，抽取方便不斷卷。",                            "img": "formosa_heat_bag_real.png", "cutout": "N" },
 { "type": "產品", "cat": "蔬果袋",     "name": "蔬果袋",           "name_en": "Produce Bags",             "desc": "超市與傳統市場蔬果生鮮分裝。",                          "img": "封面-蔬果袋.png",           "cutout": "Y" },
 { "type": "產品", "cat": "夾鏈袋",     "name": "夾鏈袋",           "name_en": "Reclosable Zipper Bags",   "desc": "00 號至 12 號齊全，反覆開闔仍緊實。",                   "img": "封面-夾鏈袋.png",           "cutout": "Y" },
 { "type": "產品", "cat": "夾鏈袋",     "name": "密實袋",           "name_en": "Seal Top Bags",            "desc": "雙軌密封，隔絕空氣濕氣。",                              "img": "密食袋 大.webp",            "cutout": "Y" },
 { "type": "產品", "cat": "夾鏈袋",     "name": "立體密實袋",       "name_en": "Stand-Up Zipper Bags",     "desc": "可站立設計，分裝取用方便。",                            "img": "",                          "cutout": "" },
 { "type": "產品", "cat": "夾鏈袋",     "name": "冷凍袋",           "name_en": "Freezer Bags",             "desc": "冷凍保鮮，低溫不脆裂。",                                "img": "冷凍袋 大.webp",            "cutout": "Y" },
 { "type": "產品", "cat": "其他類",     "name": "手套",             "name_en": "PE Disposable Gloves",     "desc": "輕薄貼手，小中大三種尺寸。",                            "img": "封面-手套.webp",            "cutout": "Y" },
 { "type": "產品", "cat": "其他類",     "name": "台塑遮蔽防塵膠帶", "name_en": "Pre-taped Masking Film",   "desc": "550mm～3200mm 六種幅寬，裝潢施工遮蔽防塵。",            "img": "封面-台塑遮蔽防塵膠帶.png", "cutout": "Y" },
 { "type": "產品", "cat": "Scale Sheet", "name": "Scale Sheet",     "name_en": "Scale Sheet",              "desc": "集團專利抽取式包裝紙，一張接一張自動彈出。",            "img": "scale sheet.png",           "cutout": "N" }
];
