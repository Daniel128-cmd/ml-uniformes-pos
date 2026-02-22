/* admin.js — Centro de Gestión de Pedidos ML Uniformes (Phase 16 - Cloud Ready) */
const API = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'http://localhost:8000';
const SESSION_KEY = 'ml_admin_session';
const RECEIPT_SIGNAL_KEY = 'ml_pedidos_last_receipt';

let allReceipts = [];
let lastReceiptSignal = localStorage.getItem(RECEIPT_SIGNAL_KEY) || '0';
let pollInterval = null;
let _currentAbonoId = null;

// ── HELPERS ───────────────────────────────────────────────────────────────
const fmt = n => '$ ' + Math.round(n || 0).toLocaleString('es-CO');
const esc = s => (s || '').replace(/'/g, "\\'");

// ── AUTH GATE ─────────────────────────────────────────────────────────────
function checkAuth() {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (!s || s.role !== 'ADMIN') showLoginGate();
    else hideLoginGate();
}
function showLoginGate() {
    stopPolling();
    document.getElementById('login-gate').classList.remove('hidden');
    document.getElementById('app-shell').classList.remove('visible');
}
function hideLoginGate() {
    document.getElementById('login-gate').classList.add('hidden');
    document.getElementById('app-shell').classList.add('visible');
    startPolling();
}
async function doLogin() {
    const user = document.getElementById('gate-user').value.trim();
    const pass = document.getElementById('gate-pass').value;
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    try {
        const resp = await fetch(`${API}/api/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass }),
        });
        const data = await resp.json();
        if (resp.ok && data.user?.role === 'ADMIN') {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({
                user: data.user.username, role: data.user.role,
                exp: Date.now() + 8 * 3600 * 1000,
            }));
            hideLoginGate();
            await loadReceipts();
            populateInstitutionFilter();
        } else {
            errEl.textContent = resp.ok ? '❌ Tu cuenta no tiene rol de Administrador.'
                : '❌ Usuario o contraseña incorrectos.';
            errEl.style.display = 'block';
        }
    } catch {
        errEl.textContent = '❌ No se pudo conectar con el servidor (puerto 8000).';
        errEl.style.display = 'block';
    }
}
function doLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    showLoginGate();
}

// ── AUTO-REFRESH POLLING ────────────────────────────────────────────────
function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(async () => {
        const current = localStorage.getItem(RECEIPT_SIGNAL_KEY) || '0';
        if (current !== lastReceiptSignal) {
            lastReceiptSignal = current;
            await loadReceipts();
            showToast('🔄 Panel actualizado automáticamente');
        }
    }, 20000);
    window.addEventListener('storage', e => {
        if (e.key === RECEIPT_SIGNAL_KEY) {
            lastReceiptSignal = e.newValue;
            loadReceipts().then(() => showToast('🔔 Nuevo pedido — lista actualizada'));
        }
    });
}
function stopPolling() {
    clearInterval(pollInterval);
    pollInterval = null;
}

// ── OFFLINE DETECTION ─────────────────────────────────────────────────────
const _offlineBanner = () => document.getElementById('offline-banner');
function _setOffline(offline) {
    const b = _offlineBanner();
    if (b) b.classList.toggle('visible', offline);
}
async function _checkBackend() {
    try {
        const r = await fetch(`${API}/api/admin/receipts`, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
        _setOffline(!r.ok && r.status !== 405);
    } catch { _setOffline(true); }
}
window.addEventListener('online', () => _setOffline(false));
window.addEventListener('offline', () => _setOffline(true));
setInterval(_checkBackend, 15000);

// ── INIT ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    document.getElementById('gate-btn').addEventListener('click', doLogin);
    document.getElementById('gate-pass').addEventListener('keydown', e => {
        if (e.key === 'Enter') doLogin();
    });
    document.getElementById('btn-logout').addEventListener('click', doLogout);

    // Close modals on overlay click
    ['edit-modal', 'detail-modal', 'confirm-modal', 'delivery-modal', 'abono-modal']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', e => {
                if (e.target.id === id) el.classList.add('hidden');
            });
        });

    // Confirm annulment modal buttons
    document.getElementById('confirm-ok').addEventListener('click', () => {
        document.getElementById('confirm-modal').classList.add('hidden');
        if (_confirmCallback) _confirmCallback();
        _confirmCallback = null;
    });
    document.getElementById('confirm-cancel').addEventListener('click', () => {
        document.getElementById('confirm-modal').classList.add('hidden');
        _confirmCallback = null;
    });

    // Delivery date modal buttons
    document.getElementById('delivery-ok').addEventListener('click', () => {
        const rawVal = document.getElementById('delivery-date-input').value;
        document.getElementById('delivery-modal').classList.add('hidden');
        if (!rawVal) return;
        let target;
        if (rawVal.includes('-')) {
            const [y, m, d] = rawVal.split('-');
            target = `${d}/${m}/${y}`;
        } else {
            target = rawVal;
        }
        showToast(`⏳ Generando consolidado para ${target}...`);
        window.open(`${API}/api/admin/reports/delivery-consolidation?date=${encodeURIComponent(target)}`, '_blank');
    });
    document.getElementById('delivery-cancel').addEventListener('click', () => {
        document.getElementById('delivery-modal').classList.add('hidden');
    });

    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (s?.role === 'ADMIN') loadReceipts().then(populateInstitutionFilter);
});

// ── LOAD ──────────────────────────────────────────────────────────────────
async function loadReceipts() {
    try {
        const resp = await fetch(`${API}/api/admin/receipts`);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        allReceipts = await resp.json();
        renderStats(allReceipts);
        applyFilters();
    } catch {
        document.getElementById('receipts-tbody').innerHTML =
            `<tr><td colspan="11" style="text-align:center;color:#D93025;padding:30px">
             ⚠️ Sin conexión con el servidor Python (puerto 8000).<br>
             <small>Ejecuta: <code>venv\\Scripts\\python.exe app.py</code></small>
             </td></tr>`;
        renderStats([]);
    }
}

// ── STATS ─────────────────────────────────────────────────────────────────
function renderStats(receipts) {
    const active = receipts.filter(r => !r.is_anulado);
    const totalPed = active.reduce((s, r) => s + (r.total || 0), 0);
    const totalPaid = active.reduce((s, r) => s + (r.total_paid || 0), 0);
    const abonados = active.filter(r => r.payment_status === 'Abonado').length;
    const colleges = new Set(active.map(r => r.institution).filter(Boolean)).size;

    document.getElementById('stat-count').textContent = active.length;
    document.getElementById('stat-total').textContent = fmt(totalPed);
    document.getElementById('stat-colleges').textContent = colleges;

    const elPaid = document.getElementById('stat-paid');
    if (elPaid) elPaid.textContent = fmt(totalPaid);
    const elAbonados = document.getElementById('stat-abonados');
    if (elAbonados) elAbonados.textContent = abonados;
}

// ── FILTERS ───────────────────────────────────────────────────────────────
function applyFilters() {
    const inst = document.getElementById('filter-inst').value;
    const status = document.getElementById('filter-status').value;
    const client = document.getElementById('filter-client').value.toLowerCase().trim();
    const filtered = allReceipts.filter(r => {
        const ps = r.payment_status || 'Pendiente';
        if (inst && r.institution !== inst) return false;
        if (status && ps !== status) return false;
        if (client && !(r.client || '').toLowerCase().includes(client)) return false;
        return true;
    });
    renderTable(filtered);
    document.getElementById('table-count').textContent = `${filtered.length} recibos`;
}

// ── TABLE ─────────────────────────────────────────────────────────────────
function renderTable(receipts) {
    const tbody = document.getElementById('receipts-tbody');
    if (!receipts.length) {
        tbody.innerHTML = `<tr><td colspan="11">
            <div class="empty-state"><i class="fas fa-inbox"></i>
            <p>No hay recibos con los filtros seleccionados</p></div></td></tr>`;
        return;
    }
    tbody.innerHTML = receipts.map(r => {
        const isAnul = r.is_anulado;
        const payStat = r.payment_status || 'Pendiente';
        const totalPaid = r.total_paid || 0;
        const balance = r.balance || 0;
        const total = r.total || 0;

        const totalHtml = isAnul
            ? '<s style="color:var(--gray-400)">$ 0</s>'
            : fmt(total);

        // Payment status badge
        const payBadgeClass = isAnul ? 'badge-Anulado'
            : payStat === 'Cancelado' ? 'badge-Cancelado'
                : payStat === 'Abonado' ? 'badge-Abonado'
                    : 'badge-Pendiente';
        const payBadgeLabel = isAnul ? 'Anulado' : payStat;

        // Delivery status badge
        const delStat = r.display_status || 'Pendiente';
        const delBadge = delStat === 'Entregado' ? 'badge-Entregado' : 'badge-PendienteDel';

        const actions = isAnul
            ? `<button class="btn-action btn-restore" onclick="restoreReceipt(${r.id})">
                 <i class="fas fa-undo"></i> Restaurar
               </button>`
            : `<button class="btn-action btn-edit"
                 onclick="openEditModal(${r.id},'${esc(r.client)}','${esc(r.phone || '')}','${r.status || 'Pendiente'}')">
                 <i class="fas fa-pen"></i>
               </button>
               <button class="btn-action btn-abono" onclick="openAbonoModal(${r.id})" title="Aplicar Abono">
                 <i class="fas fa-money-bill-wave"></i>
               </button>
               <button class="btn-action btn-delete" onclick="confirmAnular(${r.id})">
                 <i class="fas fa-ban"></i>
               </button>`;

        return `
          <tr class="${isAnul ? 'anulado' : ''} ${payStat === 'Cancelado' ? 'row-cancelado' : payStat === 'Abonado' ? 'row-abonado' : ''}">
            <td><strong>${r.number}</strong></td>
            <td>${r.institution || '—'}</td>
            <td>${r.client || '(Sin nombre)'}</td>
            <td>${r.phone || '—'}</td>
            <td style="font-weight:700">${totalHtml}</td>
            <td>${isAnul ? '—' : fmt(totalPaid)}</td>
            <td style="font-weight:700;color:${balance > 0 ? '#D93025' : '#1E8E3E'}">${isAnul ? '—' : fmt(balance)}</td>
            <td><span class="badge ${payBadgeClass}">${payBadgeLabel}</span></td>
            <td><span class="badge ${delBadge}">${isAnul ? '—' : delStat}</span></td>
            <td><button class="btn-action btn-view" onclick="openDetailModal(${r.id})" title="Ver detalle">
                <i class="fas fa-eye"></i></button></td>
            <td><div class="action-btns">${actions}</div></td>
          </tr>`;
    }).join('');
}

// ── INSTITUTION FILTER ─────────────────────────────────────────────────────
function populateInstitutionFilter() {
    const sel = document.getElementById('filter-inst');
    sel.innerHTML = '<option value="">Todas las instituciones</option>';
    [...new Set(allReceipts.map(r => r.institution).filter(Boolean))].sort()
        .forEach(n => {
            const o = document.createElement('option');
            o.value = n; o.textContent = n; sel.appendChild(o);
        });
}

// ── ABONO MODAL ─────────────────────────────────────────────────────────────
async function openAbonoModal(id) {
    _currentAbonoId = id;
    const modal = document.getElementById('abono-modal');
    const body = document.getElementById('abono-body');
    body.innerHTML = '<p style="text-align:center;padding:20px;color:var(--gray-600)">⏳ Cargando...</p>';
    modal.classList.remove('hidden');

    try {
        const resp = await fetch(`${API}/api/admin/receipts/${id}/payments`);
        const d = await resp.json();

        const balance = d.balance || 0;
        const totalPaid = d.total_paid || 0;

        // Payment status color
        let psBg = '#FFF3E0', psTxt = '#E65100', psLabel = '🟡 Abonado';
        if (totalPaid <= 0) { psBg = '#FCE8E6'; psTxt = '#D93025'; psLabel = '🔴 Pendiente'; }
        else if (totalPaid >= d.total_amount) { psBg = '#E6F4EA'; psTxt = '#1E8E3E'; psLabel = '✅ Cancelado'; }

        // History rows
        const histRows = (d.payments || []).map((p, i) => `
            <tr style="background:${i % 2 === 0 ? 'white' : '#F8F9FA'}">
              <td style="padding:6px 10px">${String(p.created_at || '').slice(0, 16)}</td>
              <td style="padding:6px 10px">${p.payment_method === 'Efectivo' ? '💵 Efectivo' : '📲 Transf.'}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:700">${fmt(p.amount)}</td>
              <td style="padding:6px 10px;color:var(--gray-600);font-size:11px">${p.notes || '—'}</td>
            </tr>`).join('') || `<tr><td colspan="4" style="padding:14px;text-align:center;color:var(--gray-600)">Sin pagos registrados aún</td></tr>`;

        body.innerHTML = `
          <!-- Receipt header -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;font-size:13px">
            <div style="background:#F8F9FA;padding:10px;border-radius:8px">
              <div style="font-size:10px;text-transform:uppercase;color:var(--gray-600);font-weight:700;margin-bottom:3px">Recibo</div>
              <div style="font-size:18px;font-weight:800;color:var(--vino)">${d.receipt_number}</div>
            </div>
            <div style="background:#F8F9FA;padding:10px;border-radius:8px">
              <div style="font-size:10px;text-transform:uppercase;color:var(--gray-600);font-weight:700;margin-bottom:3px">Estado de Pago</div>
              <span style="background:${psBg};color:${psTxt};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">${psLabel}</span>
            </div>
            <div style="background:var(--vino);color:white;padding:10px;border-radius:8px;text-align:center">
              <div style="font-size:10px;font-weight:700;margin-bottom:3px;opacity:.8">SALDO PENDIENTE</div>
              <div style="font-size:20px;font-weight:800">${fmt(balance)}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;font-size:12px">
            <div><span style="color:var(--gray-600);font-weight:600">Niño/a:</span> ${d.client_name || '—'}</div>
            <div><span style="color:var(--gray-600);font-weight:600">Entrega:</span> ${d.delivery_date || '—'}</div>
            <div><span style="color:var(--gray-600);font-weight:600">Total pedido:</span> <strong>${fmt(d.total_amount)}</strong></div>
            <div><span style="color:var(--gray-600);font-weight:600">Total abonado:</span> <strong style="color:#1E8E3E">${fmt(totalPaid)}</strong></div>
          </div>

          <!-- Payment history -->
          <div style="font-weight:700;font-size:12px;text-transform:uppercase;color:var(--gray-600);margin-bottom:8px">
            📋 Historial de Abonos
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;border-radius:6px;overflow:hidden">
            <thead><tr style="background:var(--vino);color:white">
              <th style="padding:7px 10px;text-align:left">Fecha / Hora</th>
              <th style="padding:7px 10px;text-align:left">Método</th>
              <th style="padding:7px 10px;text-align:right">Monto</th>
              <th style="padding:7px 10px;text-align:left">Nota</th>
            </tr></thead>
            <tbody>${histRows}</tbody>
          </table>

          ${balance <= 0 ? '<p style="text-align:center;color:#1E8E3E;font-weight:700;padding:12px;background:#E6F4EA;border-radius:8px">✅ Este pedido está completamente cancelado. No hay saldo pendiente.</p>' : `
          <!-- New payment form -->
          <div style="background:linear-gradient(135deg,#F5EDD6,#fff);border:1.5px solid #E9ECEF;border-radius:10px;padding:16px">
            <div style="font-weight:700;font-size:13px;color:var(--vino);margin-bottom:12px">💰 Registrar Nuevo Abono</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
              <div>
                <label style="font-size:11px;font-weight:700;color:var(--gray-600);text-transform:uppercase">Monto del Abono *</label>
                <input type="number" id="abono-monto" min="0" step="1000" value="${Math.round(balance)}"
                  style="width:100%;padding:9px 12px;border:1.5px solid #DEE2E6;border-radius:7px;font-size:15px;font-family:inherit;box-sizing:border-box;margin-top:4px">
              </div>
              <div>
                <label style="font-size:11px;font-weight:700;color:var(--gray-600);text-transform:uppercase">Método de Pago *</label>
                <select id="abono-metodo"
                  style="width:100%;padding:9px 12px;border:1.5px solid #DEE2E6;border-radius:7px;font-size:14px;font-family:inherit;margin-top:4px">
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="Transferencia">📲 Transferencia</option>
                </select>
              </div>
            </div>
            <div style="margin-bottom:12px">
              <label style="font-size:11px;font-weight:700;color:var(--gray-600);text-transform:uppercase">Nota (opcional)</label>
              <input type="text" id="abono-nota" placeholder="Ej: Pago del saldo restante, segunda cuota..."
                style="width:100%;padding:9px 12px;border:1.5px solid #DEE2E6;border-radius:7px;font-size:13px;font-family:inherit;box-sizing:border-box;margin-top:4px">
            </div>
            <div style="display:flex;gap:10px">
              <button onclick="submitAbono()" style="flex:1;padding:12px;background:var(--vino);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px">
                <i class="fas fa-money-bill-wave"></i> Aplicar Abono
              </button>
              <button onclick="document.getElementById('abono-modal').classList.add('hidden')"
                style="padding:12px 20px;background:#E9ECEF;color:#495057;border:none;border-radius:8px;font-weight:600;cursor:pointer">
                Cancelar
              </button>
            </div>
          </div>`}`;

    } catch {
        body.innerHTML = '<p style="color:red;padding:20px;text-align:center">❌ Error cargando datos del recibo.</p>';
    }
}

async function submitAbono() {
    const id = _currentAbonoId;
    const amount = parseFloat(document.getElementById('abono-monto')?.value || '0');
    const method = document.getElementById('abono-metodo')?.value || 'Efectivo';
    const notes = document.getElementById('abono-nota')?.value || '';

    if (!amount || amount <= 0) {
        showToast('⚠️ Ingresa un monto mayor a $0', 'error');
        return;
    }
    try {
        const resp = await fetch(`${API}/api/admin/receipts/${id}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, payment_method: method, notes }),
        });
        const result = await resp.json();
        if (!resp.ok) {
            showToast('❌ Error: ' + (result.error || resp.status), 'error');
            return;
        }
        // Signal localStorage for auto-refresh
        localStorage.setItem(RECEIPT_SIGNAL_KEY, Date.now().toString());
        // Show new status
        const statusMsg = result.payment_status === 'Cancelado'
            ? '✅ ¡Pedido CANCELADO! Saldo saldado.' : `💰 Abono registrado — Saldo: ${fmt(result.balance)}`;
        showToast(statusMsg);
        document.getElementById('abono-modal').classList.add('hidden');
        await loadReceipts();
    } catch {
        showToast('❌ Sin conexión con el servidor', 'error');
    }
}

