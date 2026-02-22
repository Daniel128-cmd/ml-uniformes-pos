/**
 * app.js — Lógica principal del POS ML Pedidos
 *
 * Módulos:
 *   1. Estado de la aplicación
 *   2. Render: instituciones, catálogo, carrito
 *   3. Modal de talla
 *   4. Carrito: agregar, quitar, cambiar cantidad
 *   5. Modal de recibo y numeración por institución
 *   6. Búsqueda y filtros
 *   7. Inicialización
 */

/**
 * Calcula la fecha de entrega estimada: hoy + 15 días hábiles (lun–vie).
 * @returns {string} DD/MM/YYYY
 */
function calcularFechaEntrega15DiasHabiles() {
    let current = new Date();
    let added = 0;
    while (added < 15) {
        current.setDate(current.getDate() + 1);
        const dow = current.getDay(); // 0=Dom, 6=Sáb
        if (dow !== 0 && dow !== 6) added++;
    }
    const dd = String(current.getDate()).padStart(2, '0');
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const yyyy = current.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

/* ═══════════════════════════════════════════════
   1. ESTADO GLOBAL
═══════════════════════════════════════════════ */
const STATE = {
    institucionId: null,   // id de la institución seleccionada
    filtroCategoria: 'todo', // categoría activa en el filtro
    busqueda: '',     // texto de búsqueda
    cart: [],     // [{ productoId, nombre, talla, precio, cantidad }]

    // Modal de talla
    productoActual: null,   // objeto producto del catálogo
    tallaSeleccionada: null,  // string de rango seleccionado
    tallaExactaSeleccionada: null, // string de la talla específica final
    modalCantidad: 1,
};

/* ═══════════════════════════════════════════════
   2. HELPERS: DOM y formato
═══════════════════════════════════════════════ */
/** Obtiene un elemento del DOM por ID */
const $ = id => document.getElementById(id);

/** Formatea número como precio colombiano */
const fmt = n => '$ ' + n.toLocaleString('es-CO');

/** Precio mínimo de un producto (primera talla disponible) */
function precioMinimo(producto) {
    const valores = Object.values(producto.tallas);
    return Math.min(...valores);
}

/** Fecha actual formateada DD/MM/AAAA HH:MM */
function fechaActual() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Calcula fecha de entrega sumando N días hábiles (L-V) a una fecha de inicio.
 * Si el resultado cae en sábado o domingo, lo avanza al lunes siguiente.
 * @param {Date} fechaInicio
 * @param {number} diasHabiles - por defecto 15
 * @returns {string} DD/MM/YYYY
 */
function calcularFechaEntrega(fechaInicio = new Date(), diasHabiles = 15) {
    const fecha = new Date(fechaInicio);
    let contados = 0;
    while (contados < diasHabiles) {
        fecha.setDate(fecha.getDate() + 1);
        const dia = fecha.getDay(); // 0=Dom, 6=Sab
        if (dia !== 0 && dia !== 6) contados++;
    }
    // Si cayó en sábado, avanzar a lunes
    if (fecha.getDay() === 6) fecha.setDate(fecha.getDate() + 2);
    if (fecha.getDay() === 0) fecha.setDate(fecha.getDate() + 1);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(fecha.getDate())}/${pad(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
}

/** Retorna un arreglo de tallas exactas basado en un rango */
function obtenerTallasExactas(rangoTalla) {
    const str = rangoTalla.toLowerCase();
    if (str.includes('2-6')) return ['2', '4', '6'];
    if (str.includes('4-12')) return ['4', '6', '8', '10', '12'];
    if (str.includes('8-12')) return ['8', '10', '12'];
    if (str.includes('14-16')) return ['14', '16'];
    if (str.includes('xs-s')) return ['XS', 'S'];
    if (str.includes('m-l')) return ['M', 'L'];
    if (str.includes('xl-xxl')) return ['XL', 'XXL'];
    if (str.includes('xs-l')) return ['XS', 'S', 'M', 'L'];
    // Fallback por si la talla ya es única o no se encuentra en la lista
    return [rangoTalla.replace(/tdalla|diario|deportivo|kit|feme|masc/gi, '').trim() || rangoTalla];
}

/* ═══════════════════════════════════════════════
   3. RENDER INSTITUCIONES
═══════════════════════════════════════════════ */
function renderInstituciones() {
    const container = $('inst-selector');
    container.innerHTML = '';

    INSTITUCIONES.forEach(inst => {
        const btn = document.createElement('button');
        btn.className = 'inst-btn' + (inst.id === STATE.institucionId ? ' active' : '');
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', inst.id === STATE.institucionId ? 'true' : 'false');
        btn.dataset.id = inst.id;

        // Iniciales para el icono
        const initials = inst.nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
        btn.innerHTML = `<span class="inst-icon">${initials}</span>${inst.nombre}`;

        btn.addEventListener('click', () => seleccionarInstitucion(inst.id));
        container.appendChild(btn);
    });
}

/* ═══════════════════════════════════════════════
   4. SELECCIÓN DE INSTITUCIÓN
═══════════════════════════════════════════════ */
function seleccionarInstitucion(id) {
    STATE.institucionId = id;
    STATE.busqueda = '';
    STATE.filtroCategoria = 'todo';
    $('search-input').value = '';

    // Reset filtro activo
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.cat === 'todo');
        tab.setAttribute('aria-selected', tab.dataset.cat === 'todo' ? 'true' : 'false');
    });

    // Actualiza SOLO el span de nombre — nunca sobrescribe el botón Admin
    const inst = getInstitucion(id);
    $('topbar-inst-name').textContent = inst.nombre;
    $('btn-deselect-inst').style.display = 'inline-flex';

    renderInstituciones();
    renderCatalogo();
}

