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
    try:
        return f"$ {float(n):,.0f}".replace(",", ".")
    except (TypeError, ValueError):
        return "$ 0"

def _date_label():
    return datetime.now().strftime("%d/%m/%Y %H:%M")

def _build_header(story, subtitle, date_range="", delivery_date=""):
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
        subheader = Table([
            [Paragraph(subtitle, sub_style), Paragraph(generated_label, date_style)],
            [Paragraph(f"📦  Fecha de Entrega Estimada: <b>{delivery_date}</b>", delivery_style), ""]
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
            [Paragraph(subtitle, sub_style), Paragraph(generated_label, date_style)]
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
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN',         (0, 0), (-2, -1), 'LEFT'),
        ('ALIGN',         (-1, 0), (-1, -1), 'RIGHT'),
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


# ── DATA FETCHING ────────────────────────────────────────────────────────────
def _fetch_all_data(db):
    receipts_dict = {}
    
    docs = db.collection('receipts').stream()
    for doc in docs:
        d = doc.to_dict()
        if d.get('status') == 'Anulado' or d.get('deleted_at') is not None:
            continue
        d['id'] = doc.id
        d['items'] = []
        d['payments'] = []
        
        # calculate derived fields
        d['receipt_number'] = str(d.get('receipt_number', '')).zfill(3)
        total = float(d.get('total_amount', 0))
        balance = float(d.get('balance', total))
        d['total'] = total
        d['balance'] = max(0, balance)
        d['total_paid'] = total - d['balance']
        
        receipts_dict[doc.id] = d
        
    items = db.collection_group('items').stream()
    for item in items:
        rid = item.reference.parent.parent.id
        if rid in receipts_dict:
            receipts_dict[rid]['items'].append(item.to_dict())
            
    payments = db.collection_group('payments').stream()
    for pay in payments:
        rid = pay.reference.parent.parent.id
        if rid in receipts_dict:
            receipts_dict[rid]['payments'].append(pay.to_dict())
            
    return list(receipts_dict.values())

def _in_colombia_day(iso_string, target_date_str):
    if not iso_string or not target_date_str: return False
    try:
        iso_clean = iso_string.replace('Z', '')
        if '.' in iso_clean:
            dt = datetime.strptime(iso_clean, '%Y-%m-%dT%H:%M:%S.%f')
        else:
            dt = datetime.strptime(iso_clean, '%Y-%m-%dT%H:%M:%S')
        dt_col = dt - timedelta(hours=5)
        return dt_col.strftime('%Y-%m-%d') == target_date_str
    except Exception:
        return False

def _get_pending_pieces(item):
    """
    Rinde (nombre_pieza, talla, cantidad_multiplicada)
    solo para las prendas que falten fabricar.
    Si el item es un Kit, desglosa 'piezas' ignorando las 'Entregadas'.
    """
    piezas = item.get('piezas', [])
    qty = int(item.get('quantity', 1))
    size_raw = item.get('exact_size') or item.get('size_range') or 'Única'
    
    if piezas:
        for pz in piezas:
            if pz.get('estado') == 'Pendiente':
                cust_size = pz.get('tallaPersonalizada', '').strip()
                final_size = f"{size_raw} ({cust_size})" if cust_size else size_raw
                yield pz.get('nombre'), final_size, qty
    else:
        # Prenda simple
        prod = item.get('product_name', 'Prenda')
        if 'Kit' not in prod and 'Diario' not in prod.split():
            # Ensure we only return it if it's not a generic name
            yield prod, size_raw, qty
        else:
            yield prod, size_raw, qty



# ── REPORTS GENERATION ───────────────────────────────────────────────────────
def generate_sales_report(db, date_str=None, period=None):
    now = datetime.now()
    if period == 'weekly':
        start_date = now - timedelta(days=7)
        end_date = now
        date_range_str = f"({start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')})"
        title = f"Reporte de Ventas — Efectivo Recaudado\nSemanal {date_range_str}"
        filename_prefix = "sales_report_weekly"
        empty_msg = f"No se registraron abonos en la semana del {start_date.strftime('%d/%m/%Y')} al {end_date.strftime('%d/%m/%Y')}."
    elif period == 'monthly':
        start_date = now - timedelta(days=30)
        end_date = now
        date_range_str = f"({start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')})"
        title = f"Reporte de Ventas — Efectivo Recaudado\nMensual {date_range_str}"
        filename_prefix = "sales_report_monthly"
        empty_msg = f"No se registraron abonos en el mes del {start_date.strftime('%d/%m/%Y')} al {end_date.strftime('%d/%m/%Y')}."
    elif period == 'annual':
        start_date = now - timedelta(days=365)
        end_date = now
        date_range_str = f"({start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')})"
        title = f"Reporte de Ventas — Efectivo Recaudado\nAnual {date_range_str}"
        filename_prefix = "sales_report_annual"
        empty_msg = f"No se registraron abonos en el año del {start_date.strftime('%d/%m/%Y')} al {end_date.strftime('%d/%m/%Y')}."
    else:
        if date_str is None:
            now_col = datetime.utcnow() - timedelta(hours=5)
            date_str = now_col.strftime("%Y-%m-%d")
        start_date = datetime.strptime(date_str, "%Y-%m-%d")
        end_date = start_date
        title = f"Reporte de Ventas — Efectivo Recaudado\nHoy ({start_date.strftime('%d/%m/%Y')})"
        filename_prefix = f"sales_report_{date_str}"
        empty_msg = f"No se registraron abonos el {start_date.strftime('%d/%m/%Y')}."

    start_date_str = start_date.strftime("%Y-%m-%d")
    end_date_str = end_date.strftime("%Y-%m-%d")

    data = _fetch_all_data(db)
    
    grouped = defaultdict(list)
    for r in data:
        for p in r['payments']:
            p_date_iso = p.get('created_at', '')
            
            include_payment = False
            if not period:
                include_payment = _in_colombia_day(p_date_iso, start_date_str)
            else:
                p_date = str(p_date_iso).split('T')[0]
                include_payment = start_date_str <= p_date <= end_date_str
                
            if include_payment:
                grouped[r.get('institution_name', 'Desconocida')].append({
                    'receipt_number': r['receipt_number'],
                    'client_name': r.get('client_name'),
                    'client_phone': r.get('client_phone'),
                    'delivery_date': r.get('delivery_date'),
                    'paid_amount': float(p.get('amount', 0)),
                    'pay_method': p.get('payment_method', 'Efectivo')
                })

    filename = os.path.join(BASE_DIR, f"{filename_prefix}.pdf")
    doc = SimpleDocTemplate(filename, pagesize=letter, leftMargin=0.6*inch, rightMargin=0.6*inch, topMargin=0.5*inch, bottomMargin=0.5*inch)
    story = []
    _build_header(story, title, f"Generado: {now.strftime('%d/%m/%Y')}")

    total_dia = total_efectivo = total_transferencia = 0.0

    if not grouped:
        story.append(Spacer(1, 0.5*inch))
        no_data = ParagraphStyle('ND', fontName='Helvetica', fontSize=11, textColor=GRAY_DARK, alignment=1)
        story.append(Paragraph(empty_msg, no_data))
    else:
        for inst_name, recs in sorted(grouped.items()):
            _school_header(story, inst_name)
            t_data = [["N°", "Niño/a", "Teléfono", "Método de Pago", "Entrega Est.", "Abonado Hoy"]]
            subtotal = 0.0
            
            # sort by receipt_number
            recs.sort(key=lambda x: str(x['receipt_number']))
            
            for r in recs:
                pm = r["pay_method"]
                pm_icon = "💵 Efectivo" if pm == "Efectivo" else "📲 Transf."
                t_data.append([
                    r["receipt_number"],
                    r["client_name"] or "(Sin nombre)",
                    r["client_phone"] or "—",
                    pm_icon,
                    r["delivery_date"] or "—",
                    _fmt(r["paid_amount"]),
                ])
                subtotal += r["paid_amount"]
                if pm == "Efectivo": total_efectivo += r["paid_amount"]
                else: total_transferencia += r["paid_amount"]
                
            t_data.append(["", "", "", "", "SUBTOTAL:", _fmt(subtotal)])
            total_dia += subtotal

            t = _section_table(t_data, [0.45*inch, 1.8*inch, 1.1*inch, 1.1*inch, 1.0*inch, 1.0*inch])
            t.setStyle(TableStyle([
                ('SPAN',       (0, -1), (4, -1)),
                ('BACKGROUND', (0, -1), (-1, -1), LIGHT_GRAY),
                ('FONTNAME',   (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('ALIGN',      (-1, -1), (-1, -1), 'RIGHT'),
            ]))
            story.append(KeepTogether(t))
            story.append(Spacer(1, 0.2 * inch))

    story.append(Spacer(1, 0.1 * inch))
    story.append(HRFlowable(color=VINO, thickness=2))
    summ_title = ParagraphStyle('SummT', fontName='Helvetica-Bold', fontSize=12, textColor=VINO, spaceBefore=8, alignment=TA_CENTER)
    story.append(Paragraph("Resumen Financiero del Período", summ_title))
    summ_data = [ ["Concepto", "Total"], ["💵  Abonos en Efectivo", _fmt(total_efectivo)],
                  ["📲  Abonos por Transferencia", _fmt(total_transferencia)], ["TOTAL RECAUDADO", _fmt(total_dia)] ]
    summ_t = Table(summ_data, colWidths=[4.5*inch, 2.0*inch])
    summ_t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), VINO), ('TEXTCOLOR', (0, 0), (-1, 0), BEIGE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, 1), GREEN_SOFT), ('BACKGROUND', (0, 2), (-1, 2), AMBER_SOFT),
        ('BACKGROUND', (0, 3), (-1, 3), VINO_DARK), ('TEXTCOLOR', (0, 3), (-1, 3), BEIGE),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica-Bold'), ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'), ('TOPPADDING', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 9), ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CED4DA")),
    ]))
    story.append(summ_t)
    _footer(story)
    doc.build(story)
    return filename

