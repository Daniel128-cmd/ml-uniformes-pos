import firebase_admin
from firebase_admin import credentials, firestore

# Misión: Purga de Datos de Prueba para Producción
# Este script elimina todos los registros de prueba (recibos, ítems, pagos) 
# y reinicia los contadores de las instituciones a 0 para que el próximo recibo sea el N° 1.

def purge_database():
    print("Iniciando purga de datos de prueba...")
    
    # Inicializar la app de Firebase usando las credenciales locales
    # (Asume que el service account JSON está configurado en el entorno)
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(r"c:\Users\Dani\Desktop\ML PEDIDOS\mlpuntodeventa-firebase-adminsdk-fbsvc-e4e8139627.json")
            firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f"Error inicializando Firebase: {e}")
        return

    db = firestore.client()
    
    # --- 1. Borrar todas las subcolecciones (items y payments) y luego los receipts ---
    receipts_ref = db.collection('receipts')
    receipts = receipts_ref.stream()
    
    deleted_count = 0
    for receipt in receipts:
        # Borrar subcolección 'items'
        items = receipt.reference.collection('items').stream()
        for item in items:
            item.reference.delete()
            
        # Borrar subcolección 'payments'
        payments = receipt.reference.collection('payments').stream()
        for payment in payments:
            payment.reference.delete()
            
        # Borrar el documento principal 'receipt'
        receipt.reference.delete()
        deleted_count += 1
        
    print(f"✓ Se eliminaron {deleted_count} recibos (y sus respectivos ítems y abonos).")

    # --- 2. Reiniciar contadores ---
    counters_ref = db.collection('counters')
    counters = counters_ref.stream()
    
    reset_count = 0
    for counter in counters:
        counter.reference.update({
            'current_receipt_number': 0
        })
        reset_count += 1
        
    print(f"✓ Se reiniciaron {reset_count} contadores a cero.")
    print("\n¡Purga completada! La base de datos está limpia y lista para producción.")

if __name__ == "__main__":
    purge_database()
