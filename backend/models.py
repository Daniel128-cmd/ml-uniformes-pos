import sqlite3
from datetime import datetime

DATABASE = "ml_pedidos.db"

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS institutions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT
        );
        
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT
        );
        
        CREATE TABLE IF NOT EXISTS receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_number TEXT NOT NULL,
            institution_id TEXT NOT NULL,
            client_name TEXT,
            client_phone TEXT,
            total_amount REAL NOT NULL DEFAULT 0.0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME,
            FOREIGN KEY (institution_id) REFERENCES institutions (id)
        );
        
        CREATE TABLE IF NOT EXISTS receipt_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            size_range TEXT NOT NULL,
            exact_size TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit_price REAL NOT NULL,
            FOREIGN KEY (receipt_id) REFERENCES receipts (id),
            FOREIGN KEY (product_id) REFERENCES products (id)
        );
    """)
    conn.commit()
    conn.close()

def get_connection():
    return sqlite3.connect(DATABASE)

if __name__ == "__main__":
    init_db()
    print("Base de datos SQLite inicializada exitosamente.")
