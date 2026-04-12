import sqlite3
import os

db_path = os.path.join('backend', 'coffee.db')
if not os.path.exists(db_path):
    print(f"Error: Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cur = conn.cursor()
targets = ('Alchemist', 'Ainmane', 'A B Coffee', 'Araku')
cur.execute(f"SELECT roaster, count(id) FROM products WHERE roaster IN {targets} GROUP BY roaster")
results = cur.fetchall()
print("Roaster verification:")
for r, c in results:
    print(f"  {r}: {c} products")
conn.close()