// ── CUSTOM CONFIRM MODAL ──────────────────────────────────────────────────
let _confirmCallback = null;
function confirmAnular(id) {
    _confirmCallback = () => deleteReceipt(id);
    document.getElementById('confirm-msg').innerHTML =
        `¿Estás seguro que deseas <strong>anular</strong> este pedido?<br>
        <span style="font-size:12px;color:var(--gray-600)">El pedido quedará en el historial con valor $0 y podrás restaurarlo luego.</span>`;
    document.getElementById('confirm-modal').classList.remove('hidden');
}

// ── DELIVERY CONSOLIDATION MODAL ──────────────────────────────────────────
function downloadDelivery() {
    const now = new Date();
    const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    document.getElementById('delivery-date-input').value = today;
    document.getElementById('delivery-modal').classList.remove('hidden');
}

// ── DETAIL MODAL ──────────────────────────────────────────────────────────
async function openDetailModal(id) {
    const modal = document.getElementById('detail-modal');
    const body = document.getElementById('detail-body');
    body.innerHTML = '<p style="text-align:center;padding:30px;color:var(--gray-600)">⏳ Cargando detalle...</p>';
    modal.classList.remove('hidden');
    try {
        const [itemResp, payResp] = await Promise.all([
            fetch(`${API}/api/admin/receipts/${id}/items`),
            fetch(`${API}/api/admin/receipts/${id}/payments`),
        ]);
        const d = await itemResp.json();
        const p = await payResp.json();

        const totalPaid = p.total_paid || 0;
        const balance = p.balance || 0;
        const payStat = totalPaid <= 0 ? 'Pendiente' : (totalPaid >= d.total_amount ? 'Cancelado' : 'Abonado');
        const psColor = payStat === 'Cancelado' ? '#1E8E3E' : payStat === 'Abonado' ? '#E65100' : '#D93025';
        const psBg = payStat === 'Cancelado' ? '#E6F4EA' : payStat === 'Abonado' ? '#FFF3E0' : '#FCE8E6';

        const rows = (d.items || []).map((it, i) => `
            <tr style="background:${i % 2 === 0 ? 'white' : '#F8F9FA'}">
              <td style="padding:8px 12px">${it.product}</td>
              <td style="padding:8px 12px">${it.size_range || ''} / ${it.exact_size || ''}</td>
              <td style="padding:8px 12px;text-align:right">${it.quantity}</td>
              <td style="padding:8px 12px;text-align:right">${fmt(it.unit_price || 0)}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:700">${fmt((it.unit_price || 0) * it.quantity)}</td>
            </tr>`).join('');

        const payRows = (p.payments || []).map((pay, i) => `
            <tr style="background:${i % 2 === 0 ? 'white' : '#F8F9FA'}">
              <td style="padding:6px 10px;font-size:11px">${String(pay.created_at || '').slice(0, 16)}</td>
              <td style="padding:6px 10px">${pay.payment_method === 'Efectivo' ? '💵' : '📲'} ${pay.payment_method}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:700;color:#1E8E3E">${fmt(pay.amount)}</td>
              <td style="padding:6px 10px;font-size:11px;color:var(--gray-600)">${pay.notes || '—'}</td>
            </tr>`).join('') || `<tr><td colspan="4" style="padding:12px;text-align:center;color:var(--gray-600)">Sin abonos registrados</td></tr>`;

        body.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:13px;margin-bottom:20px">
            <div style="background:#F8F9FA;padding:12px;border-radius:8px">
              <div style="font-size:10px;text-transform:uppercase;color:#6C757D;font-weight:700;margin-bottom:4px">Recibo N°</div>
              <div style="font-size:20px;font-weight:800;color:var(--vino)">${d.receipt_number}</div>
            </div>
            <div style="background:#F8F9FA;padding:12px;border-radius:8px">
              <div style="font-size:10px;text-transform:uppercase;color:#6C757D;font-weight:700;margin-bottom:4px">Estado de Pago</div>
              <span style="background:${psBg};color:${psColor};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">${payStat}</span>
            </div>
            <div><div style="font-size:10px;text-transform:uppercase;color:#6C757D;font-weight:700;margin-bottom:2px">Niño/a</div>${d.client_name || '—'}</div>
            <div><div style="font-size:10px;text-transform:uppercase;color:#6C757D;font-weight:700;margin-bottom:2px">Teléfono</div>${d.client_phone || '—'}</div>
            <div><div style="font-size:10px;text-transform:uppercase;color:#6C757D;font-weight:700;margin-bottom:2px">Institución</div>${d.institution}</div>
            <div><div style="font-size:10px;text-transform:uppercase;color:#6C757D;font-weight:700;margin-bottom:2px">Entrega Est.</div><strong style="color:var(--vino)">${d.delivery_date || '—'}</strong></div>
            <div style="background:#E6F4EA;padding:10px;border-radius:8px;text-align:center">
              <div style="font-size:10px;font-weight:700;color:#1E8E3E">Total Abonado</div>
              <div style="font-size:18px;font-weight:800;color:#1E8E3E">${fmt(totalPaid)}</div>
            </div>
            <div style="background:${balance > 0 ? '#FCE8E6' : '#E6F4EA'};padding:10px;border-radius:8px;text-align:center">
              <div style="font-size:10px;font-weight:700;color:${balance > 0 ? '#D93025' : '#1E8E3E'}">Saldo Pendiente</div>
              <div style="font-size:18px;font-weight:800;color:${balance > 0 ? '#D93025' : '#1E8E3E'}">${fmt(balance)}</div>
            </div>
          </div>
          <!-- Items -->
          <div style="font-weight:700;font-size:11px;text-transform:uppercase;color:var(--gray-600);margin-bottom:6px">Detalle de Prendas</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;border-radius:8px;overflow:hidden;margin-bottom:16px">
            <thead><tr style="background:var(--vino);color:white">
              <th style="padding:8px 12px;text-align:left">Prenda</th>
              <th style="padding:8px 12px;text-align:left">Talla</th>
              <th style="padding:8px 12px;text-align:right">Cant.</th>
              <th style="padding:8px 12px;text-align:right">P. Unit.</th>
              <th style="padding:8px 12px;text-align:right">Subtotal</th>
            </tr></thead>
            <tbody>${rows || '<tr><td colspan="5" style="padding:14px;text-align:center;color:#6C757D">Sin prendas</td></tr>'}</tbody>
          </table>
          <!-- Payment history -->
          <div style="font-weight:700;font-size:11px;text-transform:uppercase;color:var(--gray-600);margin-bottom:6px">📋 Historial de Abonos</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;border-radius:8px;overflow:hidden">
            <thead><tr style="background:#495057;color:white">
              <th style="padding:7px 10px;text-align:left">Fecha / Hora</th>
              <th style="padding:7px 10px;text-align:left">Método</th>
              <th style="padding:7px 10px;text-align:right">Monto</th>
              <th style="padding:7px 10px;text-align:left">Nota</th>
            </tr></thead>
            <tbody>${payRows}</tbody>
          </table>
          <div style="margin-top:20px;display:flex;justify-content:space-between;gap:10px">
            <button onclick="printDetailReceipt()"
              style="background:var(--vino);color:white;border:none;border-radius:8px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;flex:1">
              🖨️ Imprimir Recibo
            </button>
            <button onclick="closeDetailModal()"
              style="background:var(--gray-200);color:var(--gray-800);border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer">
              × Cerrar
            </button>
          </div>`;
        window._printReceiptData = { d, p, totalPaid, balance, itemRows: rows, payHistRows: payRows };
    } catch {
        body.innerHTML = '<p style="color:red;padding:20px;text-align:center">❌ Error cargando detalle del pedido.</p>';
    }
}
function closeDetailModal() { document.getElementById('detail-modal').classList.add('hidden'); }

// ── PRINT DETAIL RECEIPT ───────────────────────────────────────────────────
function printDetailReceipt() {
    const data = window._printReceiptData;
    if (!data) return;
    const { d, p, totalPaid, balance, itemRows, payHistRows } = data;
    const w = window.open('', '_blank', 'width=720,height=900');
    const html = [
        '<!DOCTYPE html><html><head>',
        '<meta charset="UTF-8">',
        '<title>Recibo N\u00b0' + d.receipt_number + '<\/title>',
        '<style>',
        'body{font-family:Arial,sans-serif;font-size:13px;padding:24px;color:#1A1A2E}',
        'h2{color:#7B1929;text-align:center;margin:0 0 4px;font-size:20px}',
        'p.sub{text-align:center;color:#6C757D;font-size:12px;margin:0 0 18px}',
        '.row{display:flex;justify-content:space-between;margin-bottom:8px}',
        '.lbl{font-weight:700;color:#6C757D;font-size:10px;text-transform:uppercase;margin-bottom:2px}',
        'table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}',
        'th{background:#7B1929;color:white;padding:7px 10px;text-align:left}',
        'td{padding:6px 10px;border-bottom:1px solid #E9ECEF}',
        'hr{border:none;border-top:2px solid #7B1929;margin:14px 0}',
        '.tot{display:flex;justify-content:space-between;margin-top:10px;gap:10px}',
        '.tot-box{flex:1;padding:10px;border-radius:6px;text-align:center}',
        '@media print{@page{margin:10mm}}',
        '<\/style><\/head><body>',
        '<h2>ML Uniformes<\/h2>',
        '<p class="sub">Pedidos &amp; Uniformes &mdash; ' + (d.institution || '') + '<\/p>',
        '<hr>',
        '<div class="row">',
        '  <div><div class="lbl">Recibo N\u00b0<\/div><strong style="font-size:20px;color:#7B1929">' + d.receipt_number + '<\/strong><\/div>',
        '  <div style="text-align:right"><div class="lbl">Fecha<\/div>' + new Date().toLocaleDateString('es-CO') + '<\/div>',
        '<\/div>',
        '<div class="row" style="margin-top:10px">',
        '  <div><div class="lbl">Ni\u00f1o\/a<\/div><strong>' + (d.client_name || '\u2014') + '<\/strong><\/div>',
        '  <div><div class="lbl">Tel\u00e9fono<\/div>' + (d.client_phone || '\u2014') + '<\/div>',
        '<\/div>',
        '<div class="row"><div><div class="lbl">Entrega Estimada<\/div><strong style="color:#7B1929">' + (d.delivery_date || '\u2014') + '<\/strong><\/div><\/div>',
        '<hr>',
        '<div class="lbl" style="margin-bottom:6px">Detalle de Prendas<\/div>',
        '<table><thead><tr>',
        '<th>Prenda<\/th><th>Talla<\/th><th style="text-align:right">Cant.<\/th><th style="text-align:right">P.Unit.<\/th><th style="text-align:right">Subtotal<\/th>',
        '<\/tr><\/thead><tbody>' + (itemRows || '<tr><td colspan="5">Sin prendas<\/td><\/tr>') + '<\/tbody><\/table>',
        '<div style="display:flex;justify-content:space-between;margin-top:10px;padding:10px;background:#F8F9FA;border-radius:6px">',
        '<span style="font-weight:700;color:#7B1929">TOTAL DEL PEDIDO<\/span>',
        '<span style="font-weight:800;color:#7B1929;font-size:16px">' + fmt(d.total_amount || 0) + '<\/span>',
        '<\/div>',
        '<hr>',
        '<div class="lbl" style="margin-bottom:6px">Historial de Abonos<\/div>',
        '<table><thead><tr>',
        '<th>Fecha \/ Hora<\/th><th>M\u00e9todo<\/th><th style="text-align:right">Monto<\/th><th>Nota<\/th>',
        '<\/tr><\/thead><tbody>' + payHistRows + '<\/tbody><\/table>',
        '<div class="tot">',
        '<div class="tot-box" style="background:#E6F4EA"><div style="font-weight:700;color:#1E8E3E;font-size:10px;text-transform:uppercase">Total Abonado<\/div><div style="font-weight:800;color:#1E8E3E;font-size:15px">' + fmt(totalPaid) + '<\/div><\/div>',
        (balance > 0 ? '<div class="tot-box" style="background:#FCE8E6"><div style="font-weight:700;color:#D93025;font-size:10px;text-transform:uppercase">Saldo Pendiente<\/div><div style="font-weight:800;color:#D93025;font-size:15px">' + fmt(balance) + '<\/div><\/div>' : ''),
        '<\/div>',
        '<p style="text-align:center;margin-top:24px;color:#6C757D;font-size:11px">\u00a1Gracias por su pedido! &mdash; ML Uniformes<\/p>',
        '<\/body><\/html>'
    ].join('\n');
    w.document.write(html);
    w.document.close();
    setTimeout(function () { w.focus(); w.print(); }, 500);
}

function openEditModal(id, client, phone, status) {
    document.getElementById('edit-receipt-id').value = id;
    document.getElementById('edit-client-name').value = client;
    document.getElementById('edit-client-phone').value = phone;
    document.getElementById('edit-status').value = status;
    document.getElementById('edit-modal').classList.remove('hidden');
}
function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); }
async function saveEdit() {
    const id = document.getElementById('edit-receipt-id').value;
    const body = {
        client_name: document.getElementById('edit-client-name').value,
        client_phone: document.getElementById('edit-client-phone').value,
        status: document.getElementById('edit-status').value,
    };
    try {
        const resp = await fetch(`${API}/api/admin/receipts/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (resp.ok) { closeEditModal(); await loadReceipts(); showToast('✅ Pedido actualizado'); }
        else showToast('❌ Error al actualizar (HTTP ' + resp.status + ')');
    } catch { showToast('❌ Sin conexión'); }
}

