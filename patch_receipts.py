import firebase_admin
from firebase_admin import credentials, firestore

KEY_PATH = r"c:\Users\Dani\Desktop\ML PEDIDOS\mlpuntodeventa-firebase-adminsdk-fbsvc-e4e8139627.json"
cred = credentials.Certificate(KEY_PATH)
firebase_admin.initialize_app(cred)

db = firestore.client()

insts = db.collection('institutions').stream()
inst_dict = {i.id: i.to_dict().get('name') for i in insts}
print('Inst Map:', inst_dict)

receipts = db.collection('receipts').stream()
batch = db.batch()
count = 0
for r in receipts:
    d = r.to_dict()
    inst_id = d.get('institution_id')
    name = inst_dict.get(inst_id, 'Desconocida')
    batch.update(r.reference, {'institution_name': name})
    count += 1
    if count % 400 == 0:
        batch.commit()
        batch = db.batch()
        
if count % 400 != 0:
    batch.commit()

print(f'Pached {count} receipts with institution_name')
