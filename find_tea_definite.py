import json
import os

json_path = "cleaned_coffee_products.json"
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

tea_keywords = ["tea", "chai", "matcha", "tisane", "cascara"]
found = []
for item in data:
    name = (item.get("name") or item.get("Name") or "").lower()
    if any(k in name for k in tea_keywords) and "coffee" not in name:
        found.append(name)

print(f"Found {len(found)} candidate tea products:")
for f in found[:50]:
    print(f"- {f}")
