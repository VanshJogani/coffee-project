import json
import os

json_path = "cleaned_coffee_products.json"
if not os.path.exists(json_path):
    print("JSON not found")
    exit(1)

with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

tea_keywords = ["tea", "chai", "matcha", "tisane"]
found = []
for item in data:
    name = (item.get("name") or item.get("Name") or "").lower()
    desc = (item.get("description") or item.get("Desc") or "").lower()
    if any(k in name for k in tea_keywords) or any(k in desc for k in tea_keywords):
        found.append(name)

print(f"Found {len(found)} products with 'tea' related keywords.")
for f in found[:20]:
    print(f"- {f}")
