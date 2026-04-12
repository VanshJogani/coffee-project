import sqlite3
import os

db_path = os.path.join('backend', 'coffee.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("SELECT roaster, count(id) FROM products GROUP BY roaster ORDER BY roaster")
results = cur.fetchall()
print("All Roasters in DB:")
for r, c in results:
    print(f"  {r}: {c} products")
conn.close()
