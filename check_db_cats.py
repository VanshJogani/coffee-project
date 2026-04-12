import sqlite3
import os

db_path = os.path.join("backend", "coffee.db")
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Categories in database:")
cursor.execute("SELECT category, COUNT(*) FROM products GROUP BY category;")
for row in cursor.fetchall():
    print(f"{row[0]}: {row[1]}")

conn.close()