def generate_planilla_produccion(db, date_str=None):
    data = _fetch_all_data(db)
    
    # Consolidado global de piezas NO entregadas agrupadas por colegio
    grouped = defaultdict(lambda: defaultdict(int)) # {institucion: {(producto, talla): qty}}
    
    for r in data:
        if r.get('status') == 'Entregado': continue
        if date_str and not _in_colombia_day(r.get('created_at'), date_str): continue
        
        inst = r.get('institution_name', 'Desconocida')
        for it in r['items']:
            for p_name, s_name, qty in _get_pending_pieces(it):
                grouped[inst][(p_name, s_name)] += qty

    # Extraer la fecha de entrega del primer pedido pendiente
    global_delivery = ""
    for r in data:
        if date_str and not _in_colombia_day(r.get('created_at'), date_str): continue
        if r.get('status') != 'Entregado' and r.get('delivery_date'):
            global_delivery = r['delivery_date']
            break
    if not global_delivery: global_delivery = "N/A"

    filename = os.path.join(BASE_DIR, f"planilla_produccion_{datetime.now().strftime('%Y%m%d')}.pdf")
    doc = SimpleDocTemplate(filename, pagesize=letter, leftMargin=0.6*inch, rightMargin=0.6*inch, topMargin=0.5*inch, bottomMargin=0.5*inch)
    story = []
    _build_header(story, "Planilla de Producción Taller", delivery_date=global_delivery)
    
    # Titulo de Fecha Global destacado
    title_style = ParagraphStyle('TitleDate', fontName='Helvetica-Bold', fontSize=12, textColor=VINO, alignment=TA_CENTER)
    story.append(Paragraph(f"Fecha de Entrega Estimada: {global_delivery}", title_style))
    story.append(Spacer(1, 0.2*inch))

    if not grouped:
        story.append(Paragraph("No hay prendas pendientes para producir en todo el sistema.", ParagraphStyle('ND', textColor=GRAY_DARK, alignment=TA_CENTER)))
    else:
        for inst, pend_items in sorted(grouped.items()):
            _school_header(story, inst)
            t_data = [["Producto a Fabricar", "Talla", "Cantidad"]]
            for (p_name, s_name), qty in sorted(pend_items.items(), key=lambda x: (x[0][0], x[0][1])):
                t_data.append([p_name, s_name, str(qty)])
                
            t = _section_table(t_data, [4.0*inch, 2.0*inch, 1.5*inch])
            story.append(KeepTogether(t))
            story.append(Spacer(1, 0.1*inch))
            
    _footer(story)
    doc.build(story)
    return filename