// ── DELETE / RESTORE ──────────────────────────────────────────────────────
async function deleteReceipt(id) {
    try {
        const resp = await fetch(`${API}/api/admin/receipts/${id}`, { method: 'DELETE' });
        if (resp.ok) { await loadReceipts(); showToast('🗑 Pedido anulado'); }
        else showToast('❌ No se pudo anular: HTTP ' + resp.status);
    } catch { showToast('❌ Sin conexión'); }
}
async function restoreReceipt(id) {
    try {
        const resp = await fetch(`${API}/api/admin/receipts/${id}/restore`, { method: 'PUT' });
        if (resp.ok) { await loadReceipts(); showToast('✅ Pedido restaurado'); }
        else showToast('❌ No se pudo restaurar');
    } catch { showToast('❌ Sin conexión'); }
}

// ── PDF DOWNLOADS ─────────────────────────────────────────────────────────
function downloadHojaRuta() {
    showToast('⏳ Generando Hoja de Ruta...');
    window.open(`${API}/api/admin/reports/hoja-ruta`, '_blank');
}
function downloadPlanillaProduccion() {
    showToast('⏳ Generando Planilla de Producción...');
    window.open(`${API}/api/admin/reports/planilla-produccion`, '_blank');
}
function downloadOrdenConsolidada() {
    showToast('⏳ Generando Orden de Producción Consolidada...');
    window.open(`${API}/api/admin/reports/orden-consolidada`, '_blank');
}
function downloadSales() { showToast('⏳ Generando Reporte de Ventas...'); window.open(`${API}/api/admin/reports/sales`, '_blank'); }
function downloadExtract(period) { showToast('⏳ Generando extracto...'); window.open(`${API}/api/admin/reports/sales-extract?period=${period}`, '_blank'); }

// ── TOAST ─────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    document.querySelectorAll('.admin-toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'admin-toast';
    t.innerHTML = msg;
    const bg = type === 'error' ? '#D93025' : type === 'success' ? '#1E8E3E' : '#1A1A2E';
    t.style.cssText = `position:fixed;bottom:28px;right:28px;background:${bg};color:white;
        padding:14px 22px;border-radius:12px;font-weight:600;z-index:9999;
        box-shadow:0 6px 24px rgba(0,0,0,.25);font-family:Inter,sans-serif;font-size:13px;
        max-width:360px;animation:slideUp .2s ease;`;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 3500);
}
