import firebase_admin
from firebase_admin import credentials, firestore
import firestore_reports

cred = credentials.Certificate(r'c:\Users\Dani\Desktop\ML PEDIDOS\mlpuntodeventa-firebase-adminsdk-fbsvc-e4e8139627.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

print("Generating sales report...")
path = firestore_reports.generate_sales_report(db)
print(f"Sales report generated at: {path}")

print("Generating hoja de ruta...")
path2 = firestore_reports.generate_hoja_ruta(db)
print(f"Hoja de ruta generated at: {path2}")

print("All reports generated successfully!")
