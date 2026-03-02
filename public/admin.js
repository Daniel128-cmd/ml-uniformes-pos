/* admin.js — Centro de Gestión de Pedidos ML Uniformes (Firestore) */

import { db, auth } from './firebase_config.js';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, inMemoryPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, query, orderBy, onSnapshot, getDocs, updateDoc, addDoc, writeBatch, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const API = '/api'; // Using Firebase Hosting rewrites to Cloud Functions

let allReceipts = [];
let _currentAbonoId = null;
let unsubscribeSnapshot = null;

// ── HELPERS ───────────────────────────────────────────────────────────────
const fmt = n => '$ ' + Math.round(n || 0).toLocaleString('es-CO');
const esc = s => (s || '').replace(/'/g, "\\'");

// ── AUTH GATE ─────────────────────────────────────────────────────────────
function showLoginGate() {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  document.getElementById('login-gate').classList.remove('hidden');
  document.getElementById('app-shell').classList.remove('visible');
}

function hideLoginGate() {
  document.getElementById('login-gate').classList.add('hidden');
  document.getElementById('app-shell').classList.add('visible');
  setupFirestoreListener();
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    hideLoginGate();
  } else {
    showLoginGate();
  }
});

async function doLogin() {
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  const userField = document.getElementById('admin-user').value.trim();
  const passField = document.getElementById('admin-pass').value;

  if (!userField || !passField) {
    errEl.textContent = '❌ Por favor, ingresa usuario y contraseña.';
    errEl.style.display = 'block';
    return;
  }

  // Pseudo-domain for Firebase Auth username compatibility
  const email = `${userField.toLowerCase()}@mluniformes.com`;

  const btn = document.getElementById('btn-admin-login');
  const oldText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';

  try {
    // Force in-memory persistence (log out immediately when tab is refreshed or closed)
    await setPersistence(auth, inMemoryPersistence);

    const result = await signInWithEmailAndPassword(auth, email, passField);

    if (result && result.user) {
      const whitelistDoc = await getDoc(doc(db, 'allowed_admins', email));

      if (!whitelistDoc.exists()) {
        await signOut(auth);
        errEl.textContent = `❌ El usuario ${userField} no tiene permisos de administrador.`;
        errEl.style.display = 'block';
      }
    }
  } catch (e) {
    console.error('Login Admin Error:', e);
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
      errEl.textContent = '❌ Usuario o contraseña incorrectos.';
    } else {
      errEl.textContent = '❌ Error al iniciar sesión. Intenta de nuevo.';
    }
    errEl.style.display = 'block';
  } finally {
    btn.innerHTML = oldText;
  }
}

async function doLogout() {
  await signOut(auth);
}

