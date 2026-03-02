import firebase_admin
from firebase_admin import credentials, firestore, auth

cred = credentials.Certificate(r"c:\Users\Dani\Desktop\ML PEDIDOS\mlpuntodeventa-firebase-adminsdk-fbsvc-e4e8139627.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

admins_to_create = [
    {"user": "carlos", "pass": "carlosbermudez1"},
    {"user": "daniel", "pass": "danielmartinez1"},
    {"user": "mluniformes", "pass": "mluniformes1"},
]

print("Creando usuarios en Firebase Auth y Firestore Whitelist...")

for admin in admins_to_create:
    email = f"{admin['user']}@mluniformes.com".lower()
    
    # Create or update user in Firebase Auth
    try:
        user = auth.get_user_by_email(email)
        print(f"[-] Usuario {email} ya existe. Actualizando contraseña...")
        auth.update_user(user.uid, password=admin["pass"])
    except auth.UserNotFoundError:
        print(f"[+] Creando nuevo usuario {email}...")
        user = auth.create_user(email=email, password=admin["pass"])
    
    # Add to allowed_admins whitelist
    db.collection('allowed_admins').document(email).set({
        'email': email,
        'created_at': firestore.SERVER_TIMESTAMP
    })
    print(f"  [+] Whitelisted: {email}")

print("\nListo. Los administradores han sido creados y autorizados.")
