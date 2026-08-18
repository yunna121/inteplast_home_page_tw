import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
import os

def create_formatted_excel():
    wb = openpyxl.Workbook()

    # Define Styles
    header_fill = PatternFill(start_color="0A2540", end_color="0A2540", fill_type="solid")
    header_font = Font(name="微軟正黑體", size=11, bold=True, color="FFFFFF")
    
    sub_header_fill = PatternFill(start_color="00529B", end_color="00529B", fill_type="solid")
    sub_header_font = Font(name="微軟正黑體", size=10, bold=True, color="FFFFFF")
    
    data_font = Font(name="微軟正黑體", size=10)
    bold_data_font = Font(name="微軟正黑體", size=10, bold=True)
    
    zebra_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # -------------------------------------------------------------
    # Sheet 1: 產品分類總表 (Categories Summary)
    # -------------------------------------------------------------
    ws1 = wb.active
    ws1.title = "產品分類總覽"
    ws1.views.sheetView[0].showGridLines = True

    headers1 = [
        "產品編號", "分類識別碼 (ID)", "產品中文名稱", "產品英文名稱", 
        "產品圖片檔名/路徑", "特色標籤 (多個請用逗號分隔)", "核心亮點與防護優勢", 
        "產品詳細介紹文案", "專頁檔案連結"
    ]

    ws1.append(headers1)
    for col_num, header in enumerate(headers1, 1):
        cell = ws1.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    rows1 = [
        [
            "001", "cat-can-liners", "清潔袋系列 (Can Liners)", "Can Liners & Trash Bags",
            "src/formosa_canliner_official.png", "連捲點斷, 單張抽取, 環保標章認證",
            "高強度防漏 · 商業機構與家用大容量",
            "包含連捲清潔袋、單張平裝抽取清潔袋與通過環保標章認證之 50% 再生塑膠環保清潔袋。選用台塑 PE 純料韌性極佳，底封堅固不易破裂滴漏。",
            "can-liners.html"
        ],
        [
            "002", "cat-draw-tape", "拉繩袋系列 (Draw-Tape Bags)", "Draw-Tape & Medical Bags",
            "src/Can-Liners-Draw-Tape-Draw-Tape-2.jpg", "一拉即束, 不髒手打包, 醫療隔離警示",
            "專利加長拉繩 · 輕鬆拎舉不黏手打包",
            "加長拉繩設計，雙手一拉自動提束包緊，打包過程衛生不髒手；並提供醫療等級高辨識度黃色與紅色傳染廢棄物隔離袋。",
            "draw-tape.html"
        ],
        [
            "003", "cat-heat-bags", "耐熱袋系列 (Heat-Resistant Bags)", "Foodservice Heat-Resistant Bags",
            "src/formosa_heat_bag_official.png", "食品級 PE, 平裝 / 捲裝, 高溫耐受",
            "嚴選台塑食品級原料 · 絕無塑化劑添加",
            "平裝與捲裝耐熱袋，適用於生鮮備料、小吃餐飲熱食分裝與高溫熱湯打包。通過國家食安標準審查，品質安全無虞。",
            "foodservice.html"
        ],
        [
            "004", "cat-zipper-bags", "密封包裝類 (Sealed & Zipper Bags)", "Sealed & Zipper Storage Bags",
            "src/ai_zipper_bag.png", "雙軌密實, 立體站立, 冷凍保鮮",
            "嚴密隔絕空氣濕氣 · 食材長效保鮮",
            "提供雙軌密封密實袋、立體可站立密實袋、冷凍保鮮袋與通用夾鏈袋，滿足家用廚房食材分裝與商業食品儲存鎖鮮需求。",
            "foodservice.html"
        ],
        [
            "005", "cat-specialty", "其他類 (Specialty Protection & Tapes)", "Specialty Protection & Tapes",
            "src/ai_specialty.png", "手套, 台塑遮蔽防塵膠帶",
            "專業個人防護與建築施工/裝潢養生防塵",
            "包含輕薄貼手防護手套，以及 550mm~3200mm 多種規格之台塑專利遮蔽防塵膠帶，適合建築施工、室內裝潢養生與日常防塵防護。",
            "specialty.html"
        ],
        [
            "006", "cat-scale-sheet", "Scale Sheet", "Scale Sheet",
            "src/scale sheet.png", "", "", "", "stretch-films.html"
        ]
    ]

    for row_idx, row_data in enumerate(rows1, 2):
        ws1.append(row_data)
        fill = zebra_fill if row_idx % 2 == 0 else white_fill
        for col_idx in range(1, len(row_data) + 1):
            cell = ws1.cell(row=row_idx, column=col_idx)
            cell.fill = fill
            cell.font = data_font
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")
            if col_idx in [1, 2, 9]:
                cell.alignment = Alignment(horizontal="center", vertical="center")

    # -------------------------------------------------------------
    # Sheet 2: 產品容量與尺寸規格對照表 (Detailed Specifications)
    # -------------------------------------------------------------
    ws2 = wb.create_sheet(title="容量尺寸規格對照表")
    ws2.views.sheetView[0].showGridLines = True

    headers2 = [
        "產品編號", "所屬產品系列", "規格 / 容量 / 號數", "尺寸 (寬 × 長 cm / mm)", "包裝方式 / 適用說明", "備註"
    ]

    ws2.append(headers2)
    for col_num, header in enumerate(headers2, 1):
        cell = ws2.cell(row=1, column=col_num)
        cell.fill = sub_header_fill
        cell.font = sub_header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    rows2 = [
        # 清潔袋
        ["001", "清潔袋系列", "15L 小", "45 × 50 cm", "連捲點斷 / 單張平裝", "家用廚房/小垃圾桶"],
        ["001", "清潔袋系列", "20L 中", "50 × 60 cm", "連捲點斷 / 單張平裝", "辦公室/通用型"],
        ["001", "清潔袋系列", "45L 大", "65 × 75 cm", "連捲點斷 / 熱銷推薦", "標準商業機構/家庭大容量"],
        ["001", "清潔袋系列", "70L 特大", "75 × 90 cm", "商業機構 / 工業加厚", "餐廳/飯店/大型機構"],
        ["001", "清潔袋系列", "90L 超大", "85 × 100 cm", "工業加厚 / 防漏", "工廠/戶外大型垃圾桶"],
        ["001", "清潔袋系列", "125L 巨無霸", "94 × 110 cm", "超大容積 / 重量級", "大型環境清潔/環保袋"],

        # 拉繩袋
        ["002", "拉繩袋系列", "13 Gallon", "60.9 × 68.5 cm", "一拉即束 / 經濟包", "美式標準高容積"],
        ["002", "拉繩袋系列", "30 Gallon", "76.2 × 91.4 cm", "一拉即束 / 超量包", "大型清潔/商業提打包"],
        ["002", "拉繩袋系列", "醫療黃/紅色", "依需求客製印製", "高辨識度警示印製", "醫療廢棄物隔離專用"],

        # 耐熱袋
        ["003", "耐熱袋系列", "半斤", "15.2 × 22.8 cm", "平裝 / 捲裝", "小吃/醬料/生鮮分裝"],
        ["003", "耐熱袋系列", "1斤", "20.3 × 27.9 cm", "平裝 / 捲裝", "餐飲熱食打包"],
        ["003", "耐熱袋系列", "2斤", "25.4 × 35.5 cm", "平裝 / 捲裝", "外帶熱湯/生鮮肉品"],
        ["003", "耐熱袋系列", "3斤", "30.4 × 43.1 cm", "平裝 / 捲裝", "大份量熱食打包"],
        ["003", "耐熱袋系列", "5斤", "35.5 × 50.8 cm", "平裝 / 捲裝", "商業備料/高溫高壓打包"],

        # 密封包裝
        ["004", "密封包裝類", "1號 ~ 4號", "小型尺寸", "雙軌密封 / 夾鏈袋", "飾品/藥品/零組件分裝"],
        ["004", "密封包裝類", "5號 ~ 8號", "中型尺寸", "立體站立 / 冷凍保鮮", "食材/蔬果/冷凍食品"],
        ["004", "密封包裝類", "9號 ~ 12號", "大型尺寸", "雙軌密封 / 超大包裝", "大份量肉品/物品整理"],

        # 其他類
        ["005", "其他類", "手套", "通用尺寸", "輕薄貼手防護手套", "餐飲衛生/個人防護"],
        ["005", "其他類", "防塵膠帶 550mm", "550 mm × 25 y (22.8m)", "台塑專利遮蔽膠帶", "建築工程/裝潢養生防塵"],
        ["005", "其他類", "防塵膠帶 1100mm", "1100 mm × 25 y (22.8m)", "台塑專利遮蔽膠帶", "建築工程/裝潢養生防塵"],
        ["005", "其他類", "防塵膠帶 1500mm", "1500 mm × 25 y (22.8m)", "台塑專利遮蔽膠帶", "建築工程/裝潢養生防塵"],
        ["005", "other", "防塵膠帶 2100mm", "2100 mm × 25 y (22.8m)", "台塑專利遮蔽膠帶", "建築工程/裝潢養生防塵"],
        ["005", "other", "防塵膠帶 2700mm", "2700 mm × 25 y (22.8m)", "台塑專利遮蔽膠帶", "建築工程/裝潢養生防塵"],
        ["005", "other", "防塵膠帶 3200mm", "3200 mm × 25 y (22.8m)", "台塑專利遮蔽膠帶", "建築工程/裝潢養生防塵"],

        # Scale Sheet
        ["006", "Scale Sheet", "Scale Sheet", "專案洽詢", "內容規劃中 / 專人對接", "如有需求請聯繫專員"]
    ]

    for row_idx, row_data in enumerate(rows2, 2):
        ws2.append(row_data)
        fill = zebra_fill if row_idx % 2 == 0 else white_fill
        for col_idx in range(1, len(row_data) + 1):
            cell = ws2.cell(row=row_idx, column=col_idx)
            cell.fill = fill
            cell.font = data_font
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")
            if col_idx in [1, 3, 4]:
                cell.alignment = Alignment(horizontal="center", vertical="center")

    # Auto-adjust column widths for both sheets
    for ws in [ws1, ws2]:
        ws.row_dimensions[1].height = 28
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val_str = str(cell.value or '')
                # Approximate width for Chinese characters
                cell_len = sum(2 if ord(c) > 127 else 1 for c in val_str)
                if cell_len > max_len:
                    max_len = cell_len
            ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

    output_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "臺灣營德_產品規格與資料庫.xlsx")
    wb.save(output_file)
    print(f"Successfully generated formatted Excel database: {output_file}")

if __name__ == "__main__":
    create_formatted_excel()
