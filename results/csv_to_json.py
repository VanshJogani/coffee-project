import csv
import json

input_file = "merged_coffee.csv"
output_file = "cleaned_coffee_products.json"

with open(input_file, "r", encoding="utf-8") as csv_file:
    reader = csv.DictReader(csv_file)
    data = list(reader)

with open(output_file, "w", encoding="utf-8") as json_file:
    json.dump(data, json_file, indent=2)

print(f"Converted {len(data)} rows to {output_file}")