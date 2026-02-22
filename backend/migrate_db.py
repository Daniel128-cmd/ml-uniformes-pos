import sqlite3

DATABASE = "ml_pedidos.db"

def migrate():
    print("Migrando: añadiendo columna delivery_date a receipts...")
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE receipts ADD COLUMN delivery_date TEXT")
        print(" -> Columna 'delivery_date' añadida.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print(" -> Columna 'delivery_date' ya existe, sin cambios.")
        else:
            raise
    conn.commit()
    conn.close()
    print("Migración completada.")

if __name__ == "__main__":
    migrate()
