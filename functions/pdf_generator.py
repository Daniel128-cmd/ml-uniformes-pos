import sqlite3
import os
from collections import defaultdict
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                 TableStyle, HRFlowable, KeepTogether)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

# ── Palette ─────────────────────────────────────────────────────────────────
VINO       = colors.HexColor("#7B1929")
VINO_DARK  = colors.HexColor("#5C0F1B")
BEIGE      = colors.HexColor("#F5EDD6")
LIGHT_GRAY = colors.HexColor("#E9ECEF")
GRAY       = colors.HexColor("#343A40")
GRAY_DARK  = colors.HexColor("#6C757D")
WHITE      = colors.white
RED_SOFT   = colors.HexColor("#FCE8E6")
GREEN_SOFT = colors.HexColor("#E6F4EA")
AMBER_SOFT = colors.HexColor("#FFF3E0")

BASE_DIR = os.path.dirname(__file__) if '__file__' in globals() else '.'


# ── Helpers ──────────────────────────────────────────────────────────────────
def _fmt(n):
    """Format number as Colombian peso string."""
    try:
        return f"$ {float(n):,.0f}".replace(",", ".")
    except (TypeError, ValueError):
        return "$ 0"


def _date_label():
    return datetime.now().strftime("%d/%m/%Y %H:%M")


def _add_business_days(from_date: datetime, num_days: int) -> datetime:
    """Return date + num_days skipping weekends."""
    current = from_date
    added = 0
    while added < num_days:
        current += timedelta(days=1)
        if current.weekday() < 5:   # Mon–Fri
            added += 1
    return current


def _build_header(story, subtitle, date_range="", delivery_date=""):
    """Add the branded ML Uniformes header block to a story.
    delivery_date: if provided, shows a second row 'Entrega Estimada: <date>'."""
    company_style = ParagraphStyle('Company', fontName='Helvetica-Bold',
                                   fontSize=22, textColor=BEIGE, alignment=TA_CENTER)
    sub_style     = ParagraphStyle('Sub', fontName='Helvetica-Bold',
                                   fontSize=12, textColor=BEIGE, alignment=TA_LEFT)
    date_style    = ParagraphStyle('DateS', fontName='Helvetica',
                                   fontSize=9,  textColor=BEIGE, alignment=TA_RIGHT)
    delivery_style = ParagraphStyle('DelS', fontName='Helvetica',
                                    fontSize=9, textColor=BEIGE, alignment=TA_CENTER)

    header_table = Table([[Paragraph("ML Uniformes", company_style)]],
                          colWidths=[6.5 * inch])
    header_table.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), VINO_DARK),
        ('TOPPADDING',    (0, 0), (-1, -1), 16),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING',   (0, 0), (-1, -1), 20),
    ]))
    story.append(header_table)

    generated_label = date_range or f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    if delivery_date:
        # Two-row subheader: title+date in row1, delivery in row2
        subheader = Table([
            [Paragraph(subtitle, sub_style),
             Paragraph(generated_label, date_style)],
            [Paragraph(f"📦  Fecha de Entrega Estimada: <b>{delivery_date}</b>",
                       delivery_style), ""],
        ], colWidths=[4 * inch, 2.5 * inch])
        subheader.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, 0), VINO),
            ('BACKGROUND',    (0, 1), (-1, 1), colors.HexColor("#5C0F1B")),
            ('SPAN',          (0, 1), (1, 1)),
            ('TOPPADDING',    (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('LEFTPADDING',   (0, 0), (-1, -1), 20),
            ('RIGHTPADDING',  (-1, 0), (-1, 0), 20),
        ]))
    else:
        subheader = Table([
            [Paragraph(subtitle, sub_style),
             Paragraph(generated_label, date_style)]
        ], colWidths=[4 * inch, 2.5 * inch])
        subheader.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), VINO),
            ('TOPPADDING',    (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING',   (0, 0), (-1, -1), 20),
            ('RIGHTPADDING',  (-1, 0), (-1, 0), 20),
        ]))

    story.append(subheader)
    story.append(Spacer(1, 0.35 * inch))


def _school_header(story, inst_name):
    """Add a visually distinct school section header."""
    sty = ParagraphStyle('SchoolHdr', fontName='Helvetica-Bold',
                         fontSize=11, textColor=WHITE, spaceBefore=10, spaceAfter=4)
    t = Table([[Paragraph(f"🏫  {inst_name.upper()}", sty)]],
              colWidths=[6.5 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), VINO),
        ('TOPPADDING',    (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING',   (0, 0), (-1, -1), 12),
        ('ROUNDEDCORNERS', [4]),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.08 * inch))