async function doGoogleLogin() {
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  const btn = document.getElementById('btn-google-login');
  const oldText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';

  try {
    await setPersistence(auth, inMemoryPersistence);
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);

    if (result && result.user) {
      const email = result.user.email;
      const whitelistDoc = await getDoc(doc(db, 'allowed_admins', email));

      if (!whitelistDoc.exists()) {
        await signOut(auth);
        errEl.textContent = `❌ La cuenta ${email} no tiene permisos de administrador.`;
        errEl.style.display = 'block';
      }
    }
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      console.error('Login Google Admin Error:', e);
      errEl.textContent = '❌ Error al iniciar sesión con Google. Intenta de nuevo.';
      errEl.style.display = 'block';
    }
  } finally {
    btn.innerHTML = oldText;
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-admin-login').addEventListener('click', doLogin);
  document.getElementById('btn-google-login').addEventListener('click', doGoogleLogin);
  document.getElementById('btn-logout').addEventListener('click', doLogout);

  // Toggle Password Visibility
  const passToggleBtn = document.getElementById('btn-toggle-pass');
  if (passToggleBtn) {
    passToggleBtn.addEventListener('click', () => {
      const passInput = document.getElementById('admin-pass');
      const icon = passToggleBtn.querySelector('i');
      if (passInput.type === 'password') {
        passInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        passInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    });
  }

  // Close modals on overlay click
  ['edit-modal', 'detail-modal', 'confirm-modal', 'delivery-modal', 'abono-modal', 'report-date-modal']
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

  // Report Date modal buttons
  let _currentReportType = null;
  window.openDateModal = (type) => {
    _currentReportType = type;
    document.getElementById('report-date-modal').classList.remove('hidden');
    let titleHTML = '';
    if (type === 'hoja-ruta') titleHTML = '<i class="fas fa-route"></i> Hoja de Ruta';
    else if (type === 'planilla') titleHTML = '<i class="fas fa-clipboard-list"></i> Planilla de Producción';
    else if (type === 'ventas') titleHTML = '<i class="fas fa-file-pdf"></i> Reporte de Ventas Diarias';
    document.getElementById('report-modal-title').innerHTML = titleHTML;
  };

  document.getElementById('report-date-ok').addEventListener('click', () => {
    const rawVal = document.getElementById('report-date-input').value;
    document.getElementById('report-date-modal').classList.add('hidden');
    if (!rawVal) return;

    // Convert YYYY-MM-DD to DD/MM/YYYY logically or just pass YYYY-MM-DD
    // But our backend expects a date string or we can handle YYYY-MM-DD
    showToast(`⏳ Generando ${_currentReportType}...`);
    let endpoint = 'hoja-ruta';
    if (_currentReportType === 'planilla') endpoint = 'planilla-produccion';
    else if (_currentReportType === 'ventas') endpoint = 'sales';

    // We send YYYY-MM-DD directly as it is standard and easy to parse
    window.open(`${API}/admin/reports/${endpoint}?date=${encodeURIComponent(rawVal)}`, '_blank');
  });

  document.getElementById('report-date-cancel').addEventListener('click', () => {
    document.getElementById('report-date-modal').classList.add('hidden');
  });

  // Attach to HTML elements using window object since this is a module now
  window.openEditModal = openEditModal;
  window.closeEditModal = closeEditModal;
  window.saveEdit = saveEdit;
  window.openDetailModal = openDetailModal;
  window.closeDetailModal = () => document.getElementById('detail-modal').classList.add('hidden');
  window.printDetailReceipt = printDetailReceipt;
  window.openAbonoModal = openAbonoModal;
  window.submitAbono = submitAbono;
  window.confirmAnular = confirmAnular;
  window.restoreReceipt = restoreReceipt;

  window.downloadExtract = (p) => { showToast('⏳ Export...'); window.open(`${API}/admin/reports/sales?period=${p}`, '_blank'); };
  window.applyFilters = applyFilters;
  window.loadReceipts = () => showToast('✅ Datos Live activados por Firebase', 'success');
});

// ── LOAD (FIRESTORE REALTIME) ─────────────────────────────────────────────
function setupFirestoreListener() {
  if (unsubscribeSnapshot) unsubscribeSnapshot();

  document.getElementById('receipts-tbody').innerHTML =
    `<tr><td colspan="11" style="text-align:center;color:#6C757D;padding:30px">
             ⏳ Sincronizando con la nube...
             </td></tr>`;

  const q = query(collection(db, 'receipts'), orderBy('created_at', 'desc'));

  unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
    allReceipts = [];
    snapshot.forEach(docSnap => {
      const d = docSnap.data();

      // Reconstruimos la misma interfaz que esperaba la vieja tabla
      const total = parseFloat(d.total_amount || 0);
      const balance = parseFloat(d.balance !== undefined ? d.balance : total);
      const totalPaid = total - balance;

      const is_anulado = d.status === 'Anulado' || !!d.deleted_at;
      let pStatus = 'Pendiente';
      if (balance <= 0) pStatus = 'Cancelado';
      else if (balance < total) pStatus = 'Abonado';

      allReceipts.push({
        id: docSnap.id,
        number: String(d.receipt_number).padStart(3, '0'),
        institution: d.institution_name || d.institution_id || '—',
        institution_id: d.institution_id,
        client: d.client_name,
        phone: d.client_phone,
        total: total,
        total_paid: totalPaid,
        balance: Math.max(0, balance),
        payment_status: pStatus,
        status: d.status,
        display_status: is_anulado ? 'Anulado' : (d.status || 'Pendiente'),
        is_anulado: is_anulado,
        created_at: d.created_at,
        delivery_date: d.delivery_date
      });
    });

    renderStats(allReceipts);
    populateInstitutionFilter(); // Run only once ideally but fast enough
    applyFilters();
  }, (error) => {
    console.error("Firestore onSnapshot Error:", error);
    document.getElementById('receipts-tbody').innerHTML =
      `<tr><td colspan="11" style="text-align:center;color:#D93025;padding:30px">
             ❌ Error conectando a base de datos. Recarga la página.
             </td></tr>`;
  });
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
    if (status && ps !== status && !(status === 'Anulado' && r.is_anulado)) return false;
    if (status === 'Anulado' && !r.is_anulado) return false;
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
      ? `<button class="btn-action btn-restore" onclick="restoreReceipt('${r.id}')">
                 <i class="fas fa-undo"></i> Restaurar
               </button>`
      : `<button class="btn-action btn-edit"
                 onclick="openEditModal('${r.id}', '${r.institution_id}', '${r.number}', '${esc(r.client)}', '${esc(r.phone || '')}', '${r.display_status || 'Pendiente'}')">
                 <i class="fas fa-pen"></i>
               </button>
               <button class="btn-action btn-abono" onclick="openAbonoModal('${r.id}')" title="Aplicar Abono">
                 <i class="fas fa-money-bill-wave"></i>
               </button>
               <button class="btn-action btn-delete" onclick="confirmAnular('${r.id}')">
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
            <td><button class="btn-action btn-view" onclick="openDetailModal('${r.id}')" title="Ver detalle">
                <i class="fas fa-eye"></i></button></td>
            <td><div class="action-btns">${actions}</div></td>
          </tr>`;
  }).join('');
}

