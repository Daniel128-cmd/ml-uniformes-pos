from firebase_functions import https_fn, options
from firebase_admin import initialize_app, firestore
import os

initialize_app()

# Lazy initialize database client for deployment compatibility
db_client = None
def get_db():
    global db_client
    if db_client is None:
        db_client = firestore.client()
    return db_client

import firestore_reports

@https_fn.on_request(cors=options.CorsOptions(cors_origins="*", cors_methods=["GET", "POST"]))
def report_sales(req: https_fn.Request) -> https_fn.Response:
    date_str = req.args.get("date")
    filepath = firestore_reports.generate_sales_report(get_db(), date_str)
    return _serve_pdf(filepath)

@https_fn.on_request(cors=options.CorsOptions(cors_origins="*", cors_methods=["GET", "POST"]))
def report_logistics(req: https_fn.Request) -> https_fn.Response:
    filepath = firestore_reports.generate_logistics_report(get_db())
    return _serve_pdf(filepath)

@https_fn.on_request(cors=options.CorsOptions(cors_origins="*", cors_methods=["GET", "POST"]))
def report_delivery(req: https_fn.Request) -> https_fn.Response:
    date_str = req.args.get("date")
    filepath = firestore_reports.generate_delivery_consolidation(get_db(), date_str)
    return _serve_pdf(filepath)

@https_fn.on_request(cors=options.CorsOptions(cors_origins="*", cors_methods=["GET", "POST"]))
def report_hoja_ruta(req: https_fn.Request) -> https_fn.Response:
    filepath = firestore_reports.generate_hoja_ruta(get_db())
    return _serve_pdf(filepath)

@https_fn.on_request(cors=options.CorsOptions(cors_origins="*", cors_methods=["GET", "POST"]))
def report_planilla_produccion(req: https_fn.Request) -> https_fn.Response:
    filepath = firestore_reports.generate_planilla_produccion(get_db())
    return _serve_pdf(filepath)

@https_fn.on_request(cors=options.CorsOptions(cors_origins="*", cors_methods=["GET", "POST"]))
def report_orden_consolidada(req: https_fn.Request) -> https_fn.Response:
    filepath = firestore_reports.generate_orden_consolidada(get_db())
    return _serve_pdf(filepath)

def _serve_pdf(filepath: str) -> https_fn.Response:
    try:
        with open(filepath, 'rb') as f:
            content = f.read()
        
        # Clean up temp file
        os.remove(filepath)

        return https_fn.Response(
            content,
            mimetype="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{os.path.basename(filepath)}"'
            }
        )
    except Exception as e:
        return https_fn.Response(str(e), status=500)