def _section_table(data, col_widths):
    """Build a styled section table."""
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, 0), VINO),
        ('TEXTCOLOR',     (0, 0), (-1, 0), BEIGE),
        ('FONTNAME',      (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE',      (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING',    (0, 0), (-1, 0), 8),
        ('FONTNAME',      (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE',      (0, 1), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ('TOPPADDING',    (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('GRID',          (0, 0), (-1, -1), 0.4, colors.HexColor("#CED4DA")),
        ('ALIGN',         (-1, 0), (-1, -1), 'RIGHT'),
        ('ALIGN',         (0, 0), (-1, 0), 'LEFT'),
    ]))
    return t


def _footer(story, text=None):
    footer_sty = ParagraphStyle('Foot', fontName='Helvetica', fontSize=8,
                                 textColor=GRAY_DARK, alignment=TA_CENTER)
    story.append(Spacer(1, 0.25 * inch))
    story.append(HRFlowable(color=LIGHT_GRAY, thickness=1))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph(
        text or f"ML Uniformes — Generado el {_date_label()}", footer_sty))


# ── PDF 1: Ventas del Día con desglose de pago ────────────────────────────────
def generate_sales_report_sqlite(db_path: str, date_str: str = None) -> str:
    """PDF 1: Reporte diario de ventas — muestra el efectivo real recaudado (abonos del día)."""
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Fetch each individual payment made TODAY, joined with its receipt
    cursor.execute("""
        SELECT r.receipt_number, i.name as inst_name,
               r.client_name, r.client_phone,
               r.delivery_date,
               p.amount        as paid_amount,
               p.payment_method as pay_method
        FROM payments p
        JOIN receipts r ON r.id = p.receipt_id
        JOIN institutions i ON r.institution_id = i.id
        WHERE r.deleted_at IS NULL
          AND DATE(p.created_at) = ?
        ORDER BY i.name, r.receipt_number
    """, (date_str,))
    rows = cursor.fetchall()
    conn.close()

    grouped = defaultdict(list)
    for r in rows:
        grouped[r["inst_name"]].append(r)

    filename = os.path.join(BASE_DIR, f"sales_report_{date_str}.pdf")
    doc = SimpleDocTemplate(filename, pagesize=letter,
                            leftMargin=0.6*inch, rightMargin=0.6*inch,
                            topMargin=0.5*inch, bottomMargin=0.5*inch)
    inst_style = ParagraphStyle('Inst', fontName='Helvetica-Bold',
                                fontSize=10, textColor=VINO, spaceBefore=14, spaceAfter=4)
    amount_style = ParagraphStyle('Amt', fontName='Helvetica-Bold',
                                  fontSize=10, textColor=VINO, alignment=TA_RIGHT)

    story = []
    _build_header(story, "Reporte de Ventas — Efectivo Recaudado Hoy",
                  f"Generado: {datetime.now().strftime('%d/%m/%Y')}")

    total_dia = 0.0
    total_efectivo = 0.0
    total_transferencia = 0.0

    if not grouped:
        story.append(Spacer(1, 0.5*inch))
        no_data = ParagraphStyle('ND', fontName='Helvetica', fontSize=11,
                                 textColor=colors.HexColor("#6C757D"), alignment=1)
        story.append(Paragraph("No se registraron abonos hoy.", no_data))
    else:
        for inst_name, recs in sorted(grouped.items()):
            _school_header(story, inst_name)
            data = [["N°", "Niño/a", "Teléfono", "Método de Pago", "Entrega Est.", "Abonado Hoy"]]
            subtotal = 0.0
            for r in recs:
                pm = r["pay_method"] or "Efectivo"
                pm_icon = "💵 Efectivo" if pm == "Efectivo" else "📲 Transf."
                data.append([
                    r["receipt_number"],
                    r["client_name"] or "(Sin nombre)",
                    r["client_phone"] or "—",
                    pm_icon,
                    r["delivery_date"] or "—",
                    _fmt(r["paid_amount"]),
                ])
                subtotal += r["paid_amount"]
                if pm == "Efectivo":
                    total_efectivo += r["paid_amount"]
                else:
                    total_transferencia += r["paid_amount"]
            data.append(["", "", "", "", "SUBTOTAL:", _fmt(subtotal)])
            total_dia += subtotal

            t = _section_table(data, [0.45*inch, 1.8*inch, 1.1*inch, 1.1*inch, 1.0*inch, 1.0*inch])
            t.setStyle(TableStyle([
                ('SPAN',       (0, -1), (4, -1)),
                ('BACKGROUND', (0, -1), (-1, -1), LIGHT_GRAY),
                ('FONTNAME',   (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('ALIGN',      (-1, -1), (-1, -1), 'RIGHT'),
            ]))
            story.append(KeepTogether(t))
            story.append(Spacer(1, 0.2 * inch))

    # ── RESUMEN FINANCIERO ────────────────────────────────────────────────────
    story.append(Spacer(1, 0.1 * inch))
    story.append(HRFlowable(color=VINO, thickness=2))
    story.append(Spacer(1, 0.1 * inch))

    summ_title = ParagraphStyle('SummT', fontName='Helvetica-Bold',
                                 fontSize=12, textColor=VINO, spaceBefore=8)
    story.append(Paragraph("Resumen Financiero del Período", summ_title))
    story.append(Spacer(1, 0.1 * inch))

    summ_data = [
        ["Concepto", "Total"],
        ["💵  Abonos en Efectivo", _fmt(total_efectivo)],
        ["📲  Abonos por Transferencia", _fmt(total_transferencia)],
        ["TOTAL RECAUDADO HOY", _fmt(total_dia)],
    ]
    summ_t = Table(summ_data, colWidths=[4.5*inch, 2.0*inch])
    summ_t.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, 0),   VINO),
        ('TEXTCOLOR',     (0, 0), (-1, 0),   BEIGE),
        ('FONTNAME',      (0, 0), (-1, 0),   'Helvetica-Bold'),
        ('FONTSIZE',      (0, 0), (-1, 0),   10),
        ('BACKGROUND',    (0, 1), (-1, 1),   GREEN_SOFT),
        ('BACKGROUND',    (0, 2), (-1, 2),   AMBER_SOFT),
        ('BACKGROUND',    (0, 3), (-1, 3),   VINO_DARK),
        ('TEXTCOLOR',     (0, 3), (-1, 3),   BEIGE),
        ('FONTNAME',      (0, 1), (-1, -1),  'Helvetica-Bold'),
        ('FONTSIZE',      (0, 1), (-1, -1),  10),
        ('ALIGN',         (-1, 0), (-1, -1), 'RIGHT'),
        ('TOPPADDING',    (0, 0), (-1, -1),  9),
        ('BOTTOMPADDING', (0, 0), (-1, -1),  9),
        ('LEFTPADDING',   (0, 0), (-1, -1),  12),
        ('GRID',          (0, 0), (-1, -1),  0.5, colors.HexColor("#CED4DA")),
    ]))
    story.append(summ_t)
    _footer(story)
    doc.build(story)
    return filename