// ── INSTITUTION FILTER ─────────────────────────────────────────────────────
function populateInstitutionFilter() {
  const sel = document.getElementById('filter-inst');
  const actualVal = sel.value;
  sel.innerHTML = '<option value="">Todas las instituciones</option>';
  [...new Set(allReceipts.map(r => r.institution).filter(Boolean))].sort()
    .forEach(n => {
      const o = document.createElement('option');
      o.value = n; o.textContent = n; sel.appendChild(o);
    });
  sel.value = actualVal;
}

// ── MODAL EDICIÓN ─────────────────────────────────────────────────────────

let _currentEditItems = [];
let _currentEditReceiptId = null;
let _currentEditInstId = null;

async function openEditModal(id, instId, number, client, phone, status) {
  _currentEditReceiptId = id;
  _currentEditInstId = instId;

  document.getElementById('edit-receipt-id').value = id;
  document.getElementById('edit-client-name').value = client;
  document.getElementById('edit-client-phone').value = phone;
  document.getElementById('edit-receipt-title').textContent = `#${number}`;

  // Set fake status while loading
  document.getElementById('edit-status').value = status;

  const container = document.getElementById('edit-items-container');
  container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--gray-600);"><i class="fas fa-spinner fa-spin"></i> Cargando contenido del pedido...</div>';

  document.getElementById('edit-modal').classList.remove('hidden');

  try {
    const itemsRef = collection(db, 'receipts', id, 'items');
    const itemsSnap = await getDocs(itemsRef);
    _currentEditItems = [];

    itemsSnap.forEach(docSnap => {
      _currentEditItems.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderEditItems();
  } catch (error) {
    console.error("Error cargando items para edición:", error);
    container.innerHTML = '<div style="text-align:center; color: red; padding: 20px;">Error cargando los ítems. Reintente.</div>';
  }
}

function renderEditItems() {
  const container = document.getElementById('edit-items-container');
  container.innerHTML = '';

  if (_currentEditItems.length === 0) {
    container.innerHTML = '<div style="padding: 15px; color: var(--gray-600);">No hay ítems registrados.</div>';
    return;
  }

  _currentEditItems.forEach((item, itemIdx) => {
    const div = document.createElement('div');
    div.style.cssText = 'border: 1px solid var(--gray-200); border-radius: 8px; padding: 12px; margin-bottom: 12px; background: var(--surface);';

    // Safe access wrapper since DB structure varies (product_name or nombre)
    const itemName = item.product_name || item.nombre || 'Producto Desconocido';
    const itemSizeRange = item.size_range || item.tallaRango || '';
    const exactSize = item.exact_size || item.tallaExacta || '';
    const qty = item.quantity || item.cantidad || 1;

    let headerHtml = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <strong style="color: var(--vino); font-size: 14px;">${itemName}</strong>
                <span style="color: var(--gray-600); font-size: 13px;">${itemSizeRange} (Talla: ${exactSize}) &times; ${qty}</span>
            </div>
        `;

    let piezasHtml = '';
    if (item.piezas && item.piezas.length > 0) {
      item.piezas.forEach((pz, pzIdx) => {
        const deductionVal = typeof pz.deduction === 'number' ? pz.deduction : 0;

        // Determinamos el precio de la pieza en el catálogo para autodeducción
        const productPrice = findPiecePriceInCatalog(_currentEditInstId, itemSizeRange, pz.nombre);
        let deductionHtml = '';

        if (pz.estado === 'Anulado') {
          if (productPrice > 0) {
            deductionHtml = `<div style="font-size: 11.5px; color: var(--red); margin-top: 5px; font-weight: 600;"><i class="fas fa-tag"></i> Deducción automática: -$${productPrice.toLocaleString('es-CO')} c/u</div>`;
          } else {
            // Fallback manual si no existe precio en catálogo
            deductionHtml = `
                          <div style="display:flex; align-items:center; gap: 8px; margin-top: 5px;">
                             <label style="font-size: 11px; color: var(--red); font-weight: 600;">Ingresar Descuento c/u:</label>
                             <input type="number" class="manual-deduction-input" data-item="${itemIdx}" data-pieza="${pzIdx}" value="${deductionVal}" style="width: 100px; padding: 4px; border: 1px solid var(--red); border-radius: 4px; font-size: 12px; outline:none;">
                          </div>
                        `;
          }
        }

        const pieceLineThru = pz.estado === 'Anulado' ? 'text-decoration: line-through; opacity: 0.6;' : '';
        const customSizeText = pz.tallaPersonalizada ? ` <span style="color:var(--gray-600); font-weight:normal; font-size:11.5px;">[${pz.tallaPersonalizada}]</span>` : '';

        piezasHtml += `
                    <div style="display: flex; flex-direction: column; padding: 10px 8px; border-top: 1px solid var(--gray-200);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 13px; font-weight: 500; color: var(--gray-800); ${pieceLineThru}">• ${pz.nombre}${customSizeText}</span>
                            <select onchange="updateEditPieceStatus(${itemIdx}, ${pzIdx}, this.value)" style="padding: 4px 8px; border-radius: 6px; border: 1px solid var(--gray-300); font-size: 12px; width: 130px; font-weight: 500; background: white; outline:none;">
                                <option value="Pendiente" ${pz.estado === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                                <option value="Entregado" ${pz.estado === 'Entregado' ? 'selected' : ''}>✅ Entregado</option>
                                <option value="Apartado" ${pz.estado === 'Apartado' ? 'selected' : ''}>📦 Apartado</option>
                                <option value="Anulado" ${pz.estado === 'Anulado' ? 'selected' : ''}>❌ Anulado</option>
                            </select>
                        </div>
                        ${deductionHtml}
                    </div>
                `;
      });
    } else {
      piezasHtml = '<div style="font-size: 12px; color: var(--gray-500); padding-top: 8px;">Este ítem no tiene desglose de piezas.</div>';
    }

    div.innerHTML = headerHtml + piezasHtml;
    container.appendChild(div);
  });

  // Auto-calculate the status drop down to show what it will be
  const allPieces = _currentEditItems.flatMap(i => i.piezas || []);
  const validPieces = allPieces.filter(p => p.estado !== 'Anulado');
  let autoStatus = 'Pendiente';
  if (validPieces.length > 0 && validPieces.every(p => p.estado === 'Entregado')) {
    autoStatus = 'Entregado';
  }
  document.getElementById('edit-status').value = autoStatus;

  // Listeners para los inputs de deducción manual (si se mostraron)
  document.querySelectorAll('.manual-deduction-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const iIdx = parseInt(e.target.dataset.item);
      const pIdx = parseInt(e.target.dataset.pieza);
      _currentEditItems[iIdx].piezas[pIdx].deduction = Number(e.target.value) || 0;
    });
  });
}

function findPiecePriceInCatalog(instId, sizeRange, pieceName) {
  if (!INSTITUCIONES) return 0;
  const inst = INSTITUCIONES.find(i => i.id === instId);
  if (!inst) return 0;

  const searchName = pieceName.toLowerCase().trim();
  const prod = inst.productos.find(p => p.nombre.toLowerCase().trim() === searchName);
  if (prod && prod.tallas && prod.tallas[sizeRange]) {
    return prod.tallas[sizeRange];
  }
  return 0;
}

window.updateEditPieceStatus = function (itemIdx, pzIdx, newStatus) {
  _currentEditItems[itemIdx].piezas[pzIdx].estado = newStatus;

  // Si la pasó a Anulado, intentamos deducir el precio de catálogo.
  if (newStatus === 'Anulado') {
    const item = _currentEditItems[itemIdx];
    const pz = item.piezas[pzIdx];
    const itemSizeRange = item.size_range || item.tallaRango || '';
    const catalogPrice = findPiecePriceInCatalog(_currentEditInstId, itemSizeRange, pz.nombre);
    if (catalogPrice > 0) {
      pz.deduction = catalogPrice;
    } else {
      pz.deduction = 0; // Forzar a que el pida input manual
    }
  } else {
    // Removemos la deducción
    _currentEditItems[itemIdx].piezas[pzIdx].deduction = 0;
  }

  renderEditItems();
};

function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); }

async function saveEdit() {
  const id = document.getElementById('edit-receipt-id').value;
  const newClientName = document.getElementById('edit-client-name').value.trim();
  const newPhone = document.getElementById('edit-client-phone').value.trim();

  const originalReceipt = allReceipts.find(r => r.id === id);
  if (!originalReceipt) return showToast("❌ Error: Recibo original no encontrado");

  const btn = document.querySelector('.btn-save');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

  try {
    const batch = writeBatch(db);

    let newTotalAmount = 0;
    let allPieces = [];

    _currentEditItems.forEach(item => {
      const itemRef = doc(db, 'receipts', id, 'items', item.id);
      let subItemUnitDeduction = 0;

      if (item.piezas) {
        item.piezas.forEach(pz => {
          allPieces.push(pz);
          if (pz.estado === 'Anulado' && pz.deduction) {
            subItemUnitDeduction += parseFloat(pz.deduction);
          }
        });
      }

      // Compute unit price (fallback to subtotal/quantity heuristic if unit_price absent in older DBs)
      const qty = item.quantity || item.cantidad || 1;
      const baseUnit = item.unit_price || item.precio || (item.subtotal ? item.subtotal / qty : 0);

      // Aplicamos deducciones asegurando no bajar de 0
      const unitAfterDeduction = Math.max(0, baseUnit - subItemUnitDeduction);
      const newItemSubtotal = unitAfterDeduction * qty;

      batch.update(itemRef, { piezas: item.piezas || [], subtotal: newItemSubtotal });
      newTotalAmount += newItemSubtotal;
    });

    // Auto-calclular estado general
    const validPieces = allPieces.filter(p => p.estado !== 'Anulado');
    let newStatus = 'Pendiente';
    if (validPieces.length > 0 && validPieces.every(p => p.estado === 'Entregado')) {
      if (newBalance <= 0) {
        newStatus = 'Entregado';
      } else {
        newStatus = 'Pendiente';
      }
    } else if (validPieces.length === 0 && allPieces.length > 0) {
      newStatus = 'Anulado'; // Si todo anulado
    }

    // Calcular el balance: lo que cuesta ahora TOTAL MENOS lo que se pagó históricamente.
    const totalPaid = originalReceipt.total_paid;
    const newBalance = newTotalAmount - totalPaid;

    const receiptRef = doc(db, 'receipts', id);
    batch.update(receiptRef, {
      client_name: newClientName,
      client_phone: newPhone,
      status: newStatus,
      total_amount: newTotalAmount,
      balance: newBalance
    });

    await batch.commit();

    closeEditModal();
    showToast('✅ Pedido actualizado y valores recalculados');
  } catch (e) {
    console.error(e);
    showToast('❌ Error al guardar');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
  }
}

// ── DELETE / RESTORE ──────────────────────────────────────────────────────
let _confirmCallback = null;
function confirmAnular(id) {
  _confirmCallback = () => deleteReceipt(id);
  document.getElementById('confirm-msg').innerHTML =
    `¿Estás seguro que deseas <strong>anular</strong> este pedido?<br>
        <span style="font-size:12px;color:var(--gray-600)">El pedido quedará en el historial con valor $0 y status Anulado.</span>`;
  document.getElementById('confirm-modal').classList.remove('hidden');
}

async function deleteReceipt(id) {
  try {
    await updateDoc(doc(db, 'receipts', id), {
      status: 'Anulado',
      deleted_at: new Date().toISOString()
    });
    showToast('🗑 Pedido anulado');
  } catch { showToast('❌ Sin conexión'); }
}

async function restoreReceipt(id) {
  try {
    await updateDoc(doc(db, 'receipts', id), {
      status: 'Pendiente',
      deleted_at: null
    });
    showToast('✅ Pedido restaurado');
  } catch { showToast('❌ Sin conexión'); }
}

// ── ABONO MODAL ─────────────────────────────────────────────────────────────
async function openAbonoModal(id) {
  _currentAbonoId = id;
  const modal = document.getElementById('abono-modal');
  const body = document.getElementById('abono-body');
  body.innerHTML = '<p style="text-align:center;padding:20px;color:var(--gray-600)">⏳ Cargando...</p>';
  modal.classList.remove('hidden');

  try {
    // Find receipt locally from snapshot
    const r = allReceipts.find(x => x.id === id);
    if (!r) throw new Error("Receipt not found");

    // Fetch specific payments
    const paySnap = await getDocs(query(collection(db, 'receipts', id, 'payments'), orderBy('created_at', 'asc')));
    const paymentsArray = [];
    paySnap.forEach(d => paymentsArray.push(d.data()));

    const balance = Math.max(0, parseFloat(r.balance));
    const totalPaid = r.total_paid;

    // Payment status color
    let psBg = '#FFF3E0', psTxt = '#E65100', psLabel = '🟡 Abonado';
    if (totalPaid <= 0) { psBg = '#FCE8E6'; psTxt = '#D93025'; psLabel = '🔴 Pendiente'; }
    else if (balance <= 0) { psBg = '#E6F4EA'; psTxt = '#1E8E3E'; psLabel = '✅ Cancelado'; }

    // History rows
    const histRows = paymentsArray.map((p, i) => `
            <tr style="background:${i % 2 === 0 ? 'white' : '#F8F9FA'}">
              <td style="padding:6px 10px">${String(p.created_at || '').slice(0, 16).replace('T', ' ')}</td>
              <td style="padding:6px 10px">${p.payment_method === 'Efectivo' ? '💵 Efectivo' : '📲 Transf.'}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:700">${fmt(p.amount)}</td>
              <td style="padding:6px 10px;color:var(--gray-600);font-size:11px">${p.notes || '—'}</td>
            </tr>`).join('') || `<tr><td colspan="4" style="padding:14px;text-align:center;color:var(--gray-600)">Sin pagos registrados aún</td></tr>`;

    body.innerHTML = `
          <!-- Receipt header -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;font-size:13px">
            <div style="background:#F8F9FA;padding:10px;border-radius:8px">
              <div style="font-size:10px;text-transform:uppercase;color:var(--gray-600);font-weight:700;margin-bottom:3px">Recibo</div>
              <div style="font-size:18px;font-weight:800;color:var(--vino)">${r.number}</div>
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
            <div><span style="color:var(--gray-600);font-weight:600">Niño/a:</span> ${r.client || '—'}</div>
            <div><span style="color:var(--gray-600);font-weight:600">Entrega:</span> ${r.delivery_date || '—'}</div>
            <div><span style="color:var(--gray-600);font-weight:600">Total pedido:</span> <strong>${fmt(r.total)}</strong></div>
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
  } catch (e) {
    console.error(e);
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
    const r = allReceipts.find(x => x.id === id);
    if (!r) throw new Error("Receipt not local");

    const newBalance = Math.max(0, r.balance - amount);

    // Revisar si todas las prendas están entregadas para auto-completar el estado a 'Entregado'
    const itemSnap = await getDocs(collection(db, 'receipts', id, 'items'));
    let allPiecesDelivered = true;
    let hasValidPieces = false;
    let allPiecesAnulados = true;

    itemSnap.forEach(docSnap => {
      const itemData = docSnap.data();
      if (itemData.piezas) {
        itemData.piezas.forEach(pz => {
          if (pz.estado !== 'Anulado') {
            hasValidPieces = true;
            allPiecesAnulados = false;
            if (pz.estado !== 'Entregado') {
              allPiecesDelivered = false;
            }
          }
        });
      }
    });

    let newStatus = r.status || 'Pendiente';
    if (newBalance <= 0 && hasValidPieces && allPiecesDelivered) {
      newStatus = 'Entregado';
    } else if (newBalance > 0 && hasValidPieces && allPiecesDelivered) {
      newStatus = 'Pendiente';
    } else if (!hasValidPieces && allPiecesAnulados && itemSnap.size > 0) {
      newStatus = 'Anulado';
    }

    // Use a Batch: Create payment + update receipt balance
    const batch = writeBatch(db);
    const receiptRef = doc(db, 'receipts', id);
    const paymentRef = doc(collection(receiptRef, 'payments'));

    batch.set(paymentRef, {
      amount: amount,
      payment_method: method,
      notes: notes,
      created_at: new Date().toISOString()
    });

    batch.update(receiptRef, { balance: newBalance, status: newStatus });

    await batch.commit();

    document.getElementById('abono-modal').classList.add('hidden');
    showToast('💰 Abono registrado', 'success');

  } catch (e) {
    console.error(e);
    showToast('❌ Sin conexión con el servidor', 'error');
  }
}

// ── DETAIL MODAL ──────────────────────────────────────────────────────────
async function openDetailModal(id) {
  const modal = document.getElementById('detail-modal');
  const body = document.getElementById('detail-body');
  body.innerHTML = '<p style="text-align:center;padding:30px;color:var(--gray-600)">⏳ Cargando detalle...</p>';
  modal.classList.remove('hidden');

  try {
    const r = allReceipts.find(x => x.id === id);
    if (!r) throw new Error("Local receipt empty");

    const [itemSnap, paySnap] = await Promise.all([
      getDocs(collection(db, 'receipts', id, 'items')),
      getDocs(query(collection(db, 'receipts', id, 'payments'), orderBy('created_at', 'asc'))),
    ]);

    const items = [];
    itemSnap.forEach(d => items.push(d.data()));
    const payments = [];
    paySnap.forEach(d => payments.push(d.data()));

    const dFields = Object.assign({}, r, { items, payments });

    const totalPaid = r.total_paid || 0;
    const balance = Math.max(0, r.balance);
    const payStat = totalPaid <= 0 ? 'Pendiente' : (balance <= 0 ? 'Cancelado' : 'Abonado');
    const psColor = payStat === 'Cancelado' ? '#1E8E3E' : payStat === 'Abonado' ? '#E65100' : '#D93025';
    const psBg = payStat === 'Cancelado' ? '#E6F4EA' : payStat === 'Abonado' ? '#FFF3E0' : '#FCE8E6';

    const rows = (items || []).map((it, i) => {
      let pieceInfo = '';
      if (it.piezas && it.piezas.length > 0) {
        const pNameStr = p => p.nombre + (p.tallaPersonalizada ? ` [${p.tallaPersonalizada}]` : '');
        const ent = it.piezas.filter(p => p.estado === 'Entregado').map(pNameStr).join(', ').toUpperCase();
        const pen = it.piezas.filter(p => p.estado === 'Pendiente').map(pNameStr).join(', ').toUpperCase();
        const apa = it.piezas.filter(p => p.estado === 'Apartado').map(pNameStr).join(', ').toUpperCase();
        const anu = it.piezas.filter(p => p.estado === 'Anulado').map(pNameStr).join(', ').toUpperCase();
        const pArr = [];
        if (ent) pArr.push(`Se entregó ${ent}`);
        if (pen) pArr.push(`NO se entregó ${pen}`);
        if (apa) pArr.push(`📦 APARTADA: ${apa}`);
        if (anu) pArr.push(`❌ CANCELADA y descontada: ${anu}`);
        pieceInfo = pArr.join(' / ');
      } else {
        const stateDesc = (r.status === 'Entregado') ? 'ENTREGADA' : (r.status === 'Anulado' ? 'ANULADA' : 'PENDIENTE');
        pieceInfo = `Estado unitario: ${stateDesc}`;
      }

      return `
            <tr style="background:${i % 2 === 0 ? 'white' : '#F8F9FA'}">
              <td style="padding:8px 12px; ${pieceInfo ? 'padding-bottom:2px;' : ''}">${it.product_name}</td>
              <td style="padding:8px 12px; ${pieceInfo ? 'padding-bottom:2px;' : ''}">${it.size_range || ''} / ${it.exact_size || ''}</td>
              <td style="padding:8px 12px;text-align:right; ${pieceInfo ? 'padding-bottom:2px;' : ''}">${it.quantity}</td>
              <td style="padding:8px 12px;text-align:right; ${pieceInfo ? 'padding-bottom:2px;' : ''}">${fmt(it.unit_price || 0)}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:700; ${pieceInfo ? 'padding-bottom:2px;' : ''}">${fmt(it.subtotal || 0)}</td>
            </tr>
            ${pieceInfo ? `<tr style="background:${i % 2 === 0 ? 'white' : '#F8F9FA'}; border-bottom:1px solid #eaeaea;">
              <td colspan="5" style="padding:0 12px 10px 12px; font-size:10px; color:#6C757D; font-style:italic;">${pieceInfo}</td>
            </tr>` : ''}`;
    }).join('');

    const payRows = (payments || []).map((pay, i) => `
            <tr style="background:${i % 2 === 0 ? 'white' : '#F8F9FA'}">
              <td style="padding:6px 10px;font-size:11px">${String(pay.created_at || '').slice(0, 16).replace('T', ' ')}</td>
              <td style="padding:6px 10px">${pay.payment_method === 'Efectivo' ? '💵' : '📲'} ${pay.payment_method}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:700;color:#1E8E3E">${fmt(pay.amount)}</td>
              <td style="padding:6px 10px;font-size:11px;color:var(--gray-600)">${pay.notes || '—'}</td>
            </tr>`).join('') || `<tr><td colspan="4" style="padding:12px;text-align:center;color:var(--gray-600)">Sin abonos registrados</td></tr>`;

    body.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:13px;margin-bottom:20px">
            <div style="background:#F8F9FA;padding:12px;border-radius:8px">
              <div style="font-size:10px;text-transform:uppercase;color:#6C757D;font-weight:700;margin-bottom:4px">Recibo N°</div>
              <div style="font-size:20px;font-weight:800;color:var(--vino)">${r.number}</div>
            </div>
            <div style="background:#F8F9FA;padding:12px;border-radius:8px">
              <div style="font-size:10px;text-transform:uppercase;color:#6C757D;font-weight:700;margin-bottom:4px">Estado de Pago</div>
              <span style="background:${psBg};color:${psColor};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">${payStat}</span>
            </div>
            <div><div style="font-size:10px;text-transform:uppercase;color:#6C757D;font-weight:700;margin-bottom:2px">Niño/a</div>${r.client || '—'}</div>
            <div><div style="font-size:10px;text-transform:uppercase;color:#6C757D;font-weight:700;margin-bottom:2px">Teléfono</div>${r.phone || '—'}</div>
            <div><div style="font-size:10px;text-transform:uppercase;color:#6C757D;font-weight:700;margin-bottom:2px">Institución</div>${r.institution}</div>
            <div><div style="font-size:10px;text-transform:uppercase;color:#6C757D;font-weight:700;margin-bottom:2px">Entrega Est.</div><strong style="color:var(--vino)">${r.delivery_date || '—'}</strong></div>
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
    window._printReceiptData = { d: dFields, totalPaid, balance, itemRows: rows, payHistRows: payRows };
  } catch {
    body.innerHTML = '<p style="color:red;padding:20px;text-align:center">❌ Error cargando detalle del pedido.</p>';
  }
}

// ── PRINT DETAIL RECEIPT ───────────────────────────────────────────────────
function printDetailReceipt() {
  const data = window._printReceiptData;
  if (!data) return;
  const { d, totalPaid, balance, itemRows, payHistRows } = data;
  const w = window.open('', '_blank', 'width=720,height=900');
  const html = [
    '<!DOCTYPE html><html><head>',
    '<meta charset="UTF-8">',
    '<title>Recibo N\u00b0' + d.number + '<\/title>',
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
    '  <div><div class="lbl">Recibo N\u00b0<\/div><strong style="font-size:20px;color:#7B1929">' + d.number + '<\/strong><\/div>',
    '  <div style="text-align:right"><div class="lbl">Fecha<\/div>' + new Date().toLocaleDateString('es-CO') + '<\/div>',
    '<\/div>',
    '<div class="row" style="margin-top:10px">',
    '  <div><div class="lbl">Ni\u00f1o\/a<\/div><strong>' + (d.client || '\u2014') + '<\/strong><\/div>',
    '  <div><div class="lbl">Tel\u00e9fono<\/div>' + (d.phone || '\u2014') + '<\/div>',
    '<\/div>',
    '<div class="row"><div><div class="lbl">Entrega Estimada<\/div><strong style="color:#7B1929">' + (d.delivery_date || '\u2014') + '<\/strong><\/div><\/div>',
    '<hr>',
    '<div class="lbl" style="margin-bottom:6px">Detalle de Prendas<\/div>',
    '<table><thead><tr>',
    '<th>Prenda<\/th><th>Talla<\/th><th style="text-align:right">Cant.<\/th><th style="text-align:right">P.Unit.<\/th><th style="text-align:right">Subtotal<\/th>',
    '<\/tr><\/thead><tbody>' + (itemRows || '<tr><td colspan="5">Sin prendas<\/td><\/tr>') + '<\/tbody><\/table>',
    '<div style="display:flex;justify-content:space-between;margin-top:10px;padding:10px;background:#F8F9FA;border-radius:6px">',
    '<span style="font-weight:700;color:#7B1929">TOTAL DEL PEDIDO<\/span>',
    '<span style="font-weight:800;color:#7B1929;font-size:16px">' + fmt(d.total || 0) + '<\/span>',
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
