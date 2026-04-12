import csv

with open("results/test_tulum/tulum_products_generic.csv", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for r in reader:
        print(f"NAME: {r['name']!r}")
        print(f"  PRICE: {r['price']}")
        print(f"  DESC: {r['description'][:80]!r}")
        print()