# ── PDF 2: Producción Consolidada ────────────────────────────────────────────
def generate_production_report_sqlite(db_path: str, date_str: str = None) -> str:
    """PDF 2: Orden de Producción Consolidada por institución."""
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT i.name as inst_name, p.name as prod_name,
               ri.exact_size, SUM(ri.quantity) as qty
        FROM receipt_items ri
        JOIN receipts r ON ri.receipt_id = r.id
        JOIN institutions i ON r.institution_id = i.id
        JOIN products p ON ri.product_id = p.id
        WHERE r.deleted_at IS NULL
        GROUP BY i.name, p.name, ri.exact_size
        ORDER BY i.name, p.name, ri.exact_size
    """)
    rows = cursor.fetchall()
    conn.close()

    production = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for row in rows:
        production[row["inst_name"]][row["prod_name"]][str(row["exact_size"])] += row["qty"]

    filename = os.path.join(BASE_DIR, f"production_report_{date_str}.pdf")
    doc = SimpleDocTemplate(filename, pagesize=letter,
                            leftMargin=0.6*inch, rightMargin=0.6*inch,
                            topMargin=0.5*inch, bottomMargin=0.5*inch)
    prod_style = ParagraphStyle('Prod', fontName='Helvetica-Bold',
                                fontSize=9, textColor=GRAY, leftIndent=10, spaceBefore=6)

    story = []
    _build_header(story, "Orden de Producción Consolidada",
                  f"Fecha: {datetime.now().strftime('%d/%m/%Y')}")

    def size_key(s):
        try: return int(s)
        except: return 999

    if not production:
        no_data = ParagraphStyle('ND', fontName='Helvetica', fontSize=10,
                                  textColor=GRAY_DARK, alignment=TA_CENTER)
        story.append(Paragraph("No hay pedidos activos registrados.", no_data))
    else:
        for inst_name, prods in sorted(production.items()):
            items = []
            items.append(Spacer(1, 0.05*inch))
            _school_header(items, inst_name)

            for prod_name, sizes in sorted(prods.items()):
                total_prod = sum(sizes.values())
                items.append(Paragraph(
                    f"▸  {prod_name}  <font size='8' color='#6C757D'>(Total: {total_prod} unidades)</font>",
                    prod_style))
                tbl_data = [["Talla", "Cantidad"]]
                for size, qty in sorted(sizes.items(), key=lambda x: size_key(x[0])):
                    tbl_data.append([size, f"{qty} und."])
                pt = Table(tbl_data, colWidths=[1.5*inch, 1.2*inch])
                pt.setStyle(TableStyle([
                    ('BACKGROUND',    (0, 0), (-1, 0), VINO),
                    ('TEXTCOLOR',     (0, 0), (-1, 0), BEIGE),
                    ('FONTNAME',      (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTNAME',      (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE',      (0, 0), (-1, -1), 8),
                    ('ROWBACKGROUNDS',(0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
                    ('GRID',          (0, 0), (-1, -1), 0.4, colors.HexColor("#CED4DA")),
                    ('TOPPADDING',    (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ('LEFTPADDING',   (0, 0), (-1, -1), 10),
                    ('ALIGN',         (1, 0), (1, -1), 'CENTER'),
                ]))
                items.append(Spacer(1, 0.04*inch))
                items.append(pt)
                items.append(Spacer(1, 0.08*inch))
            items.append(Spacer(1, 0.15*inch))
            story.append(KeepTogether(items))

    _footer(story, f"ML Uniformes — Taller de Confección — {_date_label()}")
    doc.build(story)
    return filename


# ── PDF Extracto de Ventas ────────────────────────────────────────────────────
def generate_sales_extract(db_path: str, period: str = "weekly") -> str:
    """Extracto de ventas filtrado por período con desglose de pago."""
    from datetime import date
    today = date.today()

    if period == "weekly":
        start = today - timedelta(days=today.weekday())
        label = f"Semana {start.strftime('%d/%m')} – {today.strftime('%d/%m/%Y')}"
    elif period == "monthly":
        start = today.replace(day=1)
        label = today.strftime("Mes de %B %Y")
    elif period == "annual":
        start = today.replace(month=1, day=1)
        label = f"Año {today.year}"
    else:
        start = today - timedelta(days=7)
        label = "Últimos 7 días"

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT r.id, r.receipt_number, i.name as inst_name,
               r.client_name, r.total_amount, r.created_at, r.deleted_at,
               COALESCE(r.payment_method, 'Efectivo') as payment_method
        FROM receipts r
        JOIN institutions i ON r.institution_id = i.id
        WHERE DATE(r.created_at) >= ?
        ORDER BY r.created_at
    """, (start.isoformat(),))
    rows = cursor.fetchall()
    conn.close()

    filename = os.path.join(BASE_DIR, f"sales_extract_{period}_{today.strftime('%Y%m%d')}.pdf")
    doc = SimpleDocTemplate(filename, pagesize=letter,
                            leftMargin=0.6*inch, rightMargin=0.6*inch,
                            topMargin=0.5*inch, bottomMargin=0.5*inch)

    anul_style  = ParagraphStyle('Anul', fontName='Helvetica', fontSize=8,
                                  textColor=colors.red)
    title_style = ParagraphStyle('Title', fontName='Helvetica-Bold',
                                 fontSize=11, textColor=VINO, spaceBefore=12)
    story = []
    _build_header(story, f"Extracto de Ventas — {period.capitalize()}", label)

    data = [["N°", "Institución", "Niño/a", "Pago", "Total", "Estado"]]
    gross = 0.0
    efectivo = 0.0
    transferencia = 0.0

    for r in rows:
        is_anulado = bool(r["deleted_at"])
        pm_icon    = "💵" if (r["payment_method"] or "Efectivo") == "Efectivo" else "📲"
        total      = r["total_amount"] if not is_anulado else 0
        row_data   = [
            r["receipt_number"],
            r["inst_name"][:22],
            (r["client_name"] or "—")[:20],
            pm_icon,
            _fmt(r["total_amount"]) if not is_anulado else "ANULADO",
            "✓ Activo" if not is_anulado else "✗ Anulado",
        ]
        data.append(row_data)
        if not is_anulado:
            gross += r["total_amount"]
            if (r["payment_method"] or "Efectivo") == "Efectivo":
                efectivo += r["total_amount"]
            else:
                transferencia += r["total_amount"]

    t = _section_table(data, [0.4*inch, 1.8*inch, 1.6*inch, 0.5*inch, 1.0*inch, 0.9*inch])
    # Highlight annulled rows
    for i, r in enumerate(rows, start=1):
        if r["deleted_at"]:
            t.setStyle(TableStyle([
                ('TEXTCOLOR',  (0, i), (-1, i), colors.red),
                ('BACKGROUND', (0, i), (-1, i), RED_SOFT),
            ]))
    story.append(t)
    story.append(Spacer(1, 0.2*inch))

    # Summary
    summ_data = [
        ["Resumen del Período", ""],
        ["💵 Total Efectivo", _fmt(efectivo)],
        ["📲 Total Transferencia", _fmt(transferencia)],
        ["VENTAS BRUTAS", _fmt(gross)],
    ]
    summ_t = Table(summ_data, colWidths=[4.0*inch, 2.5*inch])
    summ_t.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, 0),  VINO),
        ('TEXTCOLOR',     (0, 0), (-1, 0),  BEIGE),
        ('SPAN',          (0, 0), (-1, 0)),
        ('ALIGN',         (0, 0), (-1, 0),  'CENTER'),
        ('FONTNAME',      (0, 0), (-1, 0),  'Helvetica-Bold'),
        ('FONTSIZE',      (0, 0), (-1, 0),  11),
        ('BACKGROUND',    (0, 1), (-1, 1),  GREEN_SOFT),
        ('BACKGROUND',    (0, 2), (-1, 2),  AMBER_SOFT),
        ('BACKGROUND',    (0, 3), (-1, 3),  VINO_DARK),
        ('TEXTCOLOR',     (0, 3), (-1, 3),  BEIGE),
        ('FONTNAME',      (0, 1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE',      (0, 1), (-1, -1), 10),
        ('ALIGN',         (1, 1), (1, -1),  'RIGHT'),
        ('TOPPADDING',    (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING',   (0, 0), (-1, -1), 12),
        ('GRID',          (0, 0), (-1, -1), 0.5, colors.HexColor("#CED4DA")),
    ]))
    story.append(summ_t)
    _footer(story)
    doc.build(story)
    return filename


# ── PDF A: Logística Diaria (agrupada por colegio) ────────────────────────────
def generate_logistics_report(db_path: str) -> str:
    """PDF A: Pedidos del día agrupados por institución, con detalle de prendas."""
    today       = datetime.now().strftime("%Y-%m-%d")
    today_label = datetime.now().strftime("%d/%m/%Y")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT r.id, r.receipt_number, i.name as institution,
               r.client_name, r.client_phone,
               r.created_at, r.delivery_date,
               COALESCE(r.payment_method, 'Efectivo') as payment_method,
               r.total_amount
        FROM receipts r
        JOIN institutions i ON r.institution_id = i.id
        WHERE r.deleted_at IS NULL
          AND DATE(r.created_at) = ?
        ORDER BY i.name, r.receipt_number
    """, (today,))
    receipts = cursor.fetchall()

    # Fetch items for each receipt
    receipt_items = {}
    for rec in receipts:
        cursor.execute("""
            SELECT p.name as product, ri.size_range, ri.exact_size,
                   ri.quantity, ri.unit_price
            FROM receipt_items ri
            JOIN products p ON ri.product_id = p.id
            WHERE ri.receipt_id = ?
            ORDER BY p.name
        """, (rec["id"],))
        receipt_items[rec["id"]] = cursor.fetchall()
    conn.close()

    filename = os.path.join(BASE_DIR, f"logistics_{today}.pdf")
    doc = SimpleDocTemplate(filename, pagesize=letter,
                            leftMargin=0.6*inch, rightMargin=0.6*inch,
                            topMargin=0.5*inch, bottomMargin=0.5*inch)

    rec_num_sty = ParagraphStyle('RecNum', fontName='Helvetica-Bold',
                                  fontSize=10, textColor=VINO)
    meta_sty    = ParagraphStyle('Meta', fontName='Helvetica', fontSize=8,
                                  textColor=GRAY_DARK, spaceAfter=3)
    story = []
    _build_header(story, "Logística Diaria de Pedidos", f"Fecha: {today_label}")

    if not receipts:
        empty_sty = ParagraphStyle('Empty', fontName='Helvetica', fontSize=11,
                                    textColor=GRAY_DARK, alignment=TA_CENTER)
        story.append(Spacer(1, 0.5*inch))
        story.append(Paragraph("No se registraron pedidos hoy.", empty_sty))
    else:
        # Group by institution
        grouped = defaultdict(list)
        for rec in receipts:
            grouped[rec["institution"]].append(rec)

        for inst_name, recs in sorted(grouped.items()):
            block = []
            _school_header(block, f"{inst_name}  ({len(recs)} pedido{'s' if len(recs)>1 else ''})")

            for rec in recs:
                pm_icon = "💵" if rec["payment_method"] == "Efectivo" else "📲"
                header_row = [
                    Paragraph(f"Recibo {rec['receipt_number']}", rec_num_sty),
                    Paragraph(
                        f"{rec['client_name'] or '(Sin nombre)'}  •  {rec['client_phone'] or '—'}  •  {pm_icon} {rec['payment_method']}",
                        meta_sty),
                    Paragraph(
                        f"📅 Captura: {str(rec['created_at'])[:10]}  →  🚚 Entrega est.: {rec['delivery_date'] or '—'}",
                        meta_sty),
                ]
                header_tbl = Table(
                    [[header_row[0], header_row[1]], ["", header_row[2]]],
                    colWidths=[1.4*inch, 5.1*inch])
                header_tbl.setStyle(TableStyle([
                    ('BACKGROUND',   (0, 0), (-1, -1), AMBER_SOFT),
                    ('TOPPADDING',   (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING',(0, 0), (-1, -1), 5),
                    ('LEFTPADDING',  (0, 0), (-1, -1), 8),
                    ('GRID',         (0, 0), (-1, -1), 0.3, LIGHT_GRAY),
                    ('SPAN',         (0, 0), (0, 1)),
                    ('VALIGN',       (0, 0), (0, -1), 'MIDDLE'),
                ]))
                block.append(header_tbl)

                # Items table
                items = receipt_items.get(rec["id"], [])
                if items:
                    item_data = [["Prenda", "Talla", "Cant.", "P. Unit."]]
                    for it in items:
                        item_data.append([
                            it["product"],
                            f"{it['size_range'] or ''} / {it['exact_size'] or ''}".strip(" /"),
                            str(it["quantity"]),
                            _fmt(it["unit_price"]),
                        ])
                    it_tbl = _section_table(item_data, [2.8*inch, 1.5*inch, 0.7*inch, 1.0*inch])
                    block.append(it_tbl)

                total_sty = ParagraphStyle('TotSty', fontName='Helvetica-Bold',
                                           fontSize=9, textColor=VINO, alignment=TA_RIGHT)
                block.append(Paragraph(f"Total: {_fmt(rec['total_amount'])}", total_sty))
                block.append(Spacer(1, 0.15*inch))

            story.append(KeepTogether(block) if len(block) < 25 else block)
            story.append(Spacer(1, 0.1*inch))

    total_all = sum(r["total_amount"] for r in receipts)
    gran_sty = ParagraphStyle('Gran', fontName='Helvetica-Bold',
                               fontSize=13, textColor=VINO, alignment=TA_RIGHT, spaceBefore=6)
    story.append(HRFlowable(color=VINO, thickness=1.5))
    story.append(Paragraph(f"TOTAL DEL DÍA: {_fmt(total_all)}", gran_sty))
    _footer(story)
    doc.build(story)
    return filename


# ── PDF B: Consolidado de Entrega (agrupado por colegio con N° recibo) ────────
def generate_delivery_consolidation(db_path: str, delivery_date: str = None) -> str:
    """PDF B: Consolidado de prendas por fecha de entrega, agrupado por colegio."""
    if not delivery_date:
        delivery_date = datetime.now().strftime("%d/%m/%Y")

    # Accept both DD/MM/YYYY and YYYY-MM-DD
    if "-" in delivery_date and delivery_date.index("-") == 4:
        # YYYY-MM-DD format
        db_date = delivery_date
        try:
            dt = datetime.strptime(delivery_date, "%Y-%m-%d")
            display_date = dt.strftime("%d/%m/%Y")
        except ValueError:
            display_date = delivery_date
    else:
        # DD/MM/YYYY format
        display_date = delivery_date
        try:
            dt = datetime.strptime(delivery_date, "%d/%m/%Y")
            db_date = dt.strftime("%Y-%m-%d")
        except ValueError:
            db_date = delivery_date

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT r.receipt_number, i.name as institution,
               r.client_name, r.client_phone,
               p.name as product, ri.size_range, ri.exact_size,
               ri.quantity,
               COALESCE(r.payment_method, 'Efectivo') as payment_method
        FROM receipt_items ri
        JOIN receipts r ON ri.receipt_id = r.id
        JOIN institutions i ON r.institution_id = i.id
        JOIN products p ON ri.product_id = p.id
        WHERE r.deleted_at IS NULL
          AND (r.delivery_date = ? OR r.delivery_date = ?)
        ORDER BY i.name, p.name, ri.exact_size
    """, (display_date, db_date))
    rows = cursor.fetchall()
    conn.close()

    filename = os.path.join(BASE_DIR,
                             f"delivery_consolidation_{display_date.replace('/', '-')}.pdf")
    doc = SimpleDocTemplate(filename, pagesize=letter,
                            leftMargin=0.6*inch, rightMargin=0.6*inch,
                            topMargin=0.5*inch, bottomMargin=0.5*inch)

    story = []
    _build_header(story, "Consolidado de Entrega",
                  f"Fecha de entrega: {display_date}")

    if not rows:
        empty_sty = ParagraphStyle('Empty', fontName='Helvetica', fontSize=11,
                                    textColor=GRAY_DARK, alignment=TA_CENTER)
        story.append(Spacer(1, 0.5*inch))
        story.append(Paragraph(
            f"No hay pedidos programados para entrega el {display_date}.",
            empty_sty))
    else:
        # Group: institution → product → exact_size → list of (receipt_num, qty, client)
        grouped = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
        for row in rows:
            grouped[row["institution"]][row["product"]][str(row["exact_size"])].append({
                "receipt": row["receipt_number"],
                "qty":     row["quantity"],
                "client":  row["client_name"] or "(Sin nombre)",
                "phone":   row["client_phone"] or "—",
                "pm":      row["payment_method"] or "Efectivo",
            })

        sub_sty  = ParagraphStyle('SubSty', fontName='Helvetica-Bold',
                                   fontSize=9, textColor=GRAY, leftIndent=8, spaceBefore=6)

        def size_key(s):
            try: return int(s)
            except: return 999

        for inst_name, prods in sorted(grouped.items()):
            block = []
            _school_header(block, inst_name)

            for prod_name, sizes in sorted(prods.items()):
                total_prod = sum(sum(e["qty"] for e in entries)
                                 for entries in sizes.values())
                block.append(Paragraph(
                    f"▸  {prod_name}  <font size='8' color='#6C757D'>(Total: {total_prod} und.)</font>",
                    sub_sty))

                tbl_data = [["Talla", "Recibo N°", "Niño/a", "Cant.", "Pago"]]
                for size, entries in sorted(sizes.items(), key=lambda x: size_key(x[0])):
                    for e in entries:
                        pm_icon = "💵" if e["pm"] == "Efectivo" else "📲"
                        tbl_data.append([
                            size, e["receipt"], e["client"],
                            str(e["qty"]), pm_icon,
                        ])

                pt = _section_table(tbl_data,
                                     [0.7*inch, 0.8*inch, 2.5*inch, 0.5*inch, 0.5*inch])
                block.append(Spacer(1, 0.04*inch))
                block.append(pt)
                block.append(Spacer(1, 0.1*inch))

            block.append(Spacer(1, 0.2*inch))
            story.append(KeepTogether(block) if len(block) < 30 else block)

    _footer(story, f"ML Uniformes — Consolidado de Entrega {display_date} — {_date_label()}")
    doc.build(story)
    return filename


