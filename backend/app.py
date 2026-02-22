import json
import sqlite3
import os
import re
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
import urllib.parse
import pdf_generator


# Cuando corre en Render, la base de datos va en el disco persistente /data
# En local, usa el mismo directorio del script
_DATA_DIR = "/data" if os.path.isdir("/data") else os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(_DATA_DIR, "ml_pedidos.db")


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handles each request in a separate thread to prevent server blocking."""
    daemon_threads = True

    def handle_error(self, request, client_address):
        """Silently absorb broken pipe / connection reset errors on browser refresh."""
        import sys
        exc = sys.exc_info()[1]
        if isinstance(exc, (BrokenPipeError, ConnectionResetError)):
            return
        super().handle_error(request, client_address)
class MLPedidosRequestHandler(BaseHTTPRequestHandler):
    
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With")
        self.send_header("Access-Control-Max-Age", "86400")
        # Prevent stale financial data from being cached
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path        = parsed_path.path
        params      = urllib.parse.parse_qs(parsed_path.query)

        if path == "/api/admin/receipts":
            self.handle_get_receipts()
        elif re.match(r'^/api/admin/receipts/(\d+)/items$', path):
            receipt_id = path.split('/')[4]
            self.handle_get_receipt_items(receipt_id)
        elif re.match(r'^/api/admin/receipts/(\d+)/payments$', path):
            receipt_id = path.split('/')[4]
            self.handle_get_payments(receipt_id)
        elif path == "/api/admin/reports/sales":
            self.handle_get_report_sales()
        elif path == "/api/admin/reports/hoja-ruta":
            self.handle_get_report_hoja_ruta()
        elif path == "/api/admin/reports/planilla-produccion":
            self.handle_get_report_planilla_produccion()
        elif path == "/api/admin/reports/orden-consolidada":
            self.handle_get_report_orden_consolidada()
        elif path == "/api/admin/reports/production":
            self.handle_get_report_production()
        elif path == "/api/admin/reports/sales-extract":
            period = params.get('period', ['weekly'])[0]
            self.handle_get_report_sales_extract(period)
        elif path == "/api/admin/reports/logistics":
            self.handle_get_report_logistics()
        elif path == "/api/admin/reports/delivery-consolidation":
            date_str = params.get('date', [None])[0]
            self.handle_get_report_delivery_consolidation(date_str)
        elif path == "/api/dashboard/live":
            self.handle_get_dashboard_live()
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b"Not Found")

    def do_POST(self):
        path = self.path
        if path == "/api/receipts":
            self.handle_post_receipt()
        elif path == "/api/login":
            self.handle_post_login()
        elif re.match(r'^/api/admin/receipts/(\d+)/payments$', path):
            receipt_id = path.split('/')[4]
            self.handle_post_payment(receipt_id)
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b"Not Found")
            
    def do_DELETE(self):
        if self.path.startswith("/api/admin/receipts/"):
            receipt_id = self.path.split("/")[-1]
            self.handle_delete_receipt(receipt_id)
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
            
    def do_PUT(self):
        path = self.path
        if path.startswith("/api/admin/receipts/") and path.endswith("/restore"):
            receipt_id = path.split("/")[4]
            self.handle_restore_receipt(receipt_id)
        elif path.startswith("/api/admin/receipts/") and not path.endswith("/restore"):
            # Edit receipt
            receipt_id = path.split("/")[-1]
            self.handle_edit_receipt(receipt_id)
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

    # --- ENDPOINTS ---
    
    def handle_post_login(self):
        import hashlib
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        username = data.get("username", "")
        password = data.get("password", "")
        hashed_pw = hashlib.sha256(password.encode()).hexdigest()
        
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, username, role FROM users WHERE username = ? AND password_hash = ? AND active = 1", (username, hashed_pw))
        user = cursor.fetchone()
        conn.close()
        
        if user:
            # En un entorno real se usaría JWT, aquí simplificamos devolviendo los datos básicos de sesión
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True, 
                "user": {"id": user["id"], "username": user["username"], "role": user["role"]}
            }).encode('utf-8'))
        else:
            self.send_response(401)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": "Credenciales inválidas"}).encode('utf-8'))
            
    def handle_get_dashboard_live(self):
        parsed_path = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed_path.query)
        
        institution_filter = query.get("institution", [None])[0]
        status_filter = query.get("status", [None])[0]
        
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        sql = """
            SELECT r.id, r.receipt_number as number, i.name as institution, 
                   r.client_name as client, r.total_amount as total, 
                   r.created_at as date, r.status
            FROM receipts r
            JOIN institutions i ON r.institution_id = i.id
            WHERE r.deleted_at IS NULL
        """
        params = []
        
        if institution_filter:
            sql += " AND i.name = ?"
            params.append(institution_filter)
        if status_filter:
            sql += " AND r.status = ?"
            params.append(status_filter)
            
        sql += " ORDER BY r.created_at DESC"
        
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        
        receipts = [dict(row) for row in rows]
        conn.close()
        
        self.send_response(200)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(receipts).encode('utf-8'))

    def handle_post_receipt(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        try:
            # 1. Ensure institution
            cursor.execute("INSERT OR IGNORE INTO institutions (id, name, code) VALUES (?, ?, ?)", 
                         (data["institucionId"], data["institucionNombre"], f"I{data['institucionId']}"))
            
            # 2. Generate sequential number
            cursor.execute("SELECT COUNT(*) FROM receipts WHERE institution_id = ?", (data["institucionId"],))
            count = cursor.fetchone()[0]
            nuevo_numero = str(count + 1).zfill(3)
            
            # 3. Create receipt (with payment_method)
            cursor.execute("""
                INSERT INTO receipts
                  (receipt_number, institution_id, client_name, client_phone,
                   total_amount, delivery_date, payment_method)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (nuevo_numero, data["institucionId"], data["client_name"],
                  data["client_phone"], data["total_amount"],
                  data.get("delivery_date"),
                  data.get("payment_method", "Efectivo")))
            
            receipt_id = cursor.lastrowid
            
            # 4. Create items
            for item in data["items"]:
                cursor.execute("INSERT OR IGNORE INTO products (id, name, category) VALUES (?, ?, ?)",
                             (item["productoId"], item["nombre"], "Desconocida"))
                cursor.execute("""
                    INSERT INTO receipt_items (receipt_id, product_id, size_range, exact_size, quantity, unit_price)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (receipt_id, item["productoId"], item["tallaRango"], item["tallaExacta"], item["cantidad"], item["precio"]))

            # 5. Register initial payment if provided
            initial_payment = float(data.get('initial_payment', 0) or 0)
            if initial_payment > 0:
                cursor.execute("""
                    INSERT INTO payments (receipt_id, amount, payment_method, notes)
                    VALUES (?, ?, ?, 'Abono inicial')
                """, (receipt_id, initial_payment, data.get('payment_method', 'Efectivo')))

            conn.commit()
            response = {"message": "Recibo guardado", "receipt_id": receipt_id, "receipt_number": nuevo_numero}
            self.send_response(201)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            conn.rollback()
            self.send_response(500)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        finally:
            conn.close()

    def handle_get_receipts(self):
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT r.id, r.receipt_number as number, i.name as institution,
                   r.client_name as client, r.client_phone as phone,
                   r.total_amount as total, r.created_at as date,
                   r.deleted_at, r.status, r.delivery_date,
                   COALESCE(r.payment_method, 'Efectivo') as payment_method,
                   COALESCE((
                       SELECT SUM(p.amount)
                       FROM payments p WHERE p.receipt_id = r.id
                   ), 0) as total_paid
            FROM receipts r
            JOIN institutions i ON r.institution_id = i.id
            ORDER BY r.created_at DESC
        """)

        rows = cursor.fetchall()
        receipts = []
        for row in rows:
            d = dict(row)
            d['is_anulado'] = bool(d.get('deleted_at'))
            if d['is_anulado']:
                d['display_status']  = 'Anulado'
                d['payment_status']  = 'Anulado'
            else:
                paid  = float(d.get('total_paid', 0))
                total = float(d.get('total', 0))
                if paid <= 0:
                    d['payment_status'] = 'Pendiente'
                elif paid < total:
                    d['payment_status'] = 'Abonado'
                else:
                    d['payment_status'] = 'Cancelado'
                d['display_status'] = d.get('status') or 'Pendiente'
            d['balance'] = max(0, float(d.get('total', 0)) - float(d.get('total_paid', 0)))
            receipts.append(d)

        conn.close()
        self.send_response(200)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(receipts, default=str).encode('utf-8'))

    # ── PAYMENTS: GET history ──────────────────────────────────────────────
    def handle_get_payments(self, receipt_id):
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.receipt_number, r.client_name, r.client_phone,
                   r.total_amount, i.name as institution, r.delivery_date,
                   COALESCE((
                       SELECT SUM(p2.amount)
                       FROM payments p2 WHERE p2.receipt_id = r.id
                   ), 0) as total_paid
            FROM receipts r
            JOIN institutions i ON r.institution_id = i.id
            WHERE r.id = ?
        """, (receipt_id,))
        rec = cursor.fetchone()
        if not rec:
            conn.close()
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Recibo no encontrado'}).encode())
            return
        cursor.execute("""
            SELECT id, amount, payment_method, notes, created_at
            FROM payments
            WHERE receipt_id = ?
            ORDER BY created_at
        """, (receipt_id,))
        payments = [dict(row) for row in cursor.fetchall()]
        rec_d = dict(rec)
        rec_d['payments'] = payments
        rec_d['balance']  = max(0, float(rec_d['total_amount']) - float(rec_d['total_paid']))
        conn.close()
        self.send_response(200)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(rec_d, default=str).encode())

    # ── PAYMENTS: POST new abono ───────────────────────────────────────────
    def handle_post_payment(self, receipt_id):
        try:
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length).decode())
            amount  = float(data.get('amount', 0))
            method  = data.get('payment_method', 'Efectivo')
            notes   = data.get('notes', '')
            if amount < 0:
                raise ValueError('El monto no puede ser negativo')
            conn = sqlite3.connect(DATABASE)
            cursor = conn.cursor()
            # Verify receipt exists and is not annulled
            cursor.execute("SELECT id, total_amount FROM receipts WHERE id = ? AND deleted_at IS NULL",
                           (receipt_id,))
            rec = cursor.fetchone()
            if not rec:
                conn.close()
                self.send_response(404)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Recibo no encontrado o anulado'}).encode())
                return
            cursor.execute("""
                INSERT INTO payments (receipt_id, amount, payment_method, notes)
                VALUES (?, ?, ?, ?)
            """, (receipt_id, amount, method, notes))
            payment_id = cursor.lastrowid
            # Compute new total_paid and payment_status
            cursor.execute("SELECT SUM(amount) FROM payments WHERE receipt_id = ?", (receipt_id,))
            total_paid = float(cursor.fetchone()[0] or 0)
            total_amount = float(rec[1])
            if total_paid <= 0:
                pstatus = 'Pendiente'
            elif total_paid < total_amount:
                pstatus = 'Abonado'
            else:
                pstatus = 'Cancelado'
            conn.commit()
            conn.close()
            self.send_response(201)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'payment_id': payment_id,
                'total_paid': total_paid,
                'balance': max(0, total_amount - total_paid),
                'payment_status': pstatus,
            }).encode())
        except Exception as e:
            self.send_response(500)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())


    def handle_delete_receipt(self, receipt_id):
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        cursor.execute("UPDATE receipts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL", (receipt_id,))
        if cursor.rowcount == 0:
            self.send_response(404)
        else:
            conn.commit()
            self.send_response(200)
            
        conn.close()
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(b'{"message": "Anulado"}')

    def handle_restore_receipt(self, receipt_id):
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        cursor.execute("UPDATE receipts SET deleted_at = NULL WHERE id = ?", (receipt_id,))
        if cursor.rowcount == 0:
            self.send_response(404)
        else:
            conn.commit()
            self.send_response(200)
            
        conn.close()
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(b'{"message": "Restaurado"}')

    def handle_edit_receipt(self, receipt_id):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                UPDATE receipts SET
                    client_name = COALESCE(?, client_name),
                    client_phone = COALESCE(?, client_phone),
                    status = COALESCE(?, status)
                WHERE id = ?
            """, (data.get('client_name'), data.get('client_phone'), data.get('status'), receipt_id))
            conn.commit()
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'message': 'Actualizado'}).encode())
        except Exception as e:
            conn.rollback()
            self.send_response(500)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
        finally:
            conn.close()

    def handle_get_report_sales(self):
        filepath = pdf_generator.generate_sales_report_sqlite(DATABASE)
        self._serve_file(filepath, "application/pdf")

    def handle_get_report_production(self):
        filepath = pdf_generator.generate_production_report_sqlite(DATABASE)
        self._serve_file(filepath, "application/pdf")

    def handle_get_report_sales_extract(self, period='weekly'):
        try:
            filepath = pdf_generator.generate_sales_extract(DATABASE, period)
            self._serve_file(filepath, "application/pdf")
        except Exception as e:
            self.send_response(500)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def _serve_file(self, filepath, content_type):
        try:
            with open(filepath, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Content-Disposition',
                             f'attachment; filename="{os.path.basename(filepath)}"')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))

    def handle_get_receipt_items(self, receipt_id):
        """Returns the line items for a single receipt (for the detail modal)."""
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.receipt_number, r.client_name, r.client_phone, r.total_amount,
                   r.delivery_date, r.created_at, r.status, r.deleted_at,
                   i.name as institution
            FROM receipts r
            JOIN institutions i ON r.institution_id = i.id
            WHERE r.id = ?
        """, (receipt_id,))
        receipt = cursor.fetchone()
        cursor.execute("""
            SELECT p.name as product, ri.size_range, ri.exact_size,
                   ri.quantity, ri.unit_price
            FROM receipt_items ri
            JOIN products p ON ri.product_id = p.id
            WHERE ri.receipt_id = ?
        """, (receipt_id,))
        items = [dict(r) for r in cursor.fetchall()]
        conn.close()
        if not receipt:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"error":"Not found"}')
            return
        payload = dict(receipt)
        payload['items'] = items
        # Boolean-friendly deleted flag
        payload['is_anulado'] = bool(payload.get('deleted_at'))
        self.send_response(200)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(payload, default=str).encode())

    def handle_get_report_logistics(self):
        """PDF A: Logistica Diaria - todos los pedidos de hoy."""
        try:
            filepath = pdf_generator.generate_logistics_report(DATABASE)
            self._serve_file(filepath, 'application/pdf')
        except Exception as e:
            self.send_response(500)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def handle_get_report_delivery_consolidation(self, date_str):
        """PDF B: Consolidado de prendas para una fecha de entrega especifica."""
        try:
            filepath = pdf_generator.generate_delivery_consolidation(DATABASE, date_str)
            self._serve_file(filepath, 'application/pdf')
        except Exception as e:
            self.send_response(500)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def handle_get_report_hoja_ruta(self):
        """Hoja de Ruta: Pedidos tomados hoy, agrupados por colegio, sin precios."""
        try:
            filepath = pdf_generator.generate_hoja_ruta(DATABASE)
            self._serve_file(filepath, 'application/pdf')
        except Exception as e:
            self.send_response(500)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def handle_get_report_planilla_produccion(self):
        """Planilla de Producción Detallada: por colegio → recibo → niño → prendas, sin precios."""
        try:
            filepath = pdf_generator.generate_planilla_produccion(DATABASE)
            self._serve_file(filepath, 'application/pdf')
        except Exception as e:
            self.send_response(500)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def handle_get_report_orden_consolidada(self):
        """Orden de Producción Consolidada: por colegio → prenda+talla → sumar cantidades."""
        try:
            filepath = pdf_generator.generate_orden_consolidada(DATABASE)
            self._serve_file(filepath, 'application/pdf')
        except Exception as e:
            self.send_response(500)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())


    def log_message(self, format, *args):
        if args and str(args[1]) not in ('200', '201', '204'):
            super().log_message(format, *args)


def migrate_db():
    """Auto-migration: add any missing columns to receipts table."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(receipts)")
    cols = {row[1] for row in cursor.fetchall()}
    if 'payment_method' not in cols:
        print("[MIGRATION] Adding payment_method column...")
        cursor.execute("ALTER TABLE receipts ADD COLUMN payment_method TEXT DEFAULT 'Efectivo'")
        conn.commit()
        print("[MIGRATION] Done.")

    # Create payments table (abonos)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_id     INTEGER NOT NULL REFERENCES receipts(id),
            amount         REAL    NOT NULL,
            payment_method TEXT    NOT NULL DEFAULT 'Efectivo',
            notes          TEXT    DEFAULT '',
            created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def run_server(port=None):
    if port is None:
        port = int(os.environ.get("PORT", 8000))
    migrate_db()   # ensure schema is up-to-date
    server_address = ('', port)
    httpd = ThreadedHTTPServer(server_address, MLPedidosRequestHandler)
    print(f"Servidor ML Pedidos ejecutandose en puerto {port}")
    print("Presiona Ctrl+C para detener.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")

if __name__ == "__main__":
    run_server()
