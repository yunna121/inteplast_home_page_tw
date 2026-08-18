import csv
import json
import os

def csv_to_json():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_file = os.path.join(base_dir, 'products.csv')
    json_file = os.path.join(base_dir, 'products.json')

    categories = []

    if not os.path.exists(csv_file):
        print(f"CSV file not found: {csv_file}")
        return

    with open(csv_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Parse Badges
            badges_raw = [b.strip() for b in row.get('badges', '').split(',') if b.strip()]
            badges = []
            for b in badges_raw:
                if '環保' in b or '高溫' in b or '冷凍' in b or '膠帶' in b:
                    badges.append({"text_tw": b, "text_en": b, "type": "eco"})
                elif '醫療' in b:
                    badges.append({"text_tw": b, "text_en": b, "type": "medical", "icon": "fa-solid fa-triangle-exclamation"})
                else:
                    badges.append({"text_tw": b, "text_en": b, "type": "default"})

            # Parse Quick Specs
            specs_raw = row.get('quick_specs', '').split(';')
            quick_specs = []
            for s in specs_raw:
                if ':' in s:
                    parts = s.split(':')
                    quick_specs.append({"size": parts[0].strip(), "dim": parts[1].strip()})

            cat_item = {
                "id": row.get('id', '').strip(),
                "code": row.get('code', '').strip(),
                "title_tw": row.get('title_tw', '').strip(),
                "title_en": row.get('title_en', '').strip(),
                "image": row.get('image', '').strip(),
                "badges": badges,
                "highlights_tw": row.get('highlights_tw', '').strip(),
                "highlights_en": row.get('highlights_tw', '').strip(),
                "desc_tw": row.get('desc_tw', '').strip(),
                "desc_en": row.get('desc_tw', '').strip(),
                "page_url": row.get('page_url', '').strip(),
                "sub_products": [],
                "quick_specs": quick_specs
            }
            categories.append(cat_item)

    data = {"categories": categories}
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Successfully converted {len(categories)} categories from products.csv to products.json!")

if __name__ == '__main__':
    csv_to_json()
