import sqlite3
import os

db_path = os.path.join('backend', 'coffee.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("SELECT count(*) FROM products WHERE roaster='A B Coffee'")
count = cur.fetchone()[0]
print(f"A B Coffee: {count} products")
conn.close()