# ── PDF: Hoja de Ruta — Pedidos del Día ───────────────────────────────────────
def generate_hoja_ruta(db_path: str) -> str:
    """Hoja de Ruta logística: pedidos capturados HOY, agrupados por colegio, sin precios."""
    today = datetime.now().strftime("%Y-%m-%d")
    delivery_target = _add_business_days(datetime.now(), 15)
    delivery_str = delivery_target.strftime("%d/%m/%Y")
    capture_str  = datetime.now().strftime("%d/%m/%Y")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT r.id, r.receipt_number, r.client_name,
               i.name AS inst_name
        FROM receipts r
        JOIN institutions i ON r.institution_id = i.id
        WHERE r.deleted_at IS NULL
          AND DATE(r.created_at) = ?
        ORDER BY i.name, r.receipt_number
    """, (today,))
    rows = cur.fetchall()
    conn.close()

    filename = os.path.join(BASE_DIR, f"hoja_ruta_{today}.pdf")
    doc = SimpleDocTemplate(filename, pagesize=letter,
                            leftMargin=0.6*inch, rightMargin=0.6*inch,
                            topMargin=0.5*inch, bottomMargin=0.5*inch)
    story = []
    _build_header(story,
                  "Logística de Pedidos Diarios",
                  f"Captura: {capture_str}   |   Entrega estimada: {delivery_str}")

    # Meta bar
    meta_sty = ParagraphStyle('Meta', fontName='Helvetica', fontSize=9,
                               textColor=GRAY_DARK, spaceBefore=4, spaceAfter=8)
    story.append(Paragraph(
        f"Pedidos tomados el <b>{capture_str}</b> — Fecha estimada de entrega: "
        f"<b>{delivery_str}</b> (+15 días hábiles)", meta_sty))

    if not rows:
        nd = ParagraphStyle('ND', fontName='Helvetica', fontSize=11,
                            textColor=GRAY_DARK, alignment=1)
        story.append(Spacer(1, 0.5*inch))
        story.append(Paragraph("No se registraron pedidos hoy.", nd))
    else:
        grouped = defaultdict(list)
        for r in rows:
            grouped[r["inst_name"]].append(r)

        for inst_name, recs in sorted(grouped.items()):
            _school_header(story, inst_name)
            data = [["N° Recibo", "Nombre del Niño/a"]]
            for r in recs:
                data.append([r["receipt_number"], r["client_name"] or "—"])
            # Count row
            data.append(["", f"Total: {len(recs)} pedido(s)"])
            t = Table(data, colWidths=[1.2*inch, 5.3*inch])
            t.setStyle(TableStyle([
                ('BACKGROUND',    (0, 0), (-1, 0), VINO),
                ('TEXTCOLOR',     (0, 0), (-1, 0), BEIGE),
                ('FONTNAME',      (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE',      (0, 0), (-1, 0), 9),
                ('TOPPADDING',    (0, 0), (-1, 0), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('FONTNAME',      (0, 1), (-1, -2), 'Helvetica'),
                ('FONTSIZE',      (0, 1), (-1, -2), 9),
                ('ROWBACKGROUNDS', (0, 1), (-1, -2), [WHITE, LIGHT_GRAY]),
                ('TOPPADDING',    (0, 1), (-1, -2), 6),
                ('BOTTOMPADDING', (0, 1), (-1, -2), 6),
                ('BACKGROUND',    (0, -1), (-1, -1), AMBER_SOFT),
                ('FONTNAME',      (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE',      (0, -1), (-1, -1), 8),
                ('ALIGN',         (-1, -1), (-1, -1), 'RIGHT'),
                ('GRID',          (0, 0), (-1, -1), 0.4, colors.HexColor("#CED4DA")),
            ]))
            story.append(KeepTogether(t))
            story.append(Spacer(1, 0.2*inch))

    story.append(Spacer(1, 0.1*inch))
    story.append(HRFlowable(color=VINO, thickness=1))
    story.append(Spacer(1, 0.08*inch))
    total_sty = ParagraphStyle('T', fontName='Helvetica-Bold', fontSize=10,
                                textColor=VINO, alignment=TA_RIGHT)
    story.append(Paragraph(f"Total pedidos de hoy: {len(rows)}", total_sty))
    _footer(story, f"ML Uniformes — Hoja de Ruta {capture_str} — {_date_label()}")
    doc.build(story)
    return filename


# ── PDF: Planilla de Producción Detallada ──────────────────────────────────────
def generate_planilla_produccion(db_path: str) -> str:
    """Planilla para el taller: colegio → recibo → niño → lista de prendas. Sin precios."""
    today_str = datetime.now().strftime("%d/%m/%Y")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    # Fetch all active receipts with their items
    cur.execute("""
        SELECT r.id, r.receipt_number, r.client_name,
               i.name AS inst_name,
               p.name AS product, ri.size_range, ri.exact_size, ri.quantity
        FROM receipts r
        JOIN institutions i ON r.institution_id = i.id
        JOIN receipt_items ri ON ri.receipt_id = r.id
        JOIN products p ON ri.product_id = p.id
        WHERE r.deleted_at IS NULL
        ORDER BY i.name, r.receipt_number, p.name
    """)
    rows = cur.fetchall()
    conn.close()

    filename = os.path.join(BASE_DIR, f"planilla_produccion_{datetime.now().strftime('%Y%m%d')}.pdf")
    doc = SimpleDocTemplate(filename, pagesize=letter,
                            leftMargin=0.6*inch, rightMargin=0.6*inch,
                            topMargin=0.5*inch, bottomMargin=0.5*inch)
    story = []
    delivery_target = _add_business_days(datetime.now(), 15).strftime("%d/%m/%Y")
    _build_header(story, "Planilla de Producción Detallada",
                  f"Generada: {today_str}",
                  delivery_date=delivery_target)

    if not rows:
        nd = ParagraphStyle('ND', fontName='Helvetica', fontSize=11,
                            textColor=GRAY_DARK, alignment=1)
        story.append(Spacer(1, 0.5*inch))
        story.append(Paragraph("No hay pedidos activos.", nd))
    else:
        # Group by institution → receipt(id)
        from collections import OrderedDict
        inst_map = defaultdict(OrderedDict)
        for r in rows:
            key_receipt = (r["id"], r["receipt_number"], r["client_name"])
            inst_map[r["inst_name"]][key_receipt] = inst_map[r["inst_name"]].get(key_receipt, [])
            inst_map[r["inst_name"]][key_receipt].append({
                "product": r["product"],
                "size_range": r["size_range"] or "",
                "exact_size": r["exact_size"] or "",
                "quantity": r["quantity"],
            })

        for inst_name, receipts in sorted(inst_map.items()):
            _school_header(story, inst_name)
            block = []
            for (rid, rnum, client), items in receipts.items():
                # Receipt sub-header
                rh_sty = ParagraphStyle('RH', fontName='Helvetica-Bold', fontSize=9,
                                        textColor=GRAY, spaceBefore=6, spaceAfter=2)
                block.append(Paragraph(
                    f"Recibo N° <b>{rnum}</b>  —  {client or '(Sin nombre)'}", rh_sty))
                # Items mini-table
                item_data = [["Prenda", "Talla", "Cant."]]
                for it in items:
                    talla = it['exact_size'] or it['size_range'] or "\u00danica"
                    item_data.append([it["product"], talla, str(it["quantity"])])
                it_t = Table(item_data, colWidths=[2.8*inch, 2.5*inch, 1.2*inch])
                it_t.setStyle(TableStyle([
                    ('BACKGROUND',    (0, 0), (-1, 0), VINO),
                    ('TEXTCOLOR',     (0, 0), (-1, 0), BEIGE),
                    ('FONTNAME',      (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE',      (0, 0), (-1, 0), 8),
                    ('TOPPADDING',    (0, 0), (-1, 0), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
                    ('FONTNAME',      (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE',      (0, 1), (-1, -1), 8),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
                    ('TOPPADDING',    (0, 1), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
                    ('ALIGN',         (-1, 0), (-1, -1), 'CENTER'),
                    ('GRID',          (0, 0), (-1, -1), 0.3, colors.HexColor("#CED4DA")),
                ]))
                block.append(it_t)
                block.append(Spacer(1, 0.1*inch))

            story.append(KeepTogether(block) if len(block) < 40 else block)
            story.append(Spacer(1, 0.15*inch))

    _footer(story, f"ML Uniformes — Planilla de Producción — {_date_label()}")
    doc.build(story)
    return filename


# ── PDF: Orden de Producción Consolidada ──────────────────────────────────────

