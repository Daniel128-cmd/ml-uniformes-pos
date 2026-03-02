import firebase_admin
from firebase_admin import credentials, auth, firestore

cred = credentials.Certificate(r"c:\Users\Dani\Desktop\ML PEDIDOS\mlpuntodeventa-firebase-adminsdk-fbsvc-e4e8139627.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

def create_admin(user_name, password):
    email = f"{user_name}@mlpuntodeventa.com" if not "@" in user_name else user_name
    try:
        user = auth.get_user_by_email(email)
        print(f"[-] User {email} already exists. Updating password...")
        auth.update_user(user.uid, password=password)
        uid = user.uid
    except Exception as e:
        if 'UserRecord' not in str(type(e)) and 'NotFoundError' in str(type(e)):
            print(f"[+] Creating user {email}...")
            user = auth.create_user(email=email, password=password)
            uid = user.uid
        else:
            # Fallback for generic exceptions (if not found error varies in the library version)
            try:
                user = auth.create_user(email=email, password=password)
                uid = user.uid
                print(f"[+] Created user {email}...")
            except Exception as e2:
                print(f"Error handling {email}: {e} / {e2}")
                return

    # Add to users collection
    db.collection('users').document(uid).set({'role': 'ADMIN'})
    print(f"[*] Set ADMIN role in Firestore for {email}\n")

print("Initializing users...")
create_admin('admin', 'admin123456')
create_admin('Daniel', 'metalicas12')
print("Done.")
