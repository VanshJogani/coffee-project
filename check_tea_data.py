import sqlite3
import os

db_path = os.path.join("backend", "coffee.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- TEA DATA ---")
cursor.execute("SELECT DISTINCT roaster FROM products WHERE category = 'Tea' LIMIT 10;")
print("Roasters:", [r[0] for r in cursor.fetchall()])

cursor.execute("SELECT DISTINCT roastType FROM products WHERE category = 'Tea' LIMIT 10;")
print("Roast Types:", [r[0] for r in cursor.fetchall()])

cursor.execute("SELECT DISTINCT origin FROM products WHERE category = 'Tea' LIMIT 10;")
print("Origins:", [r[0] for r in cursor.fetchall()])

cursor.execute("SELECT name FROM products WHERE category = 'Tea' LIMIT 20;")
print("Sample Tea Names:", [r[0] for r in cursor.fetchall()])

conn.close()