function deseleccionarInstitucion() {
    STATE.institucionId = null;
    STATE.busqueda = '';
    STATE.filtroCategoria = 'todo';
    STATE.cart = [];
    $('search-input').value = '';
    $('topbar-inst-name').textContent = 'Selecciona una institución';
    $('btn-deselect-inst').style.display = 'none';
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.cat === 'todo');
        tab.setAttribute('aria-selected', tab.dataset.cat === 'todo' ? 'true' : 'false');
    });
    renderInstituciones();
    renderCatalogo();
    renderCarrito();
}

/* ═══════════════════════════════════════════════
   5. RENDER CATÁLOGO
═══════════════════════════════════════════════ */
function renderCatalogo() {
    const grid = $('products-grid');
    grid.innerHTML = '';

    if (!STATE.institucionId) {
        grid.innerHTML = `
      <div class="empty-catalog">
        <div class="empty-icon">🏫</div>
        <p>Selecciona una institución</p>
        <span>Las prendas aparecerán aquí</span>
      </div>`;
        return;
    }

    const inst = getInstitucion(STATE.institucionId);
    let productos = inst.productos;

    // Filtrar por categoría
    if (STATE.filtroCategoria !== 'todo') {
        productos = productos.filter(p => p.categoria === STATE.filtroCategoria);
    }

    // Filtrar por búsqueda
    if (STATE.busqueda.trim()) {
        const q = STATE.busqueda.toLowerCase().trim();
        productos = productos.filter(p => p.nombre.toLowerCase().includes(q));
    }

    if (productos.length === 0) {
        grid.innerHTML = `
      <div class="empty-catalog">
        <div class="empty-icon">🔍</div>
        <p>Sin resultados</p>
        <span>Prueba con otra búsqueda o categoría</span>
      </div>`;
        return;
    }

    productos.forEach(producto => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('role', 'listitem');

        const minPrecio = precioMinimo(producto);
        const nTallas = Object.keys(producto.tallas).length;

        card.innerHTML = `
      <div class="product-info">
        <div class="product-name">${producto.nombre}</div>
        <div class="product-price-base">
          <span class="from">${nTallas > 1 ? 'Desde ' : ''}</span>${fmt(minPrecio)}
        </div>
      </div>
      <button
        class="btn-add-product"
        aria-label="Agregar ${producto.nombre} al carrito"
        data-id="${producto.id}"
      >+</button>
    `;

        card.querySelector('.btn-add-product').addEventListener('click', () => {
            abrirModalTalla(producto);
        });

        grid.appendChild(card);
    });
}