def generate_delivery_consolidation(db, date_str=None):
    if not date_str: date_str = datetime.now().strftime("%d/%m/%Y")
    data = _fetch_all_data(db)
    
    grouped = defaultdict(list)
    for r in data:
        if r.get('delivery_date') == date_str:
            grouped[r.get('institution_name', 'Desconocida')].append(r)

    filename = os.path.join(BASE_DIR, f"delivery_consolidation_{date_str.replace('/','-')}.pdf")
    doc = SimpleDocTemplate(filename, pagesize=letter, leftMargin=0.5*inch, rightMargin=0.5*inch, topMargin=0.5*inch, bottomMargin=0.5*inch)
    story = []
    _build_header(story, "Consolidado de Entregas y Saldos", delivery_date=date_str)

    if not grouped:
        story.append(Paragraph(f"No hay pedidos programados para entregar el {date_str}.", ParagraphStyle('ND', textColor=GRAY_DARK, alignment=TA_CENTER)))
    else:
        total_balance = 0.0
        for inst, recs in sorted(grouped.items()):
            _school_header(story, inst)
            t_data = [["Recibo", "Cliente", "Teléfono", "Prendas", "Saldo Pdt."]]
            inst_balance = 0.0
            recs.sort(key=lambda x: x['receipt_number'])
            
            for r in recs:
                bal = float(r.get('balance', 0))
                prendas = ", ".join([f"{it.get('quantity')}x {it.get('product_name')}" for it in r['items']])
                t_data.append([r['receipt_number'], r.get('client_name') or '—', r.get('phone') or '—', prendas, _fmt(bal)])
                inst_balance += bal
                total_balance += bal
                
            t_data.append(["", "", "", "SUBTOTAL RECAUDO EN COLEGIO:", _fmt(inst_balance)])
            t = _section_table(t_data, [0.6*inch, 1.5*inch, 1*inch, 3*inch, 1.4*inch])
            t.setStyle(TableStyle([
                ('SPAN',       (0, -1), (3, -1)),
                ('BACKGROUND', (0, -1), (-1, -1), LIGHT_GRAY),
                ('FONTNAME',   (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('ALIGN',      (-1, -1), (-1, -1), 'RIGHT'),
            ]))
            story.append(KeepTogether(t))
            story.append(Spacer(1, 0.2*inch))
            
        story.append(Spacer(1, 0.2 * inch))
        story.append(HRFlowable(color=VINO, thickness=2))
        story.append(Paragraph(f"<b>GRAN TOTAL SALDOS A RECAUDAR:</b> <font color='red'>{_fmt(total_balance)}</font>", 
                               ParagraphStyle('Tot', fontSize=14, alignment=TA_RIGHT, spaceBefore=10)))
        
    _footer(story)
    doc.build(story)
    return filename

def generate_logistics_report(db):
    data = _fetch_all_data(db)
    
    # Resumen de artículos pendientes categorizados por colegio
    grouped = defaultdict(int)
    for r in data:
        if r.get('status') == 'Entregado': continue
        inst = r.get('institution_name', 'Desconocida')
        del_date = r.get('delivery_date') or '—'
        for it in r['items']:
            for p_name, s_name, qty in _get_pending_pieces(it):
                grouped[(inst, p_name, del_date)] += qty

    filename = os.path.join(BASE_DIR, f"logistics_{datetime.now().strftime('%Y-%m-%d')}.pdf")
    doc = SimpleDocTemplate(filename, pagesize=letter, leftMargin=0.6*inch, rightMargin=0.6*inch, topMargin=0.5*inch, bottomMargin=0.5*inch)
    story = []
    _build_header(story, "Reporte Logístico — Prendas Pendientes por Colegio")

    if not grouped:
        story.append(Paragraph("No hay prendas pendientes.", ParagraphStyle('ND', textColor=GRAY_DARK, alignment=TA_CENTER)))
    else:
        # Group by inst
        by_inst = defaultdict(list)
        for (inst, prod, del_date), qty in grouped.items():
            by_inst[inst].append((prod, qty, del_date))
            
        for inst, prods in sorted(by_inst.items()):
            _school_header(story, inst)
            t_data = [["Producto", "Cantidad Pendiente", "Entrega Est."]]
            for prod, qty, del_date in sorted(prods, key=lambda x: (x[0], x[2])):
                t_data.append([prod, str(qty), del_date])
            t = _section_table(t_data, [3*inch, 1.5*inch, 1.5*inch])
            story.append(KeepTogether(t))
            story.append(Spacer(1, 0.2*inch))
            
    _footer(story)
    doc.build(story)
    return filename

def generate_hoja_ruta(db, date_str=None):
    data = _fetch_all_data(db)
    
    grouped = defaultdict(list)
    
    for r in data:
        if r.get('status') == 'Entregado': continue
        if date_str and not _in_colombia_day(r.get('created_at'), date_str): continue
        
        items_detail = []
        for it in r['items']:
            prod_name = it.get('product_name', 'Prenda')
            qty = int(it.get('quantity', 1))
            size = it.get('exact_size') or it.get('size_range') or 'Única'
            piezas = it.get('piezas', [])
            
            if piezas:
                def p_str(p):
                    return f"{p['nombre']} [{p['tallaPersonalizada']}]" if p.get('tallaPersonalizada', '').strip() else p['nombre']
                
                entregadas = [p_str(p) for p in piezas if p.get('estado') == 'Entregado']
                pendientes = [p_str(p) for p in piezas if p.get('estado') == 'Pendiente']
                
                if not pendientes: continue # Todas entregadas, saltar este item
                
                desc_parts = []
                if entregadas: desc_parts.append(f"Se entregó {', '.join(entregadas).upper()}")
                if pendientes: desc_parts.append(f"NO se entregó {', '.join(pendientes).upper()}")
                
                desc = " / ".join(desc_parts)
                items_detail.append(Paragraph(f"<b>{qty}x {prod_name}</b> (Talla {size})<br/><i><font color='#555555'>{desc}</font></i>", ParagraphStyle('Normal')))
            else:
                if it.get('status') == 'Entregado': continue
                items_detail.append(Paragraph(f"<b>{qty}x {prod_name}</b> (Talla {size})<br/><i><font color='#555555'>NO se entregó {prod_name.upper()}</font></i>", ParagraphStyle('Normal')))

        if items_detail:
            grouped[r.get('institution_name', 'Desconocida')].append({
                'receipt_number': r['receipt_number'],
                'detail': items_detail
            })

    global_delivery = ""
    for r in data:
        if date_str and not _in_colombia_day(r.get('created_at'), date_str): continue
        if r.get('status') != 'Entregado' and r.get('delivery_date'):
            global_delivery = r['delivery_date']
            break
    if not global_delivery: global_delivery = "N/A"

    filename = os.path.join(BASE_DIR, f"hoja_ruta_{datetime.now().strftime('%Y-%m-%d')}.pdf")
    doc = SimpleDocTemplate(filename, pagesize=letter, leftMargin=0.6*inch, rightMargin=0.6*inch, topMargin=0.5*inch, bottomMargin=0.5*inch)
    story = []
    _build_header(story, "Hoja de Ruta", delivery_date=global_delivery)

    if not grouped:
        story.append(Paragraph("No hay entregas pendientes para fabricar.", ParagraphStyle('ND', textColor=GRAY_DARK, alignment=TA_CENTER)))
    else:
        for inst, recs in sorted(grouped.items()):
            _school_header(story, inst)
            t_data = [["N° Recibo", "Detalle de Entregas"]]
            
            recs.sort(key=lambda x: str(x['receipt_number']))
            
            for r in recs:
                t_data.append([r['receipt_number'], r['detail']])
            
            t = _section_table(t_data, [1.5*inch, 6.0*inch])
            story.append(t)
            story.append(Spacer(1, 0.2*inch))
            
    _footer(story)
    doc.build(story)
    return filename