/* ═══════════════════════════════════════════════
   6. MODAL DE TALLA
═══════════════════════════════════════════════ */
function abrirModalTalla(producto) {
    STATE.productoActual = producto;
    STATE.tallaSeleccionada = null;
    STATE.tallaExactaSeleccionada = null;
    STATE.modalCantidad = 1;

    $('size-modal-product-name').textContent = producto.nombre;
    $('qty-modal-value').textContent = '1';
    $('size-price-display').innerHTML = 'Selecciona un rango para ver el precio';
    $('btn-modal-agregar').disabled = true;

    // Ocultar sección exacta al abrir
    $('exact-size-section').style.display = 'none';
    $('exact-size-pills').innerHTML = '';

    // Renderizar pills de tallas
    const pillsContainer = $('size-pills');
    pillsContainer.innerHTML = '';

    Object.entries(producto.tallas).forEach(([talla, precio]) => {
        const pill = document.createElement('button');
        pill.className = 'size-pill';
        pill.textContent = talla;
        pill.dataset.talla = talla;
        pill.dataset.precio = precio;
        pill.setAttribute('aria-pressed', 'false');

        pill.addEventListener('click', () => seleccionarTalla(talla, precio));
        pillsContainer.appendChild(pill);
    });

    // Mostrar el modal
    $('size-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function seleccionarTalla(talla, precio) {
    STATE.tallaSeleccionada = talla;
    STATE.tallaExactaSeleccionada = null;

    // Highlight de pill seleccionada
    document.querySelectorAll('#size-pills .size-pill').forEach(pill => {
        const isSelected = pill.dataset.talla === talla;
        pill.classList.toggle('selected', isSelected);
        pill.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    // Mostrar sub-sección de talla exacta
    const exactSection = $('exact-size-section');
    const exactContainer = $('exact-size-pills');
    exactContainer.innerHTML = '';
    exactSection.style.display = 'block';

    const exactas = obtenerTallasExactas(talla);
    exactas.forEach(exacta => {
        const pill = document.createElement('button');
        pill.className = 'size-pill';
        pill.textContent = exacta;
        pill.dataset.exacta = exacta;
        pill.addEventListener('click', () => seleccionarTallaExacta(exacta));
        exactContainer.appendChild(pill);
    });

    // Precio dinámico
    $('size-price-display').innerHTML = `Precio: <strong>${fmt(precio)}</strong>`;

    // Deshabilitar botón agregar porque falta la talla exacta
    $('btn-modal-agregar').disabled = true;
}

function seleccionarTallaExacta(exacta) {
    STATE.tallaExactaSeleccionada = exacta;

    document.querySelectorAll('#exact-size-pills .size-pill').forEach(pill => {
        const isSelected = pill.dataset.exacta === exacta;
        pill.classList.toggle('selected', isSelected);
    });

    // Habilitar botón agregar solo si ambas están seleccionadas
    if (STATE.tallaSeleccionada && STATE.tallaExactaSeleccionada) {
        $('btn-modal-agregar').disabled = false;
    }
}

function cerrarModalTalla() {
    $('size-modal').classList.add('hidden');
    document.body.style.overflow = '';
    STATE.productoActual = null;
    STATE.tallaSeleccionada = null;
    STATE.tallaExactaSeleccionada = null;
}

/* ═══════════════════════════════════════════════
   7. CARRITO
═══════════════════════════════════════════════ */
/** Agrega un ítem al carrito desde el modal de talla */
function agregarAlCarrito() {
    const producto = STATE.productoActual;
    const tallaRango = STATE.tallaSeleccionada;
    const exacta = STATE.tallaExactaSeleccionada;
    const cantidad = STATE.modalCantidad;
    const precio = producto.tallas[tallaRango];

    const tallaFinal = `${tallaRango} (Talla: ${exacta})`;
    // Clave única: productoId + talla rango + talla exacta
    const clave = `${producto.id}__${tallaRango}__${exacta}`;
    const existente = STATE.cart.find(i => i.clave === clave);

    if (existente) {
        existente.cantidad += cantidad;
    } else {
        STATE.cart.push({
            clave,
            productoId: producto.id,
            nombre: producto.nombre,
            talla: tallaFinal,
            tallaRango: tallaRango,
            tallaExacta: exacta,
            precio: precio,
            cantidad: cantidad
        });
    }

    cerrarModalTalla();
    renderCarrito();
    mostrarToast(`✓ ${producto.nombre} — Talla ${exacta} agregado`);
}

/** Elimina un ítem del carrito */
function eliminarDelCarrito(clave) {
    STATE.cart = STATE.cart.filter(i => i.clave !== clave);
    renderCarrito();
}

/** Cambia la cantidad de un ítem del carrito */
function cambiarCantidad(clave, delta) {
    const item = STATE.cart.find(i => i.clave === clave);
    if (!item) return;
    item.cantidad = Math.max(1, item.cantidad + delta);
    renderCarrito();
}

/** Renderiza la lista del carrito, badge, total */
function renderCarrito() {
    const container = $('cart-items');
    container.innerHTML = '';

    if (STATE.cart.length === 0) {
        container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p>Carrito vacío</p>
        <span>Agrega prendas del catálogo</span>
      </div>`;
        actualizarTotales();
        return;
    }

    STATE.cart.forEach(item => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.setAttribute('role', 'listitem');

        div.innerHTML = `
      <div class="cart-item-header">
        <div>
          <div class="cart-item-name">${item.nombre}</div>
          <span class="cart-item-talla">${item.talla}</span>
        </div>
        <button class="btn-remove-item" data-clave="${item.clave}" aria-label="Eliminar ${item.nombre}">✕</button>
      </div>
      <div class="cart-item-controls">
        <div class="qty-controls">
          <button class="qty-btn qty-minus-cart" data-clave="${item.clave}" aria-label="Disminuir cantidad">−</button>
          <span class="qty-value" aria-live="polite">${item.cantidad}</span>
          <button class="qty-btn qty-plus-cart" data-clave="${item.clave}" aria-label="Aumentar cantidad">+</button>
        </div>
        <span class="cart-item-price">${fmt(item.precio * item.cantidad)}</span>
      </div>
    `;

        // Eventos de cantidad y eliminar
        div.querySelector('.btn-remove-item').addEventListener('click', () => eliminarDelCarrito(item.clave));
        div.querySelector('.qty-minus-cart').addEventListener('click', () => cambiarCantidad(item.clave, -1));
        div.querySelector('.qty-plus-cart').addEventListener('click', () => cambiarCantidad(item.clave, +1));

        container.appendChild(div);
    });

    actualizarTotales();
}

/** Actualiza badge, conteo y total del carrito */
function actualizarTotales() {
    const totalUnidades = STATE.cart.reduce((s, i) => s + i.cantidad, 0);
    const totalPrecio = STATE.cart.reduce((s, i) => s + i.precio * i.cantidad, 0);

    $('cart-badge').textContent = totalUnidades;
    $('cart-total-items').textContent = totalUnidades;
    $('cart-total-value').textContent = fmt(totalPrecio);

    const btnGenerar = $('btn-generar-recibo');
    btnGenerar.disabled = STATE.cart.length === 0;
}

/* ═══════════════════════════════════════════════
   8. NUMERACIÓN DE RECIBOS POR INSTITUCIÓN
═══════════════════════════════════════════════ */
const RECEIPT_KEY_PREFIX = 'ml_recibo_num_';

/** Obtiene el siguiente número de recibo para la institución activa */
function siguienteNumeroRecibo(instId) {
    const key = RECEIPT_KEY_PREFIX + instId;
    const actual = parseInt(localStorage.getItem(key) || '0', 10);
    const siguiente = actual + 1;
    localStorage.setItem(key, String(siguiente));
    return String(siguiente).padStart(3, '0');
}

/* ═══════════════════════════════════════════════
   9. MODAL DE RECIBO
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   9. MODAL DE VISTA PREVIA (PASO A: CONFIRMACIÓN)
═══════════════════════════════════════════════ */

// Almacena el payload listo para enviar cuando el usuario confirme
STATE.pendingPayload = null;

function abrirVistaPrevia() {
    // ── Validación obligatoria de campos ──────────────────────
    const nombreVal = $('input-nombre').value.trim();
    const telVal = $('input-telefono').value.trim();
    const pagoVal = $('input-pago') ? $('input-pago').value : 'Efectivo';

    let hasError = false;
    const highlight = (id) => {
        const el = $(id);
        if (!el) return;
        el.style.borderColor = '#D93025';
        el.style.boxShadow = '0 0 0 3px rgba(217,48,37,.18)';
        setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 3000);
    };
    if (!nombreVal) { highlight('input-nombre'); hasError = true; }
    if (!telVal) { highlight('input-telefono'); hasError = true; }
    if (!pagoVal) { highlight('input-pago'); hasError = true; }
    if (hasError) {
        mostrarToast('⚠️ Nombre, Teléfono y Método de Pago son obligatorios', 'error');
        return;
    }
    if (STATE.cart.length === 0) {
        mostrarToast('El carrito está vacío');
        return;
    }
    // ── Validar mínimo 30% de abono ─────────────────────────────
    const _cartTotal = STATE.cart.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const _abonoRaw = parseFloat(($('input-abono')?.value || '0').replace(/\./g, '')) || 0;
    if (_cartTotal > 0 && _abonoRaw < _cartTotal * 0.30) {
        const _minimo = Math.ceil(_cartTotal * 0.30);
        highlight('input-abono');
        mostrarToast(`⚠️ El abono mínimo es el 30%: ${fmt(_minimo)}`, 'error');
        return;
    }
    const inst = INSTITUCIONES.find(i => i.id === STATE.institucionId);
    if (!inst) return;

    const nombreCliente = $('input-nombre').value.trim() || '(Sin nombre)';
    const telCliente = $('input-telefono').value.trim() || '—';
    const totalPrecio = STATE.cart.reduce((s, i) => s + i.precio * i.cantidad, 0);

    const pagoMetodo = pagoVal || 'Efectivo';
    const fechaEntrega = calcularFechaEntrega15DiasHabiles();
    const abonoEl = $('input-abono');
    // Strip dot-thousands separators before parsing (e.g. '45.000' → 45000)
    const abonoInicial = abonoEl ? Math.max(0, parseFloat((abonoEl.value || '0').replace(/\./g, '')) || 0) : 0;

    // Construir payload y guardarlo en STATE
    STATE.pendingPayload = {
        institucionId: STATE.institucionId,
        institucionNombre: inst.nombre,
        client_name: nombreCliente,
        client_phone: telCliente,
        total_amount: totalPrecio,
        delivery_date: fechaEntrega,
        payment_method: pagoMetodo,
        initial_payment: abonoInicial,
        items: STATE.cart.map(item => ({
            productoId: item.productoId,
            nombre: item.nombre,
            tallaRango: item.tallaRango,
            tallaExacta: item.tallaExacta,
            precio: item.precio,
            cantidad: item.cantidad
        }))
    };

    // Renderizar lista de prendas en el modal de vista previa
    const lista = $('preview-items-list');
    lista.innerHTML = '';
    STATE.cart.forEach(item => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `
            <div>
                <div class="preview-item-desc">${item.nombre}</div>
                <div class="preview-item-meta">${item.talla} &times; ${item.cantidad}</div>
            </div>
            <div style="font-weight:600">${fmt(item.precio * item.cantidad)}</div>
        `;
        lista.appendChild(div);
    });

    $('preview-total-display').textContent = fmt(totalPrecio);

    // Mostrar fecha de entrega calculada en la vista previa
    let prevDelivery = document.getElementById('preview-delivery-date');
    if (!prevDelivery) {
        prevDelivery = document.createElement('p');
        prevDelivery.id = 'preview-delivery-date';
        prevDelivery.style.cssText = 'text-align:center; font-size:13px; color:var(--gray-600); margin-bottom:12px;';
        $('preview-total-display').insertAdjacentElement('beforebegin', prevDelivery);
    }
    prevDelivery.textContent = `📅 Fecha estimada de entrega: ${fechaEntrega}`;

    $('preview-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// «Generar Recibo» ahora abre la vista previa, no guarda todavía
function generarRecibo() {
    abrirVistaPrevia();
}

// PASO B: El usuario confirma → guardar en el servidor
async function guardarPedidoConfirmado() {
    const payload = STATE.pendingPayload;
    if (!payload) return;

    // Cerrar preview y mostrar estado de carga
    $('preview-modal').classList.add('hidden');
    document.body.style.overflow = '';

    const btnGenerar = $('btn-generar-recibo');
    const spanText = btnGenerar.querySelector('span') || btnGenerar;
    const icon = btnGenerar.querySelector('i');
    btnGenerar.disabled = true;
    if (spanText) spanText.textContent = 'Guardando...';
    if (icon) icon.className = 'fas fa-spinner fa-spin';

    try {
        const response = await fetch('http://localhost:8000/api/receipts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Error en el servidor: ' + response.statusText);
        const data = await response.json();

        // 🔔 Señalizar al Centro de Gestión que hay un recibo nuevo (auto-refresh)
        localStorage.setItem('ml_pedidos_last_receipt', Date.now().toString());

        // Rellenar modal de recibo con la respuesta del servidor
        const inst = INSTITUCIONES.find(i => i.id === STATE.institucionId);
        const abono = payload.initial_payment || 0;
        const saldo = Math.max(0, payload.total_amount - abono);

        $('receipt-inst-name').textContent = inst ? inst.nombre : '';
        $('receipt-number-display').textContent = data.receipt_number;
        $('receipt-date-display').textContent = fechaActual();
        $('receipt-client-name').textContent = payload.client_name;
        $('receipt-client-phone').textContent = payload.client_phone;
        $('receipt-total-display').textContent = fmt(payload.total_amount);

        // Show abono / saldo rows
        const abonoRow = $('receipt-abono-row');
        const saldoRow = $('receipt-saldo-row');
        if (abono > 0 && abonoRow && saldoRow) {
            $('receipt-abono-display').textContent = fmt(abono);
            $('receipt-saldo-display').textContent = fmt(saldo);
            abonoRow.style.display = 'flex';
            saldoRow.style.display = saldo > 0 ? 'flex' : 'none';
        } else if (abonoRow) {
            abonoRow.style.display = 'none';
            if (saldoRow) saldoRow.style.display = 'none';
        }

        // Ítems del recibo
        const listaContainer = $('receipt-items-list');
        listaContainer.innerHTML = '';
        STATE.cart.forEach(item => {
            const row = document.createElement('div');
            row.className = 'receipt-item';
            row.innerHTML = `
                <div class="receipt-item-desc">
                    <div class="receipt-item-name">${item.nombre}</div>
                    <div class="receipt-item-detail">${item.talla} &times; ${item.cantidad}</div>
                </div>
                <div class="receipt-item-price">${fmt(item.precio * item.cantidad)}</div>
            `;
            listaContainer.appendChild(row);
        });

        // Mostrar recibo y limpiar carrito
        $('receipt-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        STATE.cart = [];
        STATE.pendingPayload = null;
        $('input-nombre').value = '';
        $('input-telefono').value = '';
        if ($('input-abono')) $('input-abono').value = '0';
        if ($('input-pago')) $('input-pago').value = '';
        renderCarrito();
        mostrarToast('✅ Pedido guardado: ' + data.receipt_number);

    } catch (error) {
        console.error('Error guardando recibo:', error);
        mostrarToast('❌ Error al guardar. Verifica el backend.');
    } finally {
        btnGenerar.disabled = false;
        if (spanText) spanText.textContent = 'Generar Recibo';
        if (icon) icon.className = 'fas fa-receipt';
    }
}

function cerrarRecibo() {
    $('receipt-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════
   10. TOAST / NOTIFICACIÓN
═══════════════════════════════════════════════ */
let _toastTimer = null;

function mostrarToast(mensaje) {
    // Eliminar toast anterior si aún existe
    const prev = document.querySelector('.toast');
    if (prev) prev.remove();
    clearTimeout(_toastTimer);

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = mensaje;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);

    _toastTimer = setTimeout(() => toast.remove(), 2500);
}

/* ═══════════════════════════════════════════════
   11. EVENTOS
═══════════════════════════════════════════════ */
function initEventos() {
    // Filtros de categoría
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            STATE.filtroCategoria = tab.dataset.cat;
            document.querySelectorAll('.filter-tab').forEach(t => {
                t.classList.toggle('active', t === tab);
                t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
            });
            renderCatalogo();
        });
    });

    // Búsqueda
    $('search-input').addEventListener('input', e => {
        STATE.busqueda = e.target.value;
        renderCatalogo();
    });

    // Botón limpiar
    $('btn-limpiar').addEventListener('click', () => {
        $('input-nombre').value = '';
        $('input-telefono').value = '';
        STATE.cart = [];
        renderCarrito();
        mostrarToast('Formulario y carrito vaciados');
    });

    // Control de cantidad en modal de talla
    $('qty-minus').addEventListener('click', () => {
        STATE.modalCantidad = Math.max(1, STATE.modalCantidad - 1);
        $('qty-modal-value').textContent = STATE.modalCantidad;
    });

    $('qty-plus').addEventListener('click', () => {
        STATE.modalCantidad++;
        $('qty-modal-value').textContent = STATE.modalCantidad;
    });

    // Agregar al carrito (desde modal de talla)
    $('btn-modal-agregar').addEventListener('click', agregarAlCarrito);

    // Cancelar modal de talla
    $('btn-modal-cancelar').addEventListener('click', cerrarModalTalla);

    // Cerrar modal de talla clicando fuera
    $('size-modal').addEventListener('click', e => {
        if (e.target === $('size-modal')) cerrarModalTalla();
    });

    // Generar recibo
    $('btn-generar-recibo').addEventListener('click', generarRecibo);

    // Deseleccionar institución
    $('btn-deselect-inst').addEventListener('click', deseleccionarInstitucion);

    // Botón imprimir
    $('btn-print').addEventListener('click', () => window.print());

    // Cerrar recibo
    $('btn-close-receipt').addEventListener('click', cerrarRecibo);

    // Cerrar recibo clicando fuera
    $('receipt-modal').addEventListener('click', e => {
        if (e.target === $('receipt-modal')) cerrarRecibo();
    });

    // ─── Formateo visual del campo Abono (separador de miles con punto) ─────
    const _abonoInput = $('input-abono');
    if (_abonoInput) {
        _abonoInput.addEventListener('input', function () {
            // Strip everything except digits
            const raw = this.value.replace(/\D/g, '');
            if (raw === '') { this.value = ''; return; }
            const num = parseInt(raw, 10);
            // Format with dot as thousands separator (es-CO locale)
            this.value = num.toLocaleString('es-CO', { maximumFractionDigits: 0 });
        });
        _abonoInput.addEventListener('focus', function () {
            // Allow editing: strip existing dots so user types clean digits
            this.value = this.value.replace(/\./g, '');
        });
        _abonoInput.addEventListener('blur', function () {
            const raw = this.value.replace(/\D/g, '');
            if (raw === '' || raw === '0') { this.value = '0'; return; }
            const num = parseInt(raw, 10);
            this.value = num.toLocaleString('es-CO', { maximumFractionDigits: 0 });
        });
    }

    // Cerrar modales con Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (!$('size-modal').classList.contains('hidden')) cerrarModalTalla();
            if (!$('receipt-modal').classList.contains('hidden')) cerrarRecibo();
        }
    });
    // ─── Vista Previa ────────────────────────────────
    $('btn-confirmar-pedido').addEventListener('click', guardarPedidoConfirmado);
    $('btn-rechazar-pedido').addEventListener('click', () => {
        $('preview-modal').classList.add('hidden');
        document.body.style.overflow = '';
        mostrarToast('Volviste al carrito. Edita lo que necesites.');
    });
    $('preview-modal').addEventListener('click', e => {
        if (e.target === $('preview-modal')) {
            $('preview-modal').classList.add('hidden');
            document.body.style.overflow = '';
        }
    });

    // ─── Login / Dashboard ───────────────────────────
    $('btn-open-login').addEventListener('click', () => {
        $('login-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        $('login-user').focus();
    });
    $('btn-close-login').addEventListener('click', () => {
        $('login-modal').classList.add('hidden');
        document.body.style.overflow = '';
    });
    $('btn-do-login').addEventListener('click', doLogin);
    $('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

    $('btn-close-dashboard').addEventListener('click', () => {
        $('dashboard-panel').classList.remove('open');
    });

    // Filtros del dashboard
    $('filter-inst').addEventListener('change', loadDashboardData);
    $('filter-status').addEventListener('change', loadDashboardData);
}

/* ═══════════════════════════════════════════════
   12. AUTENTICACIÓN Y LIVE DASHBOARD
═══════════════════════════════════════════════ */
STATE.loggedUser = null;

async function doLogin() {
    const username = $('login-user').value.trim();
    const password = $('login-pass').value;
    $('login-error').style.display = 'none';

    try {
        const resp = await fetch('http://localhost:8000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await resp.json();

        if (data.success) {
            STATE.loggedUser = data.user;
            $('login-modal').classList.add('hidden');
            document.body.style.overflow = '';
            $('login-user').value = '';
            $('login-pass').value = '';

            // Poblar filtro de colegios
            const filterInst = $('filter-inst');
            filterInst.innerHTML = '<option value="">Todas las Inst.</option>';
            INSTITUCIONES.forEach(inst => {
                const opt = document.createElement('option');
                opt.value = inst.nombre;
                opt.textContent = inst.nombre;
                filterInst.appendChild(opt);
            });

            $('dashboard-panel').classList.add('open');
            loadDashboardData();
        } else {
            $('login-error').style.display = 'block';
        }
    } catch (e) {
        $('login-error').textContent = 'Sin conexión con el servidor.';
        $('login-error').style.display = 'block';
    }
}

async function loadDashboardData() {
    const institution = $('filter-inst').value;
    const status = $('filter-status').value;

    let url = 'http://localhost:8000/api/dashboard/live';
    const params = [];
    if (institution) params.push('institution=' + encodeURIComponent(institution));
    if (status) params.push('status=' + encodeURIComponent(status));
    if (params.length) url += '?' + params.join('&');

    const tbody = $('live-table-body');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Cargando...</td></tr>';

    try {
        const resp = await fetch(url);
        const rows = await resp.json();

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--gray-600)">Sin resultados</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(r => `
            <tr>
                <td>${r.number}</td>
                <td>${r.client || '—'}</td>
                <td style="font-weight:600">${fmt(r.total)}</td>
                <td><span class="status-badge ${r.status || 'Pendiente'}">${r.status || 'Pendiente'}</span></td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:red; text-align:center">Error al cargar datos</td></tr>';
    }
}

/* ═══════════════════════════════════════════════
   13. INICIALIZACIÓN
═══════════════════════════════════════════════ */
function init() {
    renderInstituciones();
    renderCatalogo();
    renderCarrito();
    initEventos();
    console.log('[ML Pedidos POS] Iniciado correctamente —', INSTITUCIONES.length, 'instituciones cargadas.');
}

// Arrancar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);
