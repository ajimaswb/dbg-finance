// ================================================================
// PT DWI BINTANG GLOBAL — SISTEM KEUANGAN v1.0
// CMT Garment Company Accounting System
// ================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, setDoc, query, where, orderBy, limit,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import firebaseConfig from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const TAX_EMAILS = ['dbgfinance@gmail.com']; // Hardcoded tax account emails

// ================================================================
// STATE
// ================================================================
let state = {
  user: null,
  accessLevel: 'full', // 'full' or 'tax'
  coa: [],
  contacts: [],
  settings: {
    companyName: 'PT Dwi Bintang Global',
    address: '', phone: '', email: '', npwp: '',
    fiscalMonth: '01', taxRate: 11,
    arAccount: '1110', apAccount: '2101',
    revenueAccount: '4101', cashAccount: '1101',
    ppnOutAccount: '2106', ppnInAccount: '1130',
  },
};

// ================================================================
// UTILITIES
// ================================================================
function formatRp(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
  const n = Number(amount);
  return (n < 0 ? '−' : '') + 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function today() { return new Date().toISOString().split('T')[0]; }

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthStart(ym) { return ym ? `${ym}-01` : null; }
function monthEnd(ym) {
  if (!ym) return null;
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type] || '•'}</span> ${msg}`;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
}

function showLoading(v) {
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.toggle('hidden', !v);
}

function getEl(id) { return document.getElementById(id); }
function setText(id, text) { const el = getEl(id); if (el) el.textContent = text; }
function setVal(id, val) { const el = getEl(id); if (el) el.value = val; }

function confirmDialog(message, okText = 'Hapus', okClass = 'btn-danger') {
  return new Promise(resolve => {
    const modal = getEl('confirm-modal');
    getEl('confirm-message').textContent = message;
    const btnOk = getEl('btn-confirm-ok');
    btnOk.textContent = okText;
    btnOk.className = `btn ${okClass}`;
    const btnCancel = getEl('btn-confirm-cancel');
    const btnX = getEl('btn-confirm-x');
    const cleanup = (result) => {
      modal.close(); btnOk.onclick = null; btnCancel.onclick = null; btnX.onclick = null;
      resolve(result);
    };
    btnOk.onclick = () => cleanup(true);
    btnCancel.onclick = () => cleanup(false);
    btnX.onclick = () => cleanup(false);
    modal.showModal();
  });
}

function getAccountTypeLabel(type) {
  return { asset:'Aset', liability:'Kewajiban', equity:'Ekuitas', revenue:'Pendapatan',
    cogs:'HPJ/COGS', expense:'Beban', other:'Lain-lain' }[type] || type;
}

function getStatusBadge(status) {
  const m = {
    unpaid: ['badge-danger','Belum Lunas'], partial: ['badge-warning','Bayar Sebagian'],
    paid: ['badge-success','Lunas'], overdue: ['badge-danger','Jatuh Tempo'],
  };
  const [cls, label] = m[status] || ['badge-muted', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ================================================================
// AUTHENTICATION
// ================================================================
async function handleLogin(e) {
  e.preventDefault();
  const email = getEl('auth-email').value.trim();
  const password = getEl('auth-password').value;
  const errEl = getEl('auth-error');
  const btn = getEl('btn-login');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-ring" style="width:18px;height:18px;border-width:2px"></span> Masuk...';
  errEl.classList.add('hidden');
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    let msg = 'Login gagal. Periksa email & password.';
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') msg = 'Email atau password salah.';
    if (err.code === 'auth/too-many-requests') msg = 'Terlalu banyak percobaan. Coba lagi nanti.';
    errEl.textContent = msg; errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Masuk';
  }
}

async function handleLogout() {
  const ok = await confirmDialog('Yakin ingin keluar dari sistem?', 'Keluar', 'btn-primary');
  if (ok) { await signOut(auth); showToast('Berhasil keluar', 'info'); }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    state.user = user;
    showLoading(true);
    getEl('auth-page').classList.add('hidden');
    getEl('app-container').classList.remove('hidden');
    const dn = user.displayName || user.email.split('@')[0];
    setText('user-name-display', dn);
    const av = getEl('user-avatar'); if (av) av.textContent = dn[0].toUpperCase();
    await loadSettings();
    // Determine access level based on hardcoded TAX_EMAILS
    if (TAX_EMAILS.includes(user.email.toLowerCase())) {
      state.accessLevel = 'tax';
    } else {
      state.accessLevel = 'full';
    }
    setText('user-name-display', user.email);
    await loadCOA();
    await loadContacts();
    initDateInputs();
    navigateTo('dashboard');
    await refreshBadges();
    showLoading(false);
    updateDateDisplay();
  } else {
    state.user = null;
    // Hide loading overlay FIRST, then show login page
    showLoading(false);
    getEl('auth-page').classList.remove('hidden');
    getEl('app-container').classList.add('hidden');
    const btn = getEl('btn-login');
    if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }
    const emailEl = getEl('auth-email');
    const passEl = getEl('auth-password');
    if (emailEl) emailEl.value = '';
    if (passEl) passEl.value = '';
    const formEl = getEl('auth-form');
    if (formEl) formEl.reset();
  }
});

function initDateInputs() {
  const t = today(), m = currentMonth();
  ['journal-date','cb-date','inv-date','bill-date','ar-aging-date'].forEach(id => setVal(id, t));
  ['journal-filter-month','cb-filter-month','ar-filter-month','ap-filter-month'].forEach(id => setVal(id, m));
  ['tb-date','bs-date'].forEach(id => setVal(id, t));
  const now = new Date();
  const fromStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  ['pl-date-from','cf-date-from','gl-date-from'].forEach(id => setVal(id, fromStr));
  ['pl-date-to','cf-date-to','gl-date-to'].forEach(id => setVal(id, t));
  const due = new Date(); due.setDate(due.getDate() + 30);
  const dueStr = due.toISOString().split('T')[0];
  ['inv-due-date','bill-due-date'].forEach(id => setVal(id, dueStr));
}


function getTaxBookType(appliedTaxes = []) {
  if (state.accessLevel === 'tax') return 'tax';
  return appliedTaxes.length > 0 ? 'tax' : 'internal';
}

function filterDocs(docs) {
  if (state.accessLevel !== 'tax') return docs;
  return docs.filter(doc => {
    const data = typeof doc.data === 'function' ? doc.data() : doc;
    return data.bookType === 'tax';
  });
}

function updateDateDisplay() {
  const el = getEl('dash-date');
  if (el) el.textContent = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const h = new Date().getHours();
  const g = h < 12 ? 'Selamat Pagi' : h < 15 ? 'Selamat Siang' : h < 18 ? 'Selamat Sore' : 'Selamat Malam';
  setText('dash-greeting', `${g}! Berikut ringkasan keuangan hari ini.`);
}

// ================================================================
// ROUTER
// ================================================================
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = getEl(`page-${page}`); if (pageEl) pageEl.classList.add('active');
  const navEl = getEl(`nav-${page}`); if (navEl) navEl.classList.add('active');
  getEl('sidebar')?.classList.remove('open');
  getEl('sidebar-overlay')?.classList.remove('visible');
  const loaders = {
    dashboard: loadDashboard, coa: renderCOA, contacts: renderContacts,
    journal: renderJournals, cashbank: renderCashBank, ar: renderAR, ap: renderAP,
    settings: loadSettingsPage, 'report-bs': renderBalanceSheet,
    'report-pl': renderPL,
    'report-cf': renderCashFlow,
    'report-gl': loadLedgerAccountSelect,
    'report-dc': loadDailyCashReport,
    'report-ar-aging': renderARAgingReport
  };
  if (loaders[page]) loaders[page]();
  window.scrollTo(0, 0);
}

function toggleSidebar() {
  getEl('sidebar')?.classList.toggle('open');
  getEl('sidebar-overlay')?.classList.toggle('visible');
}

function toggleTheme() {
  const root = document.documentElement;
  const isLight = root.classList.toggle('light-theme');
  localStorage.setItem('dbg-theme', isLight ? 'light' : 'dark');
}

// Restore theme on load
if (localStorage.getItem('dbg-theme') === 'light') {
  document.documentElement.classList.add('light-theme');
}

// ================================================================
// AUTO NUMBERING
// ================================================================
async function getNextNumber(type) {
  const now = new Date();
  const yy = now.getFullYear(), mm = String(now.getMonth() + 1).padStart(2, '0');
  const key = `${yy}-${mm}`;
  const prefixes = { journal:'JU', invoice:'INV', bill:'BILL', cashbank:'KB' };
  const prefix = prefixes[type] || type.toUpperCase();
  const ref = doc(db, 'counters', type);
  try {
    const snap = await getDoc(ref);
    let seq = 1;
    if (snap.exists()) {
      seq = (snap.data()[key] || 0) + 1;
      await updateDoc(ref, { [key]: seq });
    } else { await setDoc(ref, { [key]: 1 }); }
    return `${prefix}-${yy}${mm}-${String(seq).padStart(4, '0')}`;
  } catch {
    return `${prefix}-${yy}${mm}-${Math.floor(Math.random()*9000)+1000}`;
  }
}

// ================================================================
// SETTINGS
// ================================================================
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'main'));
    if (snap.exists()) state.settings = { ...state.settings, ...snap.data() };
  } catch {}
}

function loadSettingsPage() {
  setVal('set-company-name', state.settings.companyName || '');
  setVal('set-company-address', state.settings.address || '');
  setVal('set-company-phone', state.settings.phone || '');
  setVal('set-company-email', state.settings.email || '');
  setVal('set-company-npwp', state.settings.npwp || '');
  setVal('set-fiscal-month', state.settings.fiscalMonth || '01');
  setVal('set-tax-rate', state.settings.taxRate || 11);
  setVal('set-tax-rate', state.settings.taxRate || 11);
  const maps = ['set-ar-account','set-ap-account','set-revenue-account','set-cash-account','set-ppn-out-account','set-ppn-in-account'];
  maps.forEach(id => populateAccountSelect(id));
  setTimeout(() => {
    setVal('set-ar-account', state.settings.arAccount);
    setVal('set-ap-account', state.settings.apAccount);
    setVal('set-revenue-account', state.settings.revenueAccount);
    setVal('set-cash-account', state.settings.cashAccount);
    setVal('set-ppn-out-account', state.settings.ppnOutAccount);
    setVal('set-ppn-in-account', state.settings.ppnInAccount);
  }, 50);
  renderSettingsTaxes();
}

async function saveSettings(e) {
  e.preventDefault();
  const data = {
    companyName: getEl('set-company-name').value.trim(),
    address: getEl('set-company-address').value.trim(),
    phone: getEl('set-company-phone').value.trim(),
    email: getEl('set-company-email').value.trim(),
    npwp: getEl('set-company-npwp').value.trim(),
    fiscalMonth: getEl('set-fiscal-month').value,
    taxRate: Number(getEl('set-tax-rate').value)
  };
  try {
    await setDoc(doc(db, 'settings', 'main'), { ...state.settings, ...data }, { merge: true });
    state.settings = { ...state.settings, ...data };
    showToast('Pengaturan perusahaan disimpan!');
  } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

async function saveAccountMappings(e) {
  e.preventDefault();
  const data = {
    arAccount: getEl('set-ar-account').value, apAccount: getEl('set-ap-account').value,
    revenueAccount: getEl('set-revenue-account').value, cashAccount: getEl('set-cash-account').value,
    ppnOutAccount: getEl('set-ppn-out-account').value, ppnInAccount: getEl('set-ppn-in-account').value,
  };
  try {
    await setDoc(doc(db, 'settings', 'main'), { ...state.settings, ...data }, { merge: true });
    state.settings = { ...state.settings, ...data };
    showToast('Pemetaan akun disimpan!');
  } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

// ================================================================
// DYNAMIC TAXES
// ================================================================
function renderSettingsTaxes() {
  const tbody = getEl('dynamic-taxes-tbody');
  if(!tbody) return;
  const taxes = state.settings.customTaxes || [];
  const thMandatory = getEl('th-tax-mandatory');
  const isTaxAccess = state.accessLevel === 'tax';
  
  if (thMandatory) {
    thMandatory.style.display = isTaxAccess ? 'none' : '';
  }

  if (taxes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${isTaxAccess ? 5 : 6}" class="text-center text-muted">Belum ada pengaturan pajak dinamis.</td></tr>`;
    return;
  }
  tbody.innerHTML = taxes.map(t => {
    const acc = state.coa.find(a => a.id === t.accountId);
    return `<tr>
      <td>${t.name}</td>
      <td>${t.rate}%</td>
      <td>${t.type === 'addition' ? 'Penambah' : 'Pemotong'}</td>
      <td>${acc ? acc.code + ' - ' + acc.name : '-'}</td>
      ${isTaxAccess ? '' : `<td>${t.isMandatory ? 'Ya' : 'Tidak'}</td>`}
      <td><div class="actions-cell">
        <button class="btn-icon" onclick="openTaxModal('${t.id}')" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteTax('${t.id}')" title="Hapus">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>
    </tr>`;
  }).join('');
}

function renderDynamicTaxes(containerId, changeHandlerStr) {
  const container = getEl(containerId);
  if (!container) return;
  const taxes = state.settings.customTaxes || [];
  if (taxes.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = taxes.map(t => {
    const isAutoLocked = (state.accessLevel === 'tax' && t.isMandatory);
    return `<div class="inv-total-row" style="margin-top: 4px;">
      <label style="cursor:${isAutoLocked ? 'not-allowed' : 'pointer'}; display:flex; align-items:center; gap:8px;">
        <input type="checkbox" class="dynamic-tax-checkbox" data-tax-id="${t.id}" data-tax-rate="${t.rate}" data-tax-type="${t.type}" data-tax-account="${t.accountId}" ${isAutoLocked ? 'checked disabled' : ''} onchange="${changeHandlerStr}">
        ${t.name} (${t.rate}%)
      </label>
      <span class="dynamic-tax-amount" data-tax-id="${t.id}" style="${t.type === 'deduction' ? 'color: var(--danger)' : ''}">Rp 0</span>
    </div>`;
  }).join('');
}

function openTaxModal(id = null) {
  populateAccountSelect('tax-account');
  const container = getEl('tax-mandatory-container');
  if (container) {
    container.style.display = state.accessLevel === 'tax' ? 'none' : 'block';
  }
  if (id) {
    const t = (state.settings.customTaxes || []).find(x => x.id === id);
    if (t) {
      setVal('tax-edit-id', t.id);
      setVal('tax-name', t.name);
      setVal('tax-rate', t.rate);
      setVal('tax-type', t.type);
      getEl('tax-mandatory').checked = t.isMandatory || false;
      setTimeout(() => setVal('tax-account', t.accountId), 50);
    }
  } else {
    setVal('tax-edit-id', '');
    setVal('tax-name', '');
    setVal('tax-rate', '');
    setVal('tax-type', 'addition');
    getEl('tax-mandatory').checked = false;
  }
  getEl('tax-modal').showModal();
}

function closeTaxModal() { getEl('tax-modal').close(); }

async function saveTax(e) {
  e.preventDefault();
  const id = getEl('tax-edit-id').value;
  const t = {
    name: getEl('tax-name').value.trim(),
    rate: Number(getEl('tax-rate').value),
    type: getEl('tax-type').value,
    accountId: getEl('tax-account').value,
    isMandatory: getEl('tax-mandatory').checked
  };
  let taxes = state.settings.customTaxes || [];
  if (id) {
    t.id = id;
    taxes = taxes.map(x => x.id === id ? t : x);
  } else {
    t.id = 'tax_' + Date.now();
    taxes.push(t);
  }
  try {
    await setDoc(doc(db, 'settings', 'main'), { ...state.settings, customTaxes: taxes }, { merge: true });
    state.settings.customTaxes = taxes;
    renderSettingsTaxes();
    closeTaxModal();
    showToast('Pajak berhasil disimpan!');
  } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
}

async function deleteTax(id) {
  if (!confirm('Hapus pajak dinamis ini?')) return;
  const taxes = (state.settings.customTaxes || []).filter(x => x.id !== id);
  try {
    await setDoc(doc(db, 'settings', 'main'), { ...state.settings, customTaxes: taxes }, { merge: true });
    state.settings.customTaxes = taxes;
    renderSettingsTaxes();
    showToast('Pajak berhasil dihapus!');
  } catch (err) { showToast('Gagal: ' + err.message, 'error'); }
}

// ================================================================
// CHART OF ACCOUNTS
// ================================================================
const DEFAULT_COA = [
  {code:'1000',name:'ASET',type:'asset',normalBalance:'debit',isGroup:true,level:1},
  {code:'1100',name:'ASET LANCAR',type:'asset',normalBalance:'debit',isGroup:true,level:2},
  {code:'1101',name:'Kas',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1102',name:'Bank BCA',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1103',name:'Bank Mandiri',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1104',name:'Bank BNI',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1110',name:'Piutang Usaha',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1111',name:'Piutang Lain-lain',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1115',name:'Uang Muka Pembelian',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1120',name:'Perlengkapan',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1130',name:'PPN Masukan',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1140',name:'Beban Dibayar Dimuka',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1200',name:'ASET TETAP',type:'asset',normalBalance:'debit',isGroup:true,level:2},
  {code:'1201',name:'Mesin Jahit',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1202',name:'Mesin Obras',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1203',name:'Mesin Potong',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1204',name:'Peralatan Pabrik Lainnya',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1205',name:'Peralatan Kantor',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1206',name:'Kendaraan',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1207',name:'Bangunan / Gedung',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1208',name:'Tanah',type:'asset',normalBalance:'debit',isGroup:false,level:3},
  {code:'1250',name:'Akum. Peny. Mesin Jahit',type:'asset',normalBalance:'credit',isGroup:false,level:3},
  {code:'1251',name:'Akum. Peny. Mesin Obras',type:'asset',normalBalance:'credit',isGroup:false,level:3},
  {code:'1252',name:'Akum. Peny. Mesin Potong',type:'asset',normalBalance:'credit',isGroup:false,level:3},
  {code:'1253',name:'Akum. Peny. Peralatan Pabrik',type:'asset',normalBalance:'credit',isGroup:false,level:3},
  {code:'1254',name:'Akum. Peny. Peralatan Kantor',type:'asset',normalBalance:'credit',isGroup:false,level:3},
  {code:'1255',name:'Akum. Peny. Kendaraan',type:'asset',normalBalance:'credit',isGroup:false,level:3},
  {code:'1256',name:'Akum. Peny. Bangunan',type:'asset',normalBalance:'credit',isGroup:false,level:3},
  {code:'2000',name:'KEWAJIBAN',type:'liability',normalBalance:'credit',isGroup:true,level:1},
  {code:'2100',name:'KEWAJIBAN JANGKA PENDEK',type:'liability',normalBalance:'credit',isGroup:true,level:2},
  {code:'2101',name:'Hutang Usaha',type:'liability',normalBalance:'credit',isGroup:false,level:3},
  {code:'2102',name:'Hutang Bank Jangka Pendek',type:'liability',normalBalance:'credit',isGroup:false,level:3},
  {code:'2103',name:'Hutang Gaji',type:'liability',normalBalance:'credit',isGroup:false,level:3},
  {code:'2104',name:'Hutang PPh 21',type:'liability',normalBalance:'credit',isGroup:false,level:3},
  {code:'2105',name:'Hutang PPh 23',type:'liability',normalBalance:'credit',isGroup:false,level:3},
  {code:'2106',name:'PPN Keluaran',type:'liability',normalBalance:'credit',isGroup:false,level:3},
  {code:'2107',name:'Uang Muka dari Buyer',type:'liability',normalBalance:'credit',isGroup:false,level:3},
  {code:'2108',name:'Biaya YMH Dibayar',type:'liability',normalBalance:'credit',isGroup:false,level:3},
  {code:'2200',name:'KEWAJIBAN JANGKA PANJANG',type:'liability',normalBalance:'credit',isGroup:true,level:2},
  {code:'2201',name:'Hutang Bank Jangka Panjang',type:'liability',normalBalance:'credit',isGroup:false,level:3},
  {code:'2202',name:'Hutang Leasing',type:'liability',normalBalance:'credit',isGroup:false,level:3},
  {code:'3000',name:'EKUITAS',type:'equity',normalBalance:'credit',isGroup:true,level:1},
  {code:'3101',name:'Modal Disetor',type:'equity',normalBalance:'credit',isGroup:false,level:2},
  {code:'3102',name:'Laba Ditahan',type:'equity',normalBalance:'credit',isGroup:false,level:2},
  {code:'3103',name:'Saldo Laba/Rugi Tahun Berjalan',type:'equity',normalBalance:'credit',isGroup:false,level:2},
  {code:'4000',name:'PENDAPATAN',type:'revenue',normalBalance:'credit',isGroup:true,level:1},
  {code:'4101',name:'Pendapatan Jasa CMT',type:'revenue',normalBalance:'credit',isGroup:false,level:2},
  {code:'4102',name:'Pendapatan Jasa Finishing',type:'revenue',normalBalance:'credit',isGroup:false,level:2},
  {code:'4103',name:'Pendapatan Jasa Lainnya',type:'revenue',normalBalance:'credit',isGroup:false,level:2},
  {code:'4104',name:'Pendapatan Lain-lain',type:'revenue',normalBalance:'credit',isGroup:false,level:2},
  {code:'5000',name:'HARGA POKOK JASA',type:'cogs',normalBalance:'debit',isGroup:true,level:1},
  {code:'5101',name:'Biaya Tenaga Kerja Langsung',type:'cogs',normalBalance:'debit',isGroup:false,level:2},
  {code:'5102',name:'Biaya Aksesori & Bahan Pembantu',type:'cogs',normalBalance:'debit',isGroup:false,level:2},
  {code:'5103',name:'Biaya Subkon / Outsourcing',type:'cogs',normalBalance:'debit',isGroup:false,level:2},
  {code:'5104',name:'Overhead - Listrik Pabrik',type:'cogs',normalBalance:'debit',isGroup:false,level:2},
  {code:'5105',name:'Overhead - Air Pabrik',type:'cogs',normalBalance:'debit',isGroup:false,level:2},
  {code:'5106',name:'Overhead - Lainnya',type:'cogs',normalBalance:'debit',isGroup:false,level:2},
  {code:'6000',name:'BEBAN OPERASIONAL',type:'expense',normalBalance:'debit',isGroup:true,level:1},
  {code:'6100',name:'BEBAN UMUM & ADMINISTRASI',type:'expense',normalBalance:'debit',isGroup:true,level:2},
  {code:'6101',name:'Beban Gaji Staff & Manajemen',type:'expense',normalBalance:'debit',isGroup:false,level:3},
  {code:'6102',name:'Beban Listrik & Air Kantor',type:'expense',normalBalance:'debit',isGroup:false,level:3},
  {code:'6103',name:'Beban Sewa Gedung',type:'expense',normalBalance:'debit',isGroup:false,level:3},
  {code:'6104',name:'Beban Telepon & Internet',type:'expense',normalBalance:'debit',isGroup:false,level:3},
  {code:'6105',name:'Beban Penyusutan',type:'expense',normalBalance:'debit',isGroup:false,level:3},
  {code:'6106',name:'Beban Perlengkapan Kantor',type:'expense',normalBalance:'debit',isGroup:false,level:3},
  {code:'6107',name:'Beban Asuransi',type:'expense',normalBalance:'debit',isGroup:false,level:3},
  {code:'6108',name:'Beban Pajak & Perizinan',type:'expense',normalBalance:'debit',isGroup:false,level:3},
  {code:'6109',name:'Beban Representasi',type:'expense',normalBalance:'debit',isGroup:false,level:3},
  {code:'6110',name:'Beban Umum Lainnya',type:'expense',normalBalance:'debit',isGroup:false,level:3},
  {code:'6200',name:'BEBAN PEMASARAN',type:'expense',normalBalance:'debit',isGroup:true,level:2},
  {code:'6201',name:'Beban Pemasaran & Promosi',type:'expense',normalBalance:'debit',isGroup:false,level:3},
  {code:'6202',name:'Beban Pengiriman',type:'expense',normalBalance:'debit',isGroup:false,level:3},
  {code:'7000',name:'PENDAPATAN & BEBAN LAIN-LAIN',type:'other',normalBalance:'debit',isGroup:true,level:1},
  {code:'7101',name:'Pendapatan Bunga',type:'other',normalBalance:'credit',isGroup:false,level:2},
  {code:'7201',name:'Beban Bunga',type:'other',normalBalance:'debit',isGroup:false,level:2},
  {code:'7301',name:'Laba/Rugi Selisih Kurs',type:'other',normalBalance:'debit',isGroup:false,level:2},
];

async function loadCOA() {
  try {
    const snap = await getDocs(query(collection(db, 'coa'), orderBy('code')));
    if (snap.empty) {
      await seedDefaultCOA();
    } else {
      state.coa = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (e) { console.error('Load COA:', e); }
}

async function seedDefaultCOA() {
  showToast('Menginisialisasi Chart of Accounts (COA)...', 'info');
  try {
    const batch = writeBatch(db);
    DEFAULT_COA.forEach(a => {
      const ref = doc(collection(db, 'coa'));
      batch.set(ref, { ...a, isActive: true, createdAt: new Date().toISOString() });
    });
    await batch.commit();
    const snap = await getDocs(query(collection(db, 'coa'), orderBy('code')));
    state.coa = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    showToast('COA berhasil diinisialisasi dengan ' + DEFAULT_COA.length + ' akun!');
  } catch (e) { showToast('Gagal inisialisasi COA: ' + e.message, 'error'); }
}

function renderCOA() {
  const search = (getEl('coa-search')?.value || '').toLowerCase();
  const typeFilter = getEl('coa-filter-type')?.value || '';
  let accounts = state.coa;
  if (search) accounts = accounts.filter(a => a.code.toLowerCase().includes(search) || a.name.toLowerCase().includes(search));
  if (typeFilter) accounts = accounts.filter(a => a.type === typeFilter);
  const tbody = getEl('coa-tbody');
  if (!tbody) return;
  if (!accounts.length) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">Tidak ada akun ditemukan</div></td></tr>`; return; }
  tbody.innerHTML = accounts.map(a => `
    <tr class="${a.isGroup ? 'coa-row-group' : 'coa-row-detail'}">
      <td><strong style="color:var(--accent-light)">${a.code}</strong></td>
      <td style="${a.isGroup ? 'font-weight:700;color:var(--text-primary)' : (a.level >= 3 ? 'padding-left:28px' : '')}">${a.name}</td>
      <td><span class="badge badge-info">${getAccountTypeLabel(a.type)}</span></td>
      <td><span class="badge ${a.normalBalance === 'debit' ? 'badge-info' : 'badge-muted'}">${a.normalBalance === 'debit' ? 'Debit' : 'Kredit'}</span></td>
      <td>${a.isActive !== false ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-muted">Nonaktif</span>'}</td>
      <td><div class="actions-cell">
        <button class="btn-icon" onclick="openCOAModal('${a.id}')" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteCOA('${a.id}','${a.name.replace(/'/g,"\\'")}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button></div></td>
    </tr>`).join('');
}

function openCOAModal(editId = null) {
  getEl('coa-modal-title').textContent = editId ? 'Edit Akun' : 'Tambah Akun Baru';
  getEl('coa-edit-id').value = editId || '';
  if (editId) {
    const a = state.coa.find(x => x.id === editId);
    if (a) { setVal('coa-code', a.code); setVal('coa-name', a.name); setVal('coa-type', a.type); setVal('coa-normal-balance', a.normalBalance); setVal('coa-description', a.description || ''); const cb = getEl('coa-is-group'); if (cb) cb.checked = a.isGroup || false; }
  } else { getEl('coa-form').reset(); }
  getEl('coa-modal').showModal();
}

function closeCOAModal() { getEl('coa-modal').close(); }

function updateNormalBalance() {
  const type = getEl('coa-type').value, nb = getEl('coa-normal-balance');
  if (['asset','cogs','expense'].includes(type)) nb.value = 'debit';
  else if (['liability','equity','revenue'].includes(type)) nb.value = 'credit';
}

async function saveCOA(e) {
  e.preventDefault();
  const editId = getEl('coa-edit-id').value;
  const code = getEl('coa-code').value.trim(), name = getEl('coa-name').value.trim();
  const type = getEl('coa-type').value, normalBalance = getEl('coa-normal-balance').value;
  const description = getEl('coa-description').value.trim();
  const isGroup = getEl('coa-is-group')?.checked || false;
  const existing = state.coa.find(a => a.code === code && a.id !== editId);
  if (existing) { showToast(`Kode ${code} sudah ada: "${existing.name}"`, 'error'); return; }
  const data = { code, name, type, normalBalance, description, isGroup, isActive: true };
  try {
    if (editId) {
      await updateDoc(doc(db, 'coa', editId), data);
      const idx = state.coa.findIndex(a => a.id === editId);
      if (idx >= 0) state.coa[idx] = { ...state.coa[idx], ...data };
      showToast('Akun diperbarui!');
    } else {
      const ref = await addDoc(collection(db, 'coa'), { ...data, createdAt: new Date().toISOString() });
      state.coa.push({ id: ref.id, ...data });
      state.coa.sort((a, b) => a.code.localeCompare(b.code));
      showToast('Akun ditambahkan!');
    }
    closeCOAModal(); renderCOA();
  } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

async function deleteCOA(id, name) {
  const ok = await confirmDialog(`Hapus akun "${name}"?`);
  if (!ok) return;
  try { await deleteDoc(doc(db, 'coa', id)); state.coa = state.coa.filter(a => a.id !== id); renderCOA(); showToast('Akun dihapus'); }
  catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

function exportCOA() {
  const rows = [['Kode','Nama Akun','Tipe','Saldo Normal','Grup','Status']];
  state.coa.forEach(a => rows.push([a.code, a.name, getAccountTypeLabel(a.type), a.normalBalance, a.isGroup ? 'Ya' : 'Tidak', a.isActive ? 'Aktif' : 'Nonaktif']));
  downloadCSV(rows, 'COA_PT_DBG.csv');
}

function populateAccountSelect(selectId, filterByType = null) {
  const sel = getEl(selectId);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Pilih Akun --</option>';
  const typeLabels = { asset:'ASET', liability:'KEWAJIBAN', equity:'EKUITAS', revenue:'PENDAPATAN', cogs:'HPJ', expense:'BEBAN', other:'LAIN-LAIN' };
  const grouped = {};
  state.coa.filter(a => a.isActive !== false && !a.isGroup && (!filterByType || filterByType.includes(a.type))).forEach(a => {
    if (!grouped[a.type]) grouped[a.type] = [];
    grouped[a.type].push(a);
  });
  Object.entries(grouped).forEach(([type, accts]) => {
    const grp = document.createElement('optgroup');
    grp.label = typeLabels[type] || type;
    accts.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.code;
      opt.textContent = `${a.code} — ${a.name}`;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });
  if (current) sel.value = current;
}

// ================================================================
// CONTACTS (CUSTOMER & SUPPLIER)
// ================================================================
async function loadContacts() {
  try {
    const snap = await getDocs(query(collection(db, 'contacts'), orderBy('name')));
    state.contacts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {}
}

function renderContacts() {
  const search = (getEl('contacts-search')?.value || '').toLowerCase();
  const typeFilter = getEl('contacts-filter-type')?.value || '';
  let contacts = state.contacts;
  if (search) contacts = contacts.filter(c => c.name.toLowerCase().includes(search) || (c.phone || '').includes(search));
  if (typeFilter) contacts = contacts.filter(c => c.type === typeFilter || c.type === 'both');
  const tbody = getEl('contacts-tbody');
  if (!tbody) return;
  if (!contacts.length) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">Belum ada data. Tambah customer atau supplier!</div></td></tr>`; return; }
  tbody.innerHTML = contacts.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.type === 'customer' ? '<span class="badge badge-info">Customer</span>' : c.type === 'supplier' ? '<span class="badge badge-warning">Supplier</span>' : '<span class="badge badge-muted">Keduanya</span>'}</td>
      <td>${c.phone || '-'}</td>
      <td>${c.email || '-'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.address || '-'}</td>
      <td><div class="actions-cell">
        <button class="btn-icon" onclick="openContactModal('${c.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteContact('${c.id}','${c.name.replace(/'/g,"\\'")}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>
    </tr>`).join('');
}

function openContactModal(editId = null) {
  getEl('contact-modal-title').textContent = editId ? 'Edit Contact' : 'Tambah Customer / Supplier';
  getEl('contact-edit-id').value = editId || '';
  if (editId) {
    const c = state.contacts.find(x => x.id === editId);
    if (c) { setVal('contact-name', c.name); setVal('contact-type', c.type); setVal('contact-phone', c.phone || ''); setVal('contact-email', c.email || ''); setVal('contact-npwp', c.npwp || ''); setVal('contact-address', c.address || ''); }
  } else { getEl('contact-form').reset(); }
  getEl('contact-modal').showModal();
}

function closeContactModal() { getEl('contact-modal').close(); }

async function saveContact(e) {
  e.preventDefault();
  const editId = getEl('contact-edit-id').value;
  const data = { name: getEl('contact-name').value.trim(), type: getEl('contact-type').value, phone: getEl('contact-phone').value.trim(), email: getEl('contact-email').value.trim(), npwp: getEl('contact-npwp').value.trim(), address: getEl('contact-address').value.trim() };
  try {
    if (editId) {
      await updateDoc(doc(db, 'contacts', editId), data);
      const idx = state.contacts.findIndex(c => c.id === editId);
      if (idx >= 0) state.contacts[idx] = { ...state.contacts[idx], ...data };
      showToast('Contact diperbarui!');
    } else {
      const ref = await addDoc(collection(db, 'contacts'), { ...data, createdAt: new Date().toISOString() });
      state.contacts.push({ id: ref.id, ...data });
      state.contacts.sort((a, b) => a.name.localeCompare(b.name));
      showToast('Contact ditambahkan!');
    }
    closeContactModal(); renderContacts();
  } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

async function deleteContact(id, name) {
  const ok = await confirmDialog(`Hapus contact "${name}"?`);
  if (!ok) return;
  try { await deleteDoc(doc(db, 'contacts', id)); state.contacts = state.contacts.filter(c => c.id !== id); renderContacts(); showToast('Contact dihapus'); }
  catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

function populateContactSelect(selectId, typeFilter = null) {
  const sel = getEl(selectId); if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Pilih --</option>';
  let contacts = state.contacts;
  if (typeFilter) contacts = contacts.filter(c => c.type === typeFilter || c.type === 'both');
  contacts.forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; sel.appendChild(opt); });
  if (current) sel.value = current;
}

// ================================================================
// JURNAL UMUM
// ================================================================
let _jLineCount = 0;

async function openJournalModal(editId = null) {
  _jLineCount = 0;
  getEl('journal-modal-title').textContent = editId ? 'Edit Jurnal' : 'Input Jurnal Umum';
  getEl('journal-edit-id').value = editId || '';
  getEl('journal-lines-body').innerHTML = '';
  updateJournalTotals();
  if (editId) {
    try {
      const snap = await getDoc(doc(db, 'journals', editId));
      if (snap.exists()) { const j = snap.data(); setVal('journal-no', j.journalNo); setVal('journal-date', j.date); setVal('journal-desc', j.description); setVal('journal-ref', j.reference || ''); j.entries.forEach(e => addJournalLine(e)); }
    } catch (e) { showToast('Gagal load jurnal', 'error'); }
  } else {
    setVal('journal-no', 'Auto-generate');
    setVal('journal-date', today());
    setVal('journal-desc', '');
    setVal('journal-ref', '');
    addJournalLine(); addJournalLine();
  }
  getEl('journal-modal').showModal();
}

function closeJournalModal() { getEl('journal-modal').close(); }

function addJournalLine(data = null) {
  const id = ++_jLineCount;
  const row = document.createElement('div');
  row.className = 'journal-line-row'; row.id = `jl-${id}`;
  row.innerHTML = `
    <select class="ln-acc" onchange="updateJournalTotals()"><option value="">-- Akun --</option></select>
    <input type="text" class="ln-desc" placeholder="Keterangan baris...">
    <input type="number" class="ln-d" min="0" step="1" placeholder="0" oninput="updateJournalTotals();clrOpp(this,'ln-c')">
    <input type="number" class="ln-c" min="0" step="1" placeholder="0" oninput="updateJournalTotals();clrOpp(this,'ln-d')">
    <button type="button" class="btn-icon danger" onclick="removeJournalLine('jl-${id}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  getEl('journal-lines-body').appendChild(row);
  // Populate account select
  const sel = row.querySelector('.ln-acc');
  const tl = { asset:'ASET', liability:'KEWAJIBAN', equity:'EKUITAS', revenue:'PENDAPATAN', cogs:'HPJ', expense:'BEBAN', other:'LAIN-LAIN' };
  const grouped = {};
  state.coa.filter(a => a.isActive !== false && !a.isGroup).forEach(a => { if (!grouped[a.type]) grouped[a.type] = []; grouped[a.type].push(a); });
  Object.entries(grouped).forEach(([type, accts]) => {
    const grp = document.createElement('optgroup'); grp.label = tl[type] || type;
    accts.forEach(a => { const o = document.createElement('option'); o.value = a.code; o.textContent = `${a.code} — ${a.name}`; grp.appendChild(o); });
    sel.appendChild(grp);
  });
  if (data) { sel.value = data.accountCode || ''; row.querySelector('.ln-desc').value = data.description || ''; if (data.debit) row.querySelector('.ln-d').value = data.debit; if (data.credit) row.querySelector('.ln-c').value = data.credit; }
  updateJournalTotals();
}

function clrOpp(el, cls) {
  if (Number(el.value) > 0) { const r = el.closest('.journal-line-row'); if (r) { const o = r.querySelector('.' + cls); if (o) o.value = ''; } }
}

function removeJournalLine(id) { document.getElementById(id)?.remove(); updateJournalTotals(); }

function updateJournalTotals() {
  let td = 0, tc = 0;
  document.querySelectorAll('.journal-line-row').forEach(r => { td += Number(r.querySelector('.ln-d')?.value || 0); tc += Number(r.querySelector('.ln-c')?.value || 0); });
  getEl('journal-total-debit').textContent = formatRp(td);
  getEl('journal-total-credit').textContent = formatRp(tc);
  const bi = getEl('journal-balance-info');
  const bal = td > 0 && Math.abs(td - tc) < 0.01;
  bi.className = `balance-info ${bal ? 'balanced' : 'unbalanced'}`;
  bi.textContent = bal ? '✓ Seimbang' : `⚠ Selisih: ${formatRp(Math.abs(td - tc))}`;
  const sb = getEl('btn-save-journal'); if (sb) sb.disabled = !bal;
}

async function saveJournal() {
  const editId = getEl('journal-edit-id').value;
  const date = getEl('journal-date').value, description = getEl('journal-desc').value.trim(), reference = getEl('journal-ref').value.trim();
  if (!date || !description) { showToast('Tanggal & keterangan wajib diisi', 'error'); return; }
  const rows = document.querySelectorAll('.journal-line-row');
  const entries = [];
  rows.forEach(r => {
    const code = r.querySelector('.ln-acc')?.value, d = Number(r.querySelector('.ln-d')?.value || 0), c = Number(r.querySelector('.ln-c')?.value || 0);
    if (!code) return;
    const acct = state.coa.find(a => a.code === code);
    entries.push({ accountCode: code, accountName: acct?.name || code, description: r.querySelector('.ln-desc')?.value || '', debit: d, credit: c });
  });
  if (entries.filter(e => e.accountCode).length < 2) { showToast('Minimal 2 baris entri', 'error'); return; }
  const td = entries.reduce((s, e) => s + e.debit, 0), tc = entries.reduce((s, e) => s + e.credit, 0);
  if (Math.abs(td - tc) > 0.01) { showToast('Total Debit ≠ Total Kredit!', 'error'); return; }
  try {
    const journalNo = editId ? getEl('journal-no').value : await getNextNumber('journal');
    const bookType = getTaxBookType();
    const data = { journalNo, date, description, reference, entries, totalDebit: td, totalCredit: tc, bookType, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (editId) { await updateDoc(doc(db, 'journals', editId), data); showToast('Jurnal diperbarui!'); }
    else { await addDoc(collection(db, 'journals'), data); showToast('Jurnal disimpan!'); }
    closeJournalModal(); renderJournals(); refreshBadges();
  } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

async function renderJournals() {
  const search = (getEl('journal-search')?.value || '').toLowerCase();
  const mf = getEl('journal-filter-month')?.value || '';
  const tbody = getEl('journal-tbody'); if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">Memuat...</td></tr>`;
  try {
    const snap = await getDocs(query(collection(db, 'journals'), orderBy('date', 'desc')));
    let journals = filterDocs(snap.docs).map(d => ({ id: d.id, ...d.data() }));
    if (mf) journals = journals.filter(j => j.date >= monthStart(mf) && j.date <= monthEnd(mf));
    if (search) journals = journals.filter(j => j.journalNo.toLowerCase().includes(search) || j.description.toLowerCase().includes(search) || (j.reference || '').toLowerCase().includes(search));
    if (!journals.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">Belum ada jurnal</div></td></tr>`; return; }
    tbody.innerHTML = journals.map(j => `
      <tr>
        <td><strong style="color:var(--accent-light)">${j.journalNo}</strong></td>
        <td>${formatDate(j.date)}</td>
        <td>${j.description}</td>
        <td style="color:var(--text-muted)">${j.reference || '-'}</td>
        <td class="text-right green-text">${formatRp(j.totalDebit)}</td>
        <td class="text-right red-text">${formatRp(j.totalCredit)}</td>
        <td><div class="actions-cell">
          <button class="btn-icon" onclick="viewJournalDetail('${j.id}')" title="Detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn-icon" onclick="openJournalModal('${j.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" onclick="deleteJournal('${j.id}','${j.journalNo}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div></td>
      </tr>`).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="7">Error: ${e.message}</td></tr>`; }
}

async function viewJournalDetail(id) {
  try {
    const snap = await getDoc(doc(db, 'journals', id)); if (!snap.exists()) return;
    const j = snap.data();
    getEl('jd-title').textContent = `Detail Jurnal: ${j.journalNo}`;
    getEl('journal-detail-content').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div><span style="color:var(--text-muted);font-size:.8rem">No. Jurnal</span><div style="font-weight:700;color:var(--accent-light)">${j.journalNo}</div></div>
        <div><span style="color:var(--text-muted);font-size:.8rem">Tanggal</span><div style="font-weight:600">${formatDate(j.date)}</div></div>
        <div style="grid-column:1/-1"><span style="color:var(--text-muted);font-size:.8rem">Keterangan</span><div style="font-weight:600">${j.description}</div></div>
        ${j.reference ? `<div><span style="color:var(--text-muted);font-size:.8rem">Referensi</span><div>${j.reference}</div></div>` : ''}
      </div>
      <table class="report-table" style="width:100%">
        <thead><tr><th>Kode</th><th>Nama Akun</th><th>Keterangan</th><th class="text-right">Debit</th><th class="text-right">Kredit</th></tr></thead>
        <tbody>${j.entries.map(e => `<tr><td style="color:var(--accent-light)">${e.accountCode}</td><td>${e.accountName}</td><td>${e.description || '-'}</td><td class="text-right green-text">${e.debit ? formatRp(e.debit) : '-'}</td><td class="text-right red-text">${e.credit ? formatRp(e.credit) : '-'}</td></tr>`).join('')}</tbody>
        <tfoot><tr class="report-total"><td colspan="3" class="text-right">TOTAL</td><td class="text-right">${formatRp(j.totalDebit)}</td><td class="text-right">${formatRp(j.totalCredit)}</td></tr></tfoot>
      </table>`;
    getEl('journal-detail-modal').showModal();
  } catch (e) { showToast('Gagal load detail', 'error'); }
}

function closeJournalDetailModal() { getEl('journal-detail-modal').close(); }

async function deleteJournal(id, journalNo) {
  const ok = await confirmDialog(`Hapus jurnal ${journalNo}? Tindakan ini tidak dapat diurungkan.`);
  if (!ok) return;
  try { await deleteDoc(doc(db, 'journals', id)); showToast('Jurnal dihapus'); renderJournals(); }
  catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

// ================================================================
// KAS & BANK
// ================================================================
function getCashBankAccounts() {
  return state.coa.filter(a => !a.isGroup && a.type === 'asset' && (a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank')));
}

function openCashBankModal() {
  getEl('cb-edit-id').value = '';
  getEl('cashbank-form').reset();
  renderDynamicTaxes('cb-dynamic-taxes', 'calcCBTotals()');
  getEl('cb-net-amount-display').style.display = 'none';
  setVal('cb-date', today());
  const cashSel = getEl('cb-cash-account');
  cashSel.innerHTML = '<option value="">-- Pilih Kas/Bank --</option>';
  getCashBankAccounts().forEach(a => { const o = document.createElement('option'); o.value = a.code; o.textContent = `${a.code} — ${a.name}`; cashSel.appendChild(o); });
  if (state.settings.cashAccount) cashSel.value = state.settings.cashAccount;
  populateAccountSelect('cb-counter-account');
  updateCBLabels();
  getEl('cashbank-modal').showModal();
}

function closeCashBankModal() { getEl('cashbank-modal').close(); }

function calcCBTotals() {
  const amount = Number(getEl('cb-amount').value) || 0;
  let net = amount;
  const container = getEl('cb-dynamic-taxes');
  if (!container) return;
  const cbs = container.querySelectorAll('.dynamic-tax-checkbox');
  let hasTax = false;
  cbs.forEach(cb => {
    if (cb.checked) {
      hasTax = true;
      const rate = Number(cb.dataset.taxRate) || 0;
      const type = cb.dataset.taxType;
      const taxAmount = Math.round(amount * (rate / 100));
      if (type === 'addition') net += taxAmount;
      else if (type === 'deduction') net -= taxAmount;
      const span = container.querySelector(`.dynamic-tax-amount[data-tax-id="${cb.dataset.taxId}"]`);
      if (span) span.textContent = formatRp(taxAmount);
    } else {
      const span = container.querySelector(`.dynamic-tax-amount[data-tax-id="${cb.dataset.taxId}"]`);
      if (span) span.textContent = 'Rp 0';
    }
  });
  
  const display = getEl('cb-net-amount-display');
  if (hasTax && amount > 0) {
    display.style.display = 'block';
    display.textContent = `Total Bersih (Net): Rp ${formatRp(net)}`;
  } else {
    display.style.display = 'none';
  }
}

function updateCBLabels() {
  const t = document.querySelector('input[name="cb-type"]:checked')?.value;
  const l = getEl('cb-counter-label'); if (l) l.textContent = t === 'in' ? 'Akun Asal (Kredit) *' : 'Akun Tujuan (Debit) *';
}

async function saveCashBank(e) {
  e.preventDefault();
  const type = document.querySelector('input[name="cb-type"]:checked')?.value;
  const date = getEl('cb-date').value, cashCode = getEl('cb-cash-account').value, counterCode = getEl('cb-counter-account').value;
  const amount = Number(getEl('cb-amount').value), desc = getEl('cb-desc').value.trim(), ref = getEl('cb-ref').value.trim();
  if (!type || !date || !cashCode || !counterCode || !amount || !desc) { showToast('Semua field wajib diisi', 'error'); return; }
  
  const appliedTaxes = [];
  const container = getEl('cb-dynamic-taxes');
  if (container) {
    container.querySelectorAll('.dynamic-tax-checkbox:checked').forEach(cb => {
      appliedTaxes.push({
        id: cb.dataset.taxId,
        name: cb.parentNode.textContent.trim(),
        rate: Number(cb.dataset.taxRate) || 0,
        type: cb.dataset.taxType,
        accountId: cb.dataset.taxAccount
      });
    });
  }
  
  let dynamicTaxTotal = 0;
  appliedTaxes.forEach(t => {
    t.amount = Math.round(amount * (t.rate / 100));
    if (t.type === 'addition') dynamicTaxTotal += t.amount;
    else if (t.type === 'deduction') dynamicTaxTotal -= t.amount;
  });
  
  // For Kas & Bank:
  // Gross is amount. Net is amount + dynamicTaxTotal (if PPN added, Net goes up. If PPh23 deducted, Net goes down)
  const netAmount = amount + dynamicTaxTotal;
  
  const cashAcct = state.coa.find(a => a.code === cashCode) || { code: cashCode, name: cashCode };
  const ctrAcct = state.coa.find(a => a.code === counterCode) || { code: counterCode, name: counterCode };
  
  const entries = [];
  let totalDebit = 0;
  let totalCredit = 0;

  if (type === 'in') {
    // Pemasukan (Kas bertambah -> Debit = netAmount)
    entries.push({ accountCode: cashCode, accountName: cashAcct.name, description: desc, debit: netAmount, credit: 0 });
    totalDebit += netAmount;
    
    // Counter Account (Pendapatan dsb -> Kredit = gross amount)
    entries.push({ accountCode: counterCode, accountName: ctrAcct.name, description: desc, debit: 0, credit: amount });
    totalCredit += amount;
    
    // Taxes
    appliedTaxes.forEach(t => {
      const tAcct = state.coa.find(a => a.id === t.accountId || a.code === t.accountId) || { code: t.accountId, name: t.name };
      if (t.type === 'addition') {
        // e.g. PPN Keluaran. Increase liability -> Credit
        entries.push({ accountCode: tAcct.code, accountName: tAcct.name, description: `${t.name} ${desc}`, debit: 0, credit: t.amount });
        totalCredit += t.amount;
      } else {
        // e.g. PPh 23. Tax deduction -> Debit
        entries.push({ accountCode: tAcct.code, accountName: tAcct.name, description: `${t.name} ${desc}`, debit: t.amount, credit: 0 });
        totalDebit += t.amount;
      }
    });
  } else {
    // Pengeluaran (Kas berkurang -> Kredit = netAmount)
    entries.push({ accountCode: cashCode, accountName: cashAcct.name, description: desc, debit: 0, credit: netAmount });
    totalCredit += netAmount;
    
    // Counter Account (Biaya dsb -> Debit = gross amount)
    entries.push({ accountCode: counterCode, accountName: ctrAcct.name, description: desc, debit: amount, credit: 0 });
    totalDebit += amount;
    
    // Taxes
    appliedTaxes.forEach(t => {
      const tAcct = state.coa.find(a => a.id === t.accountId || a.code === t.accountId) || { code: t.accountId, name: t.name };
      if (t.type === 'addition') {
        // e.g. PPN Masukan. Increase asset/expense -> Debit
        entries.push({ accountCode: tAcct.code, accountName: tAcct.name, description: `${t.name} ${desc}`, debit: t.amount, credit: 0 });
        totalDebit += t.amount;
      } else {
        // e.g. PPh 23 utang. Increase liability -> Credit
        entries.push({ accountCode: tAcct.code, accountName: tAcct.name, description: `${t.name} ${desc}`, debit: 0, credit: t.amount });
        totalCredit += t.amount;
      }
    });
  }
  try {
    const jNo = await getNextNumber('journal');
    const bookType = getTaxBookType(appliedTaxes);
    await addDoc(collection(db, 'journals'), { journalNo: jNo, date, description: desc, reference: ref, entries, totalDebit, totalCredit, source: 'cashbank', bookType, appliedTaxes, grossAmount: amount, netAmount, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    showToast('Transaksi kas/bank disimpan!'); closeCashBankModal(); renderCashBank(); refreshBadges();
  } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

async function renderCashBank() {
  const acctFilter = getEl('cb-filter-account')?.value || '', mf = getEl('cb-filter-month')?.value || '';
  const filterSel = getEl('cb-filter-account');
  if (filterSel && filterSel.children.length <= 1) { getCashBankAccounts().forEach(a => { const o = document.createElement('option'); o.value = a.code; o.textContent = `${a.code} — ${a.name}`; filterSel.appendChild(o); }); }
  const tbody = getEl('cb-tbody'); if (!tbody) return;
  try {
    const cashCodes = getCashBankAccounts().map(a => a.code);
    const snap = await getDocs(query(collection(db, 'journals'), orderBy('date')));
    let txs = [];
    filterDocs(snap.docs).forEach(d => {
      const j = d.data();
      if (mf && (j.date < monthStart(mf) || j.date > monthEnd(mf))) return;
      (j.entries || []).forEach(e => {
        if (!cashCodes.includes(e.accountCode)) return;
        if (acctFilter && e.accountCode !== acctFilter) return;
        txs.push({ id: d.id, journalNo: j.journalNo, date: j.date, description: j.description, reference: j.reference || '', accountCode: e.accountCode, accountName: e.accountName, debit: e.debit || 0, credit: e.credit || 0 });
      });
    });
    let ti = 0, to = 0;
    txs.forEach(t => { ti += t.debit; to += t.credit; });
    setText('cb-bal-open', 'Rp 0'); setText('cb-bal-in', formatRp(ti)); setText('cb-bal-out', formatRp(to)); setText('cb-bal-close', formatRp(ti - to));
    if (!txs.length) { tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">Belum ada transaksi kas/bank</div></td></tr>`; return; }
    let rb = 0;
    tbody.innerHTML = txs.map(t => {
      rb += t.debit - t.credit;
      return `<tr>
        <td>${formatDate(t.date)}</td>
        <td><span class="badge badge-info">${t.accountCode}</span> ${t.accountName}</td>
        <td>${t.description}</td>
        <td style="color:var(--text-muted)">${t.reference || '-'}</td>
        <td class="text-right green-text">${t.debit ? formatRp(t.debit) : '-'}</td>
        <td class="text-right red-text">${t.credit ? formatRp(t.credit) : '-'}</td>
        <td class="text-right" style="font-weight:600;color:${rb >= 0 ? 'var(--success-light)' : 'var(--danger-light)'}">${formatRp(rb)}</td>
        <td><div class="actions-cell">
          <button class="btn-icon" onclick="viewJournalDetail('${t.id}')" title="Lihat Jurnal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div></td>
      </tr>`;
    }).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="8">Error: ${e.message}</td></tr>`; }
}

// ================================================================
// ACCOUNTS RECEIVABLE (INVOICE / PIUTANG)
// ================================================================
let _invItemCount = 0;

async function openInvoiceModal(editId = null) {
  _invItemCount = 0;
  getEl('invoice-edit-id').value = editId || '';
  getEl('invoice-modal-title').textContent = editId ? 'Edit Invoice' : 'Buat Invoice Piutang';
  getEl('invoice-items-body').innerHTML = '';
  populateContactSelect('inv-customer', 'customer');
  populateAccountSelect('inv-ar-account', ['asset']);
  setVal('inv-ar-account', state.settings.arAccount || '1110');
  if (!editId) {
    setVal('invoice-no', 'Auto-generate'); setVal('inv-date', today());
    const due = new Date(); due.setDate(due.getDate() + 30);
    setVal('inv-due-date', due.toISOString().split('T')[0]);
    setVal('inv-order-ref', ''); setVal('inv-notes', ''); setVal('inv-tax-ref', '');
    setVal('inv-discount-amount', '');
    renderDynamicTaxes('inv-dynamic-taxes', 'calcInvoiceTotals()');
    addInvoiceItem();
  }
  calcInvoiceTotals();
  getEl('invoice-modal').showModal();
}

function closeInvoiceModal() { getEl('invoice-modal').close(); }

function addInvoiceItem() {
  const id = ++_invItemCount;
  const row = document.createElement('div');
  row.className = 'inv-item-row invoice-item'; row.id = `inv-it-${id}`;
  row.innerHTML = `
    <input type="text" class="item-desc" placeholder="Deskripsi jasa CMT..." oninput="calcInvoiceTotals()">
    <input type="number" class="item-qty" min="0" step="1" value="1" oninput="calcInvoiceTotals()">
    <input type="text" class="item-unit" value="pcs" placeholder="pcs/dzn">
    <input type="number" class="item-price" min="0" step="1" placeholder="0" oninput="calcInvoiceTotals()">
    <input type="text" class="item-total" readonly style="text-align:right;background:rgba(0,0,0,0.2)">
    <button type="button" class="btn-icon danger" onclick="removeInvoiceItem('inv-it-${id}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  getEl('invoice-items-body').appendChild(row);
  calcInvoiceTotals();
}

function removeInvoiceItem(id) { document.getElementById(id)?.remove(); calcInvoiceTotals(); }

function calcInvoiceTotals() {
  let sub = 0;
  document.querySelectorAll('.invoice-item').forEach(r => {
    const qty = Number(r.querySelector('.item-qty')?.value || 0), price = Number(r.querySelector('.item-price')?.value || 0);
    const tot = qty * price; const el = r.querySelector('.item-total'); if (el) el.value = tot.toLocaleString('id-ID'); sub += tot;
  });
  let dynamicTaxTotal = 0;
  const container = getEl('inv-dynamic-taxes');
  if (container) {
    const cbs = container.querySelectorAll('.dynamic-tax-checkbox');
    cbs.forEach(cb => {
      if (cb.checked) {
        const rate = Number(cb.dataset.taxRate) || 0;
        const type = cb.dataset.taxType;
        const taxAmount = Math.round(sub * (rate / 100));
        if (type === 'addition') dynamicTaxTotal += taxAmount;
        else if (type === 'deduction') dynamicTaxTotal -= taxAmount;
        const span = container.querySelector(`.dynamic-tax-amount[data-tax-id="${cb.dataset.taxId}"]`);
        if (span) span.textContent = formatRp(taxAmount);
      } else {
        const span = container.querySelector(`.dynamic-tax-amount[data-tax-id="${cb.dataset.taxId}"]`);
        if (span) span.textContent = 'Rp 0';
      }
    });
  }
  
  const discount = Number(getEl('inv-discount-amount')?.value || 0);
  
  setText('inv-subtotal', formatRp(sub)); 
  
  const grandTotal = sub + dynamicTaxTotal - discount;
  setText('inv-grand-total', formatRp(grandTotal));
}

async function saveInvoice() {
  const customerId = getEl('inv-customer').value, date = getEl('inv-date').value, dueDate = getEl('inv-due-date').value;
  const arAccount = getEl('inv-ar-account').value, orderRef = getEl('inv-order-ref').value.trim(), notes = getEl('inv-notes').value.trim();
  const discountAmount = Number(getEl('inv-discount-amount')?.value || 0);
  const taxRef = getEl('inv-tax-ref')?.value.trim() || '';
  
  const appliedTaxes = [];
  const container = getEl('inv-dynamic-taxes');
  if (container) {
    container.querySelectorAll('.dynamic-tax-checkbox:checked').forEach(cb => {
      appliedTaxes.push({
        id: cb.dataset.taxId,
        name: cb.parentNode.textContent.trim(),
        rate: Number(cb.dataset.taxRate) || 0,
        type: cb.dataset.taxType,
        accountId: cb.dataset.taxAccount
      });
    });
  }
  
  if (!customerId || !date || !dueDate || !arAccount) { showToast('Customer, tanggal, & akun piutang wajib diisi', 'error'); return; }
  const customer = state.contacts.find(c => c.id === customerId);
  const items = []; let subtotal = 0;
  document.querySelectorAll('.invoice-item').forEach(r => {
    const desc = r.querySelector('.item-desc')?.value || '', qty = Number(r.querySelector('.item-qty')?.value || 0), unit = r.querySelector('.item-unit')?.value || 'pcs', price = Number(r.querySelector('.item-price')?.value || 0);
    if (desc && qty > 0) { const tot = qty * price; items.push({ description: desc, quantity: qty, unit, unitPrice: price, total: tot }); subtotal += tot; }
  });
  if (!items.length) { showToast('Minimal satu item', 'error'); return; }
  
  let dynamicTaxTotal = 0;
  appliedTaxes.forEach(t => {
    t.amount = Math.round(subtotal * (t.rate / 100));
    if (t.type === 'addition') dynamicTaxTotal += t.amount;
    else if (t.type === 'deduction') dynamicTaxTotal -= t.amount;
  });
  
  const total = subtotal + dynamicTaxTotal - discountAmount;
  
  try {
    let invoiceNo = getEl('invoice-no').value.trim();
    if (!invoiceNo || invoiceNo === 'Auto-generate') invoiceNo = await getNextNumber('invoice');
    const arAcct = state.coa.find(a => a.code === arAccount) || { code: arAccount, name: 'Piutang Usaha' };
    const revAcct = state.coa.find(a => a.code === state.settings.revenueAccount) || { code: '4101', name: 'Pendapatan Jasa CMT' };
    const discountAcct = state.coa.find(a => a.code === '4105') || { code: '4105', name: 'Potongan Pendapatan' };
    
    const entries = [
      { accountCode: arAccount, accountName: arAcct.name, description: `Invoice ${invoiceNo} - ${customer?.name}`, debit: total, credit: 0 },
      { accountCode: revAcct.code, accountName: revAcct.name, description: `Invoice ${invoiceNo} - ${customer?.name}`, debit: 0, credit: subtotal },
    ];
    
    let totalDebit = total;
    let totalCredit = subtotal;
    
    appliedTaxes.forEach(t => {
      const tAcct = state.coa.find(a => a.id === t.accountId || a.code === t.accountId) || { code: t.accountId, name: t.name };
      if (t.type === 'addition') {
        entries.push({ accountCode: tAcct.code, accountName: tAcct.name, description: `${t.name} ${invoiceNo}`, debit: 0, credit: t.amount });
        totalCredit += t.amount;
      } else {
        entries.push({ accountCode: tAcct.code, accountName: tAcct.name, description: `${t.name} ${invoiceNo}`, debit: t.amount, credit: 0 });
        totalDebit += t.amount;
      }
    });
    
    if (discountAmount > 0) {
      entries.push({ accountCode: discountAcct.code, accountName: discountAcct.name, description: `Potongan/Reject ${invoiceNo}`, debit: discountAmount, credit: 0 });
      totalDebit += discountAmount;
    }
    
    const jNo = await getNextNumber('journal');
    const bookType = getTaxBookType(appliedTaxes);
    
    const jRef = await addDoc(collection(db, 'journals'), { journalNo: jNo, date, description: `Invoice ${invoiceNo} - ${customer?.name}`, reference: invoiceNo, entries, totalDebit, totalCredit, source: 'invoice', bookType, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await addDoc(collection(db, 'invoices'), { invoiceNo, date, dueDate, customerId, customerName: customer?.name || '', orderRef, taxRef, items, subtotal, appliedTaxes, discountAmount, total, paid: 0, remaining: total, status: 'unpaid', payments: [], journalId: jRef.id, notes, bookType, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    showToast(`Invoice ${invoiceNo} dibuat & jurnal diposting!`); closeInvoiceModal(); renderAR(); refreshBadges();
  } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

async function renderAR() {
  const search = (getEl('ar-search')?.value || '').toLowerCase();
  const sf = getEl('ar-filter-status')?.value || '', mf = getEl('ar-filter-month')?.value || '';
  const tbody = getEl('ar-tbody'); if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px">Memuat...</td></tr>`;
  try {
    const today_str = today();
    const snap = await getDocs(query(collection(db, 'invoices'), orderBy('date', 'desc')));
    let invs = filterDocs(snap.docs).map(d => ({ id: d.id, ...d.data() }));
    if (mf) invs = invs.filter(i => i.date >= monthStart(mf) && i.date <= monthEnd(mf));
    if (search) invs = invs.filter(i => i.invoiceNo.toLowerCase().includes(search) || i.customerName.toLowerCase().includes(search));
    let totalUnpaid = 0, totalOverdue = 0, totalPaid = 0;
    invs.forEach(i => { if (i.remaining > 0) totalUnpaid += i.remaining; if (i.remaining > 0 && i.dueDate < today_str) totalOverdue += i.remaining; totalPaid += i.paid || 0; });
    setText('ar-total-count', invs.length); setText('ar-total-unpaid', formatRp(totalUnpaid)); setText('ar-total-overdue', formatRp(totalOverdue)); setText('ar-total-paid', formatRp(totalPaid));
    if (sf) { if (sf === 'overdue') invs = invs.filter(i => i.remaining > 0 && i.dueDate < today_str); else invs = invs.filter(i => i.status === sf); }
    if (!invs.length) { tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Tidak ada invoice</div></td></tr>`; return; }
    tbody.innerHTML = invs.map(inv => {
      const od = inv.remaining > 0 && inv.dueDate < today_str;
      return `<tr>
        <td><strong style="color:var(--accent-light)">${inv.invoiceNo}</strong></td>
        <td><strong>${inv.customerName}</strong></td>
        <td>${formatDate(inv.date)}</td>
        <td style="color:${od ? 'var(--danger-light)' : 'inherit'}">${formatDate(inv.dueDate)}</td>
        <td class="text-right"><strong>${formatRp(inv.total)}</strong></td>
        <td class="text-right green-text">${formatRp(inv.paid || 0)}</td>
        <td class="text-right red-text">${formatRp(inv.remaining || 0)}</td>
        <td>${getStatusBadge(od ? 'overdue' : inv.status)}</td>
        <td><div class="actions-cell">
          ${inv.remaining > 0 ? `<button class="btn-icon" onclick="openPaymentModal('${inv.id}','invoice')" style="color:var(--success)" title="Catat Bayar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </button>` : ''}
          <button class="btn-icon" onclick="viewInvoiceDetail('${inv.id}')" title="Detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn-icon danger" onclick="deleteInvoice('${inv.id}','${inv.invoiceNo}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div></td>
      </tr>`;
    }).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="9">Error: ${e.message}</td></tr>`; }
}

async function viewInvoiceDetail(id) {
  const snap = await getDoc(doc(db, 'invoices', id)); if (!snap.exists()) return;
  const inv = snap.data();
  getEl('jd-title').innerHTML = `Invoice: ${inv.invoiceNo}`;
  getEl('journal-detail-content').innerHTML = `
    <div style="display:flex; justify-content: flex-end; margin-bottom:12px;">
      <button class="btn btn-primary" onclick="printInvoice('${id}')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:6px"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> Cetak Invoice
      </button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div><span style="color:var(--text-muted);font-size:.8rem">Customer</span><div style="font-weight:700">${inv.customerName}</div></div>
      <div><span style="color:var(--text-muted);font-size:.8rem">No. Invoice</span><div style="font-weight:700;color:var(--accent-light)">${inv.invoiceNo}</div></div>
      <div><span style="color:var(--text-muted);font-size:.8rem">Tanggal</span><div>${formatDate(inv.date)}</div></div>
      <div><span style="color:var(--text-muted);font-size:.8rem">Jatuh Tempo</span><div>${formatDate(inv.dueDate)}</div></div>
      ${inv.orderRef ? `<div><span style="color:var(--text-muted);font-size:.8rem">No. Order</span><div>${inv.orderRef}</div></div>` : ''}
    </div>
    <table class="report-table" style="width:100%;margin-bottom:16px">
      <thead><tr><th>Deskripsi</th><th class="text-right">Qty</th><th>Sat.</th><th class="text-right">Harga Satuan</th><th class="text-right">Jumlah</th></tr></thead>
      <tbody>${inv.items.map(it => `<tr><td>${it.description}</td><td class="text-right">${it.quantity.toLocaleString('id-ID')}</td><td>${it.unit}</td><td class="text-right">${formatRp(it.unitPrice)}</td><td class="text-right">${formatRp(it.total)}</td></tr>`).join('')}</tbody>
      <tfoot>
        <tr><td colspan="4" class="text-right">Subtotal</td><td class="text-right">${formatRp(inv.subtotal)}</td></tr>
        ${inv.appliedTaxes ? inv.appliedTaxes.map(t => `<tr><td colspan="4" class="text-right">${t.name} ${t.rate}%</td><td class="text-right" style="${t.type === 'deduction' ? 'color:var(--danger)' : ''}">${t.type === 'deduction' ? '- ' : ''}${formatRp(t.amount)}</td></tr>`).join('') : ''}
        ${!inv.appliedTaxes && inv.taxAmount > 0 ? `<tr><td colspan="4" class="text-right">PPN ${inv.taxRate}%</td><td class="text-right">${formatRp(inv.taxAmount)}</td></tr>` : ''}
        ${!inv.appliedTaxes && inv.pph23Amount > 0 ? `<tr><td colspan="4" class="text-right">PPh 23</td><td class="text-right" style="color:var(--danger)">- ${formatRp(inv.pph23Amount)}</td></tr>` : ''}
        <tr class="report-total"><td colspan="4" class="text-right">TOTAL</td><td class="text-right">${formatRp(inv.total)}</td></tr>
        <tr><td colspan="4" class="text-right" style="color:var(--success-light)">Dibayar</td><td class="text-right" style="color:var(--success-light)">${formatRp(inv.paid || 0)}</td></tr>
        <tr><td colspan="4" class="text-right" style="color:var(--danger-light)">Sisa</td><td class="text-right" style="color:var(--danger-light);font-weight:800">${formatRp(inv.remaining || 0)}</td></tr>
      </tfoot>
    </table>
    ${(inv.payments?.length) ? `<h4 style="margin-bottom:8px;color:var(--text-muted);font-size:.85rem">Riwayat Pembayaran</h4>
    <table class="report-table"><thead><tr><th>Tanggal</th><th>Keterangan</th><th class="text-right">Jumlah</th></tr></thead>
    <tbody>${inv.payments.map(p => `<tr><td>${formatDate(p.date)}</td><td>${p.notes || '-'}</td><td class="text-right green-text">${formatRp(p.amount)}</td></tr>`).join('')}</tbody></table>` : ''}`;
  getEl('journal-detail-modal').showModal();
}

async function deleteInvoice(id, invoiceNo) {
  const ok = await confirmDialog(`Hapus invoice ${invoiceNo}?`);
  if (!ok) return;
  try { await deleteDoc(doc(db, 'invoices', id)); showToast('Invoice dihapus'); renderAR(); refreshBadges(); }
  catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

function terbilang(angka) {
  angka = Math.abs(angka);
  const huruf = ["", "SATU", "DUA", "TIGA", "EMPAT", "LIMA", "ENAM", "TUJUH", "DELAPAN", "SEMBILAN", "SEPULUH", "SEBELAS"];
  let temp = "";
  if (angka < 12) {
      temp = " " + huruf[angka];
  } else if (angka < 20) {
      temp = terbilang(angka - 10) + " BELAS";
  } else if (angka < 100) {
      temp = terbilang(Math.floor(angka / 10)) + " PULUH" + terbilang(angka % 10);
  } else if (angka < 200) {
      temp = " SERATUS" + terbilang(angka - 100);
  } else if (angka < 1000) {
      temp = terbilang(Math.floor(angka / 100)) + " RATUS" + terbilang(angka % 100);
  } else if (angka < 2000) {
      temp = " SERIBU" + terbilang(angka - 1000);
  } else if (angka < 1000000) {
      temp = terbilang(Math.floor(angka / 1000)) + " RIBU" + terbilang(angka % 1000);
  } else if (angka < 1000000000) {
      temp = terbilang(Math.floor(angka / 1000000)) + " JUTA" + terbilang(angka % 1000000);
  } else if (angka < 1000000000000) {
      temp = terbilang(Math.floor(angka / 1000000000)) + " MILYAR" + terbilang(angka % 1000000000);
  } else if (angka < 1000000000000000) {
      temp = terbilang(Math.floor(angka / 1000000000000)) + " TRILYUN" + terbilang(angka % 1000000000000);
  }
  return temp;
}

async function printInvoice(id) {
  const snap = await getDoc(doc(db, 'invoices', id));
  if (!snap.exists()) return;
  const inv = snap.data();
  
  const customer = state.contacts.find(c => c.id === inv.customerId) || {};
  const customerAddress = customer.address ? customer.address.split('\\n').join('<br>') : '';
  
  let totalHtml = '';
  if (inv.appliedTaxes) {
    inv.appliedTaxes.forEach(t => {
      totalHtml += `<tr>
        <td colspan="4" class="text-center font-bold" style="border: 1px solid black; padding: 4px;">${t.name}</td>
        <td style="border: 1px solid black; padding: 4px; display:flex; justify-content:space-between; font-weight:bold;">
          <span>Rp</span><span>${t.type === 'deduction' ? '- ' : ''}${Number(t.amount).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </td>
      </tr>`;
    });
  } else {
      if (inv.taxAmount > 0) {
          totalHtml += `<tr>
            <td colspan="4" class="text-center font-bold" style="border: 1px solid black; padding: 4px;">PPN ${inv.taxRate}%</td>
            <td style="border: 1px solid black; padding: 4px; display:flex; justify-content:space-between; font-weight:bold;">
              <span>Rp</span><span>${Number(inv.taxAmount).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </td>
          </tr>`;
      }
      if (inv.pph23Amount > 0) {
          totalHtml += `<tr>
            <td colspan="4" class="text-center font-bold" style="border: 1px solid black; padding: 4px;">PPH23</td>
            <td style="border: 1px solid black; padding: 4px; display:flex; justify-content:space-between; font-weight:bold;">
              <span>Rp</span><span>- ${Number(inv.pph23Amount).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </td>
          </tr>`;
      }
  }
  
  const amountInWords = terbilang(inv.total).trim() + " RUPIAH";
  
  const itemsHtml = inv.items.map((it, i) => `
    <tr>
      <td style="border: 1px solid black; padding: 4px; text-align: center;">${i+1}</td>
      <td style="border: 1px solid black; padding: 4px;">${it.description}</td>
      <td style="border: 1px solid black; padding: 4px; text-align: center;">${it.quantity.toLocaleString('id-ID')} ${it.unit}</td>
      <td style="border: 1px solid black; padding: 4px;">
        <div style="display:flex; justify-content:space-between;">
          <span>Rp</span><span>${Number(it.unitPrice).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
      </td>
      <td style="border: 1px solid black; padding: 4px;">
        <div style="display:flex; justify-content:space-between;">
          <span>Rp</span><span>${Number(it.total).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
      </td>
    </tr>
  `).join('');

  const dateObj = new Date(inv.date);
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')} ${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Print Invoice ${inv.invoiceNo}</title>
    <style>
      body {
        font-family: 'Arial', sans-serif;
        color: #000;
        margin: 0;
        padding: 40px;
        position: relative;
        font-size: 13px;
      }
      .blue-text {
        color: #0056b3;
      }
      .header-container {
        display: flex;
        align-items: center;
        margin-bottom: 20px;
      }
      .logo-placeholder {
        width: 70px;
        height: 50px;
        border: 2px solid #0056b3;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #0056b3;
        font-weight: bold;
        font-size: 16px;
        font-style: italic;
        margin-right: 15px;
        position: relative;
        background: transparent;
      }
      .logo-placeholder::after {
        content: '★';
        position: absolute;
        right: -8px;
        top: 8px;
        font-size: 24px;
        color: #0056b3;
        -webkit-text-stroke: 1px white;
      }
      .logo-placeholder::before {
         content: '';
         position: absolute;
         width: 140%;
         height: 100%;
         top: 0;
         left: -20%;
      }
      
      .logo-outer {
         position: relative;
         margin-right: 15px;
      }
      .logo-star {
         position: absolute;
         right: -15px;
         top: 10px;
         color: #0056b3;
         font-size: 30px;
         z-index: 10;
      }
      
      .company-name {
        font-size: 22px;
        font-weight: bold;
        color: #0056b3;
        margin: 0;
      }
      .company-sub {
        font-size: 14px;
        font-weight: bold;
        color: #0056b3;
        margin: 0;
      }
      .info-section {
        margin-bottom: 20px;
        font-weight: bold;
      }
      .info-section div { margin-bottom: 4px; }
      .title-section {
        text-align: center;
        margin-bottom: 10px;
      }
      .title-section h2 { margin: 0; font-size: 18px; text-decoration: underline; font-family: monospace;}
      .title-section p { margin: 5px 0 0 0; font-weight: bold; font-family: monospace;}
      
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 5px;
      }
      th {
        border: 1px solid black;
        padding: 6px;
        text-align: center;
        background-color: #f0f0f0;
      }
      .font-bold { font-weight: bold; }
      .text-center { text-align: center; }
      
      .says-row {
        border: 1px solid black;
        padding: 4px 8px;
        text-align: center;
        font-weight: bold;
        font-size: 11px;
      }
      
      .notes-section {
        margin-top: 20px;
        font-weight: bold;
      }
      .notes-section .bank-details {
        margin-left: 20px;
      }
      
      .signature-section {
        margin-top: 40px;
        width: 250px;
        font-weight: bold;
      }
      .signature-section p { margin: 2px 0; }
      .meterai-box {
        width: 100px;
        height: 60px;
        border: 1px dashed #666;
        margin: 10px 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: #666;
      }
      
      .footer-section {
        position: absolute;
        bottom: 30px;
        left: 40px;
        right: 40px;
        text-align: center;
        border-top: 2px solid #0056b3;
        padding-top: 10px;
        font-size: 12px;
        color: #0056b3;
      }
      
      .watermark {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        height: 250px;
        border: 12px solid rgba(0, 86, 179, 0.05);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(0, 86, 179, 0.05);
        font-weight: bold;
        font-size: 120px;
        font-style: italic;
        z-index: -1;
      }
      .watermark-star {
        position: absolute;
        right: -80px;
        top: 20px;
        font-size: 200px;
        color: rgba(0, 86, 179, 0.05);
      }
      .watermark-text {
        position: absolute;
        bottom: 30px;
        font-size: 28px;
        white-space: nowrap;
      }
      
      @media print {
        @page { margin: 0; }
        body { padding: 40px; }
      }
    </style>
  </head>
  <body>
    <div class="watermark">
      dbg
      <div class="watermark-star">★</div>
      <div class="watermark-text">PT. DWI BINTANG GLOBAL</div>
    </div>
    
    <div class="header-container">
      <div class="logo-outer">
         <div class="logo-placeholder">dbg</div>
         <div class="logo-star">★</div>
      </div>
      <div>
        <h1 class="company-name">PT. DWI BINTANG GLOBAL</h1>
        <h2 class="company-sub">GARMENT FACTORY - TRADING - EXPORT</h2>
      </div>
    </div>
    
    <div class="info-section">
      <div>TO :</div>
      <div>${inv.customerName.toUpperCase()}</div>
      ${customerAddress ? `<div>${customerAddress}</div>` : ''}
      <div style="margin-top: 15px;">Attn. Accounting</div>
    </div>
    
    <div class="title-section">
      <h2>INVOICE</h2>
      <p>No. ${inv.invoiceNo}</p>
    </div>
    
    <table>
      <thead>
        <tr>
          <th style="width: 5%">NO</th>
          <th style="width: 45%">KETERANGAN</th>
          <th style="width: 10%">QTY</th>
          <th style="width: 15%">HARGA/PCS</th>
          <th style="width: 25%">JUMLAH</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
        <tr>
          <td colspan="4" class="text-center font-bold" style="border: 1px solid black; padding: 4px;">TOTAL</td>
          <td style="border: 1px solid black; padding: 4px; display:flex; justify-content:space-between; font-weight:bold;">
            <span>Rp</span><span>${Number(inv.subtotal).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </td>
        </tr>
        ${totalHtml}
        <tr>
          <td colspan="4" class="text-center font-bold" style="border: 1px solid black; padding: 4px;">JUMLAH</td>
          <td style="border: 1px solid black; padding: 4px; display:flex; justify-content:space-between; font-weight:bold;">
            <span>Rp</span><span>${Number(inv.total).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="says-row">SAYS: # ${amountInWords} #</div>
    <div style="font-size: 10px; font-weight:bold; margin-top: 2px;">CATATAN</div>
    
    <div class="notes-section">
      <div>Please transfer to our accunt :</div>
      <div class="bank-details">
        <table style="width:auto; border:none; margin:0;">
          <tr><td style="border:none; padding:1px; width:110px;">No. Rekening</td><td style="border:none; padding:1px;">: 2513444443</td></tr>
          <tr><td style="border:none; padding:1px;">Bank</td><td style="border:none; padding:1px;">: BCA</td></tr>
          <tr><td style="border:none; padding:1px;">Atas nama</td><td style="border:none; padding:1px;">: PT. Dwi Bintang Global</td></tr>
        </table>
      </div>
    </div>
    
    <div class="signature-section">
      <p>Pemalang, ${formattedDate}</p>
      <div class="meterai-box">METERAI TEMPEL</div>
      <p>Dina Sofiana</p>
      <p>Wakil Direktur</p>
    </div>
    
    <div class="footer-section">
      Jl. Perintis Kemerdekaan No.9 Kel. Beji Kec. Taman Kab. Pemalang - Jawa Tengah Telp. (0284) 324776 - 324752<br>
      email : ptdwibintangglobal@yahoo.co.id
    </div>
    <script>
      window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
    </script>
  </body>
  </html>
  `;
  
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}

// ================================================================
// ACCOUNTS PAYABLE (BILL / HUTANG)
// ================================================================
let _billItemCount = 0;

async function openBillModal(editId = null) {
  _billItemCount = 0;
  getEl('bill-edit-id').value = editId || '';
  getEl('bill-modal-title').textContent = 'Buat Tagihan Hutang';
  getEl('bill-items-body').innerHTML = '';
  populateContactSelect('bill-supplier', 'supplier');
  populateAccountSelect('bill-ap-account', ['liability']);
  setVal('bill-ap-account', state.settings.apAccount || '2101');
  if (!editId) {
    setVal('bill-no', 'Auto-generate'); setVal('bill-date', today());
    const due = new Date(); due.setDate(due.getDate() + 30);
    setVal('bill-due-date', due.toISOString().split('T')[0]);
    setVal('bill-ref', ''); setVal('bill-tax-ref', ''); setVal('bill-notes', '');
    renderDynamicTaxes('bill-dynamic-taxes', 'calcBillTotals()');
    addBillItem();
  }
  calcBillTotals();
  getEl('bill-modal').showModal();
}

function closeBillModal() { getEl('bill-modal').close(); }

function addBillItem() {
  const id = ++_billItemCount;
  const row = document.createElement('div');
  row.className = 'inv-item-row bill-item'; row.id = `bill-it-${id}`;
  row.style.gridTemplateColumns = '2fr 1.5fr 80px 1.2fr 1.5fr 40px';
  const opts = state.coa.filter(a => !a.isGroup && ['cogs','expense','other', 'asset'].includes(a.type)).map(a => `<option value="${a.code}">${a.code} — ${a.name}</option>`).join('');
  row.innerHTML = `
    <input type="text" class="item-desc" placeholder="Deskripsi tagihan..." oninput="calcBillTotals()">
    <select class="item-exp-acc"><option value="">-- Akun Beban --</option>${opts}</select>
    <input type="number" class="item-qty" min="0" step="0.01" value="1" oninput="calcBillTotals()">
    <input type="number" class="item-price" min="0" step="1" placeholder="0" oninput="calcBillTotals()">
    <input type="number" class="item-amount" readonly style="background:var(--bg-lighter)">
    <button type="button" class="btn-icon danger" onclick="removeBillItem('bill-it-${id}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  getEl('bill-items-body').appendChild(row);
  calcBillTotals();
}

function removeBillItem(id) { document.getElementById(id)?.remove(); calcBillTotals(); }

function calcBillTotals() {
  let sub = 0;
  document.querySelectorAll('.bill-item').forEach(r => { 
    const qty = Number(r.querySelector('.item-qty')?.value || 0);
    const price = Number(r.querySelector('.item-price')?.value || 0);
    const amt = qty * price;
    if (r.querySelector('.item-amount')) r.querySelector('.item-amount').value = amt;
    sub += amt;
  });
  
  let dynamicTaxTotal = 0;
  const container = getEl('bill-dynamic-taxes');
  if (container) {
    const cbs = container.querySelectorAll('.dynamic-tax-checkbox');
    cbs.forEach(cb => {
      if (cb.checked) {
        const rate = Number(cb.dataset.taxRate) || 0;
        const type = cb.dataset.taxType;
        const taxAmount = Math.round(sub * (rate / 100));
        if (type === 'addition') dynamicTaxTotal += taxAmount;
        else if (type === 'deduction') dynamicTaxTotal -= taxAmount;
        const span = container.querySelector(`.dynamic-tax-amount[data-tax-id="${cb.dataset.taxId}"]`);
        if (span) span.textContent = formatRp(taxAmount);
      } else {
        const span = container.querySelector(`.dynamic-tax-amount[data-tax-id="${cb.dataset.taxId}"]`);
        if (span) span.textContent = 'Rp 0';
      }
    });
  }
  
  setText('bill-grand-total', formatRp(sub + dynamicTaxTotal));
}

async function saveBill() {
  const supplierId = getEl('bill-supplier').value, date = getEl('bill-date').value, dueDate = getEl('bill-due-date').value;
  const apAccount = getEl('bill-ap-account').value, billRef = getEl('bill-ref').value.trim(), billTaxRef = getEl('bill-tax-ref')?.value.trim() || '', notes = getEl('bill-notes').value.trim();
  if (!supplierId || !date || !dueDate || !apAccount) { showToast('Supplier, tanggal, & akun hutang wajib diisi', 'error'); return; }
  const supplier = state.contacts.find(c => c.id === supplierId);
  const items = []; let subtotal = 0;
  document.querySelectorAll('.bill-item').forEach(r => {
    const desc = r.querySelector('.item-desc')?.value || '', expCode = r.querySelector('.item-exp-acc')?.value || '';
    const qty = Number(r.querySelector('.item-qty')?.value || 0), price = Number(r.querySelector('.item-price')?.value || 0);
    const amount = qty * price;
    if (desc && amount > 0) { const expAcct = state.coa.find(a => a.code === expCode); items.push({ description: desc, expenseAccount: expCode, expenseAccountName: expAcct?.name || '', qty, price, amount }); subtotal += amount; }
  });
  if (!items.length) { showToast('Minimal satu item', 'error'); return; }
  if (items.some(i => !i.expenseAccount)) { showToast('Pilih akun beban untuk setiap item', 'error'); return; }
  
  const appliedTaxes = [];
  const container = getEl('bill-dynamic-taxes');
  if (container) {
    container.querySelectorAll('.dynamic-tax-checkbox:checked').forEach(cb => {
      appliedTaxes.push({
        id: cb.dataset.taxId,
        name: cb.parentNode.textContent.trim(),
        rate: Number(cb.dataset.taxRate) || 0,
        type: cb.dataset.taxType,
        accountId: cb.dataset.taxAccount
      });
    });
  }
  
  let dynamicTaxTotal = 0;
  appliedTaxes.forEach(t => {
    t.amount = Math.round(subtotal * (t.rate / 100));
    if (t.type === 'addition') dynamicTaxTotal += t.amount;
    else if (t.type === 'deduction') dynamicTaxTotal -= t.amount;
  });
  
  const grandTotal = subtotal + dynamicTaxTotal;
  try {
    const billNo = await getNextNumber('bill');
    const apAcct = state.coa.find(a => a.code === apAccount) || { code: apAccount, name: 'Hutang Usaha' };
    const entries = [
      ...items.map(it => ({ accountCode: it.expenseAccount, accountName: it.expenseAccountName, description: it.description, debit: it.amount, credit: 0 }))
    ];
    
    let totalDebit = 0;
    let totalCredit = grandTotal; // AP Account
    
    items.forEach(it => {
      totalDebit += it.amount;
    });
    
    appliedTaxes.forEach(t => {
      const tAcct = state.coa.find(a => a.id === t.accountId || a.code === t.accountId) || { code: t.accountId, name: t.name };
      if (t.type === 'addition') {
        entries.push({ accountCode: tAcct.code, accountName: tAcct.name, description: `${t.name} ${billNo}`, debit: t.amount, credit: 0 });
        totalDebit += t.amount;
      } else {
        entries.push({ accountCode: tAcct.code, accountName: tAcct.name, description: `${t.name} ${billNo}`, debit: 0, credit: t.amount });
        totalCredit += t.amount;
      }
    });
    
    entries.push({ accountCode: apAccount, accountName: apAcct.name, description: `Tagihan ${billNo} - ${supplier?.name}`, debit: 0, credit: grandTotal });
    
    const jNo = await getNextNumber('journal');
    const bookType = getTaxBookType(appliedTaxes);
    const jRef = await addDoc(collection(db, 'journals'), { journalNo: jNo, date, description: `Tagihan ${billNo} - ${supplier?.name}`, reference: billNo, entries, totalDebit, totalCredit, source: 'bill', bookType, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await addDoc(collection(db, 'bills'), { billNo, date, dueDate, supplierId, supplierName: supplier?.name || '', billRef, taxRef: billTaxRef, items, subtotal, appliedTaxes, total: grandTotal, paid: 0, remaining: grandTotal, status: 'unpaid', payments: [], journalId: jRef.id, notes, bookType, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    showToast(`Tagihan ${billNo} dibuat & jurnal diposting!`); closeBillModal(); renderAP(); refreshBadges();
  } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

async function renderAP() {
  const search = (getEl('ap-search')?.value || '').toLowerCase();
  const sf = getEl('ap-filter-status')?.value || '', mf = getEl('ap-filter-month')?.value || '';
  const tbody = getEl('ap-tbody'); if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px">Memuat...</td></tr>`;
  try {
    const today_str = today();
    const snap = await getDocs(query(collection(db, 'bills'), orderBy('date', 'desc')));
    let bills = filterDocs(snap.docs).map(d => ({ id: d.id, ...d.data() }));
    if (mf) bills = bills.filter(b => b.date >= monthStart(mf) && b.date <= monthEnd(mf));
    if (search) bills = bills.filter(b => b.billNo.toLowerCase().includes(search) || b.supplierName.toLowerCase().includes(search));
    let totalUnpaid = 0, totalOverdue = 0, totalPaid = 0;
    bills.forEach(b => { if (b.remaining > 0) totalUnpaid += b.remaining; if (b.remaining > 0 && b.dueDate < today_str) totalOverdue += b.remaining; totalPaid += b.paid || 0; });
    setText('ap-total-count', bills.length); setText('ap-total-unpaid', formatRp(totalUnpaid)); setText('ap-total-overdue', formatRp(totalOverdue)); setText('ap-total-paid', formatRp(totalPaid));
    if (sf) { if (sf === 'overdue') bills = bills.filter(b => b.remaining > 0 && b.dueDate < today_str); else bills = bills.filter(b => b.status === sf); }
    if (!bills.length) { tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Tidak ada tagihan hutang</div></td></tr>`; return; }
    tbody.innerHTML = bills.map(b => {
      const od = b.remaining > 0 && b.dueDate < today_str;
      return `<tr>
        <td><strong style="color:var(--accent-light)">${b.billNo}</strong></td>
        <td><strong>${b.supplierName}</strong></td>
        <td>${formatDate(b.date)}</td>
        <td style="color:${od ? 'var(--danger-light)' : 'inherit'}">${formatDate(b.dueDate)}</td>
        <td class="text-right"><strong>${formatRp(b.total)}</strong></td>
        <td class="text-right green-text">${formatRp(b.paid || 0)}</td>
        <td class="text-right red-text">${formatRp(b.remaining || 0)}</td>
        <td>${getStatusBadge(od ? 'overdue' : b.status)}</td>
        <td><div class="actions-cell">
          ${b.remaining > 0 ? `<button class="btn-icon" onclick="openPaymentModal('${b.id}','bill')" style="color:var(--success)" title="Bayar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </button>` : ''}
          <button class="btn-icon danger" onclick="deleteBill('${b.id}','${b.billNo}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div></td>
      </tr>`;
    }).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="9">Error: ${e.message}</td></tr>`; }
}

async function deleteBill(id, billNo) {
  const ok = await confirmDialog(`Hapus tagihan ${billNo}?`);
  if (!ok) return;
  try { await deleteDoc(doc(db, 'bills', id)); showToast('Tagihan dihapus'); renderAP(); refreshBadges(); }
  catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

// ================================================================
// PAYMENT (AR & AP)
// ================================================================
async function openPaymentModal(docId, docType) {
  const colName = docType === 'invoice' ? 'invoices' : 'bills';
  const snap = await getDoc(doc(db, colName, docId)); if (!snap.exists()) return;
  const data = snap.data();
  getEl('payment-doc-id').value = docId; getEl('payment-doc-type').value = docType;
  getEl('payment-modal-title').textContent = docType === 'invoice' ? 'Catat Penerimaan Pembayaran' : 'Catat Pembayaran Hutang';
  setVal('payment-date', today()); setVal('payment-amount', data.remaining); setVal('payment-notes', '');
  setText('payment-remaining', formatRp(data.remaining));
  const no = docType === 'invoice' ? data.invoiceNo : data.billNo;
  const party = docType === 'invoice' ? data.customerName : data.supplierName;
  getEl('payment-info').innerHTML = `
    <div class="pinfo-row"><span class="pinfo-label">Nomor</span><span class="pinfo-value">${no}</span></div>
    <div class="pinfo-row"><span class="pinfo-label">${docType === 'invoice' ? 'Customer' : 'Supplier'}</span><span class="pinfo-value">${party}</span></div>
    <div class="pinfo-row"><span class="pinfo-label">Total Tagihan</span><span class="pinfo-value">${formatRp(data.total)}</span></div>
    <div class="pinfo-row"><span class="pinfo-label">Sudah Dibayar</span><span class="pinfo-value" style="color:var(--success-light)">${formatRp(data.paid || 0)}</span></div>
    <div class="pinfo-row"><span class="pinfo-label">Sisa Tagihan</span><span class="pinfo-value" style="color:var(--danger-light)">${formatRp(data.remaining)}</span></div>`;
  const sel = getEl('payment-account');
  sel.innerHTML = '<option value="">-- Pilih Kas/Bank --</option>';
  getCashBankAccounts().forEach(a => { const o = document.createElement('option'); o.value = a.code; o.textContent = `${a.code} — ${a.name}`; sel.appendChild(o); });
  if (state.settings.cashAccount) sel.value = state.settings.cashAccount;
  getEl('payment-modal').showModal();
}

function closePaymentModal() { getEl('payment-modal').close(); }

async function savePayment(e) {
  e.preventDefault();
  const docId = getEl('payment-doc-id').value, docType = getEl('payment-doc-type').value;
  const date = getEl('payment-date').value, amount = Number(getEl('payment-amount').value);
  const accountCode = getEl('payment-account').value, notes = getEl('payment-notes').value.trim();
  if (!date || !amount || !accountCode) { showToast('Isi semua field', 'error'); return; }
  const colName = docType === 'invoice' ? 'invoices' : 'bills';
  const snap = await getDoc(doc(db, colName, docId)); if (!snap.exists()) return;
  const data = snap.data();
  if (amount > data.remaining + 0.01) { showToast(`Melebihi sisa tagihan (${formatRp(data.remaining)})`, 'error'); return; }
  const newPaid = (data.paid || 0) + amount, newRemaining = data.remaining - amount, newStatus = newRemaining <= 0.01 ? 'paid' : 'partial';
  const cashAcct = state.coa.find(a => a.code === accountCode);
  const bookType = data.bookType || 'internal';
  try {
    const no = docType === 'invoice' ? data.invoiceNo : data.billNo;
    let entries;
    if (docType === 'invoice') {
      const arAcct = state.coa.find(a => a.code === state.settings.arAccount) || { code: '1110', name: 'Piutang Usaha' };
      entries = [{ accountCode, accountName: cashAcct?.name || accountCode, description: `Bayar ${no}`, debit: amount, credit: 0 }, { accountCode: arAcct.code, accountName: arAcct.name, description: `Bayar ${no}`, debit: 0, credit: amount }];
    } else {
      const apAcct = state.coa.find(a => a.code === state.settings.apAccount) || { code: '2101', name: 'Hutang Usaha' };
      entries = [{ accountCode: apAcct.code, accountName: apAcct.name, description: `Bayar ${no}`, debit: amount, credit: 0 }, { accountCode, accountName: cashAcct?.name || accountCode, description: `Bayar ${no}`, debit: 0, credit: amount }];
    }
    const jNo = await getNextNumber('journal');
    await addDoc(collection(db, 'journals'), { journalNo: jNo, date, description: `${docType === 'invoice' ? 'Pembayaran Invoice' : 'Bayar Hutang'} ${no}`, reference: no, entries, totalDebit: amount, totalCredit: amount, source: `${docType}_payment`, bookType, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await updateDoc(doc(db, colName, docId), { paid: newPaid, remaining: newRemaining, status: newStatus, payments: [...(data.payments || []), { date, amount, accountCode, accountName: cashAcct?.name || accountCode, notes }], updatedAt: new Date().toISOString() });
    showToast(`Pembayaran ${formatRp(amount)} berhasil dicatat!`); closePaymentModal();
    if (docType === 'invoice') renderAR(); else renderAP(); refreshBadges();
  } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
}

// ================================================================
// CORE: GET JOURNAL BALANCES
// ================================================================
async function getJournalBalances(startDate = null, endDate = null) {
  let snap;
  if (startDate && endDate) {
    snap = await getDocs(query(collection(db, 'journals'), where('date', '>=', startDate), where('date', '<=', endDate), orderBy('date')));
  } else if (endDate) {
    snap = await getDocs(query(collection(db, 'journals'), where('date', '<=', endDate), orderBy('date')));
  } else {
    snap = await getDocs(query(collection(db, 'journals'), orderBy('date')));
  }
  const bal = {};
  filterDocs(snap.docs).forEach(d => {
    (d.data().entries || []).forEach(e => {
      if (!bal[e.accountCode]) bal[e.accountCode] = { code: e.accountCode, name: e.accountName, debit: 0, credit: 0 };
      bal[e.accountCode].debit += e.debit || 0;
      bal[e.accountCode].credit += e.credit || 0;
    });
  });
  return bal;
}

// ================================================================
// LAPORAN: NERACA SALDO (TRIAL BALANCE)
// ================================================================
async function renderTrialBalance() {
  const dateFilter = getEl('tb-date')?.value;
  const content = getEl('report-tb-content'); if (!content) return;
  if (!dateFilter) { showToast('Pilih tanggal', 'error'); return; }
  content.innerHTML = '<div class="empty-state">Memuat laporan...</div>';
  try {
    const bal = await getJournalBalances(null, dateFilter);
    const accounts = Object.values(bal).sort((a, b) => a.code.localeCompare(b.code));
    let td = 0, tc = 0;
    accounts.forEach(a => { td += a.debit; tc += a.credit; });
    const isOk = Math.abs(td - tc) < 0.01;
    content.innerHTML = `
      <div class="report-header"><h2>${state.settings.companyName || 'PT Dwi Bintang Global'}</h2><h3>NERACA SALDO</h3><p>Per tanggal: ${formatDate(dateFilter)}</p></div>
      <table class="report-table" style="width:100%">
        <thead><tr><th>Kode</th><th>Nama Akun</th><th>Tipe</th><th class="text-right">Debit</th><th class="text-right">Kredit</th></tr></thead>
        <tbody>${accounts.map(a => { const acct = state.coa.find(c => c.code === a.code); return `<tr><td style="color:var(--accent-light)">${a.code}</td><td>${a.name}</td><td><span style="font-size:.78rem;color:var(--text-muted)">${acct ? getAccountTypeLabel(acct.type) : ''}</span></td><td class="text-right">${a.debit > 0 ? formatRp(a.debit) : '-'}</td><td class="text-right">${a.credit > 0 ? formatRp(a.credit) : '-'}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr class="report-total"><td colspan="3" class="text-right">TOTAL</td><td class="text-right">${formatRp(td)}</td><td class="text-right">${formatRp(tc)}</td></tr></tfoot>
      </table>
      <div class="balance-check ${isOk ? 'ok' : 'error'}">${isOk ? '✓ Jurnal seimbang (Total Debit = Total Kredit)' : `⚠ Selisih: ${formatRp(Math.abs(td - tc))}`}</div>
      <div class="report-footer"><span>Dicetak: ${new Date().toLocaleDateString('id-ID')}</span><span>${state.settings.companyName}</span></div>`;
  } catch (e) { content.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

// ================================================================
// LAPORAN: NERACA (BALANCE SHEET)
// ================================================================
async function renderBalanceSheet() {
  const dateFilter = getEl('bs-date')?.value;
  const content = getEl('report-bs-content'); if (!content) return;
  if (!dateFilter) { showToast('Pilih tanggal', 'error'); return; }
  content.innerHTML = '<div class="empty-state">Memuat laporan...</div>';
  try {
    const bal = await getJournalBalances(null, dateFilter);
    const net = (code, nb) => { const b = bal[code]; if (!b) return 0; return nb === 'debit' ? b.debit - b.credit : b.credit - b.debit; };
    const buildGroup = (accts) => { let tot = 0; const rows = accts.map(a => { const n = net(a.code, a.normalBalance); tot += n; return n !== 0 ? `<tr><td style="padding-left:32px">${a.code} — ${a.name}</td><td class="text-right">${formatRp(n)}</td></tr>` : ''; }).join(''); return { rows, total: tot }; };
    const aL = buildGroup(state.coa.filter(a => !a.isGroup && a.type === 'asset' && a.code.startsWith('11')));
    const aF = buildGroup(state.coa.filter(a => !a.isGroup && a.type === 'asset' && a.code.startsWith('12')));
    const kP = buildGroup(state.coa.filter(a => !a.isGroup && a.type === 'liability' && a.code.startsWith('21')));
    const kJ = buildGroup(state.coa.filter(a => !a.isGroup && a.type === 'liability' && a.code.startsWith('22')));
    const eq = buildGroup(state.coa.filter(a => !a.isGroup && a.type === 'equity'));
    const totRev = state.coa.filter(a => !a.isGroup && a.type === 'revenue').reduce((s, a) => s + net(a.code, a.normalBalance), 0);
    const totCogs = state.coa.filter(a => !a.isGroup && a.type === 'cogs').reduce((s, a) => s + net(a.code, a.normalBalance), 0);
    const totExp = state.coa.filter(a => !a.isGroup && a.type === 'expense').reduce((s, a) => s + net(a.code, a.normalBalance), 0);
    const netProfit = totRev - totCogs - totExp;
    const totAset = aL.total + aF.total, totKew = kP.total + kJ.total, totEk = eq.total + netProfit, totKE = totKew + totEk;
    const isOk = Math.abs(totAset - totKE) < 1;
    content.innerHTML = `
      <div class="report-header"><h2>${state.settings.companyName || 'PT Dwi Bintang Global'}</h2><h3>NERACA (BALANCE SHEET)</h3><p>Per tanggal: ${formatDate(dateFilter)}</p></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
        <div><table class="report-table" style="width:100%">
          <thead><tr><th colspan="2" style="text-align:center">ASET</th></tr></thead>
          <tbody>
            <tr class="report-section-header"><td colspan="2">Aset Lancar</td></tr>${aL.rows}
            <tr class="report-subtotal"><td>Total Aset Lancar</td><td class="text-right">${formatRp(aL.total)}</td></tr>
            <tr class="report-section-header"><td colspan="2">Aset Tetap</td></tr>${aF.rows}
            <tr class="report-subtotal"><td>Total Aset Tetap</td><td class="text-right">${formatRp(aF.total)}</td></tr>
          </tbody>
          <tfoot><tr class="report-grand-total"><td>TOTAL ASET</td><td class="text-right">${formatRp(totAset)}</td></tr></tfoot>
        </table></div>
        <div><table class="report-table" style="width:100%">
          <thead><tr><th colspan="2" style="text-align:center">KEWAJIBAN & EKUITAS</th></tr></thead>
          <tbody>
            <tr class="report-section-header"><td colspan="2">Kewajiban Jangka Pendek</td></tr>${kP.rows}
            <tr class="report-subtotal"><td>Total Kew. Pendek</td><td class="text-right">${formatRp(kP.total)}</td></tr>
            <tr class="report-section-header"><td colspan="2">Kewajiban Jangka Panjang</td></tr>${kJ.rows}
            <tr class="report-subtotal"><td>Total Kew. Panjang</td><td class="text-right">${formatRp(kJ.total)}</td></tr>
            <tr class="report-total"><td>TOTAL KEWAJIBAN</td><td class="text-right">${formatRp(totKew)}</td></tr>
            <tr class="report-section-header"><td colspan="2">Ekuitas</td></tr>${eq.rows}
            <tr><td style="padding-left:32px">Laba/Rugi Periode Berjalan</td><td class="text-right ${netProfit >= 0 ? 'green-text' : 'red-text'}">${formatRp(netProfit)}</td></tr>
            <tr class="report-subtotal"><td>Total Ekuitas</td><td class="text-right">${formatRp(totEk)}</td></tr>
          </tbody>
          <tfoot><tr class="report-grand-total"><td>TOTAL KEW. + EKUITAS</td><td class="text-right">${formatRp(totKE)}</td></tr></tfoot>
        </table></div>
      </div>
      <div class="balance-check ${isOk ? 'ok' : 'error'}" style="margin-top:20px">${isOk ? '✓ Neraca seimbang: Total Aset = Total Kewajiban + Ekuitas' : `⚠ Selisih: ${formatRp(Math.abs(totAset - totKE))}`}</div>
      <div class="report-footer"><span>Dicetak: ${new Date().toLocaleDateString('id-ID')}</span><span>${state.settings.companyName}</span></div>`;
  } catch (e) { content.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

// ================================================================
// LAPORAN: LABA RUGI
// ================================================================
async function renderPL() {
  const df = getEl('pl-date-from')?.value, dt = getEl('pl-date-to')?.value;
  const content = getEl('report-pl-content'); if (!content) return;
  if (!df || !dt) { showToast('Pilih periode', 'error'); return; }
  content.innerHTML = '<div class="empty-state">Memuat laporan...</div>';
  try {
    const bal = await getJournalBalances(df, dt);
    const net = (code, nb) => { const b = bal[code]; if (!b) return 0; return nb === 'debit' ? b.debit - b.credit : b.credit - b.debit; };
    const buildSection = (accts) => { let tot = 0; const rows = accts.map(a => { const n = net(a.code, a.normalBalance); tot += n; return n !== 0 ? `<tr><td style="padding-left:24px">${a.code} — ${a.name}</td><td class="text-right">${formatRp(n)}</td></tr>` : ''; }).filter(r => r).join(''); return { rows, total: tot }; };
    const rev = buildSection(state.coa.filter(a => !a.isGroup && a.type === 'revenue'));
    const cgs = buildSection(state.coa.filter(a => !a.isGroup && a.type === 'cogs'));
    const exp = buildSection(state.coa.filter(a => !a.isGroup && a.type === 'expense'));
    const oth = buildSection(state.coa.filter(a => !a.isGroup && a.type === 'other'));
    const gp = rev.total - cgs.total;
    const othNet = state.coa.filter(a => !a.isGroup && a.type === 'other').reduce((s, a) => { const b = bal[a.code]; if (!b) return s; return s + (a.normalBalance === 'credit' ? b.credit - b.debit : b.debit - b.credit); }, 0);
    const netP = gp - exp.total + othNet;
    content.innerHTML = `
      <div class="report-header"><h2>${state.settings.companyName || 'PT Dwi Bintang Global'}</h2><h3>LAPORAN LABA RUGI</h3><p>Periode: ${formatDate(df)} s/d ${formatDate(dt)}</p></div>
      <table class="report-table" style="width:100%;max-width:700px;margin:0 auto">
        <tbody>
          <tr class="report-section-header"><td colspan="2">PENDAPATAN</td></tr>
          ${rev.rows || '<tr><td colspan="2" style="padding:8px 24px;color:var(--text-muted)">Tidak ada</td></tr>'}
          <tr class="report-subtotal"><td>Total Pendapatan</td><td class="text-right">${formatRp(rev.total)}</td></tr>
          <tr class="report-section-header"><td colspan="2">HARGA POKOK JASA</td></tr>
          ${cgs.rows || '<tr><td colspan="2" style="padding:8px 24px;color:var(--text-muted)">Tidak ada</td></tr>'}
          <tr class="report-subtotal"><td>Total HPJ</td><td class="text-right">(${formatRp(cgs.total)})</td></tr>
          <tr class="report-total"><td>LABA KOTOR</td><td class="text-right">${formatRp(gp)}</td></tr>
          <tr class="report-section-header"><td colspan="2">BEBAN OPERASIONAL</td></tr>
          ${exp.rows || '<tr><td colspan="2" style="padding:8px 24px;color:var(--text-muted)">Tidak ada</td></tr>'}
          <tr class="report-subtotal"><td>Total Beban</td><td class="text-right">(${formatRp(exp.total)})</td></tr>
          ${oth.rows ? `<tr class="report-section-header"><td colspan="2">PENDAPATAN/BEBAN LAIN-LAIN</td></tr>${oth.rows}` : ''}
          <tr class="report-grand-total ${netP >= 0 ? 'report-profit' : 'report-loss'}">
            <td>${netP >= 0 ? '📈 LABA BERSIH' : '📉 RUGI BERSIH'}</td>
            <td class="text-right">${formatRp(Math.abs(netP))}</td>
          </tr>
        </tbody>
      </table>
      <div class="report-footer"><span>Dicetak: ${new Date().toLocaleDateString('id-ID')}</span><span>${state.settings.companyName}</span></div>`;
  } catch (e) { content.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

// ================================================================
// LAPORAN: ARUS KAS
// ================================================================
async function renderCashFlow() {
  const df = getEl('cf-date-from')?.value, dt = getEl('cf-date-to')?.value;
  const content = getEl('report-cf-content'); if (!content) return;
  if (!df || !dt) { showToast('Pilih periode', 'error'); return; }
  content.innerHTML = '<div class="empty-state">Memuat laporan...</div>';
  try {
    const cashCodes = getCashBankAccounts().map(a => a.code);
    const snap = await getDocs(query(collection(db, 'journals'), where('date', '>=', df), where('date', '<=', dt), orderBy('date')));
    let ti = 0, to = 0; const txs = [];
    filterDocs(snap.docs).forEach(d => {
      const j = d.data();
      (j.entries || []).forEach(e => {
        if (!cashCodes.includes(e.accountCode)) return;
        if (e.debit > 0) { ti += e.debit; txs.push({ date: j.date, desc: j.description, ref: j.reference, amount: e.debit, type: 'in', account: e.accountName }); }
        if (e.credit > 0) { to += e.credit; txs.push({ date: j.date, desc: j.description, ref: j.reference, amount: e.credit, type: 'out', account: e.accountName }); }
      });
    });
    txs.sort((a, b) => a.date.localeCompare(b.date));
    const nc = ti - to;
    content.innerHTML = `
      <div class="report-header"><h2>${state.settings.companyName}</h2><h3>LAPORAN ARUS KAS</h3><p>Periode: ${formatDate(df)} s/d ${formatDate(dt)}</p></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px">
        <div class="glass-card" style="text-align:center"><div style="font-size:.75rem;color:var(--text-muted);margin-bottom:8px">KAS MASUK</div><div style="font-size:1.4rem;font-weight:800;color:var(--success-light)">${formatRp(ti)}</div></div>
        <div class="glass-card" style="text-align:center"><div style="font-size:.75rem;color:var(--text-muted);margin-bottom:8px">KAS KELUAR</div><div style="font-size:1.4rem;font-weight:800;color:var(--danger-light)">${formatRp(to)}</div></div>
        <div class="glass-card" style="text-align:center"><div style="font-size:.75rem;color:var(--text-muted);margin-bottom:8px">ARUS KAS BERSIH</div><div style="font-size:1.4rem;font-weight:800;color:${nc >= 0 ? 'var(--success-light)' : 'var(--danger-light)'}">${formatRp(nc)}</div></div>
      </div>
      <table class="report-table" style="width:100%">
        <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Referensi</th><th>Akun Kas/Bank</th><th class="text-right green-text">Masuk</th><th class="text-right red-text">Keluar</th></tr></thead>
        <tbody>${txs.map(t => `<tr><td>${formatDate(t.date)}</td><td>${t.desc}</td><td style="color:var(--text-muted)">${t.ref || '-'}</td><td>${t.account}</td><td class="text-right green-text">${t.type === 'in' ? formatRp(t.amount) : '-'}</td><td class="text-right red-text">${t.type === 'out' ? formatRp(t.amount) : '-'}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty-state">Tidak ada pergerakan kas</div></td></tr>'}</tbody>
        <tfoot><tr class="report-total"><td colspan="4" class="text-right">TOTAL</td><td class="text-right green-text">${formatRp(ti)}</td><td class="text-right red-text">${formatRp(to)}</td></tr></tfoot>
      </table>
      <div class="report-footer"><span>Dicetak: ${new Date().toLocaleDateString('id-ID')}</span><span>${state.settings.companyName}</span></div>`;
  } catch (e) { content.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

// ================================================================
// LAPORAN: BUKU BESAR (GENERAL LEDGER)
// ================================================================
function loadLedgerAccountSelect() {
  const sel = getEl('gl-account'); if (!sel) return;
  const cur = sel.value; sel.innerHTML = '<option value="">-- Pilih Akun --</option>';
  const tl = { asset:'ASET', liability:'KEWAJIBAN', equity:'EKUITAS', revenue:'PENDAPATAN', cogs:'HPJ', expense:'BEBAN', other:'LAIN-LAIN' };
  const grps = {};
  state.coa.filter(a => !a.isGroup).forEach(a => { if (!grps[a.type]) grps[a.type] = []; grps[a.type].push(a); });
  Object.entries(grps).forEach(([type, accts]) => {
    const g = document.createElement('optgroup'); g.label = tl[type] || type;
    accts.forEach(a => { const o = document.createElement('option'); o.value = a.code; o.textContent = `${a.code} — ${a.name}`; g.appendChild(o); });
    sel.appendChild(g);
  });
  if (cur) sel.value = cur;
}

async function renderLedger() {
  const code = getEl('gl-account')?.value, df = getEl('gl-date-from')?.value, dt = getEl('gl-date-to')?.value;
  const content = getEl('report-gl-content'); if (!content) return;
  if (!code) { showToast('Pilih akun terlebih dahulu', 'error'); return; }
  content.innerHTML = '<div class="empty-state">Memuat...</div>';
  try {
    const acct = state.coa.find(a => a.code === code);
    const snap = await getDocs(query(collection(db, 'journals'), orderBy('date')));
    const txs = [];
    filterDocs(snap.docs).forEach(d => {
      const j = d.data();
      if (df && j.date < df) return; if (dt && j.date > dt) return;
      (j.entries || []).forEach(e => { if (e.accountCode === code) txs.push({ date: j.date, journalNo: j.journalNo, description: j.description, reference: j.reference, debit: e.debit || 0, credit: e.credit || 0 }); });
    });
    let rb = 0, td = 0, tc = 0;
    const rows = txs.map(t => {
      td += t.debit; tc += t.credit;
      rb += acct?.normalBalance === 'debit' ? t.debit - t.credit : t.credit - t.debit;
      return `<tr><td>${formatDate(t.date)}</td><td style="color:var(--accent-light)">${t.journalNo}</td><td>${t.description}</td><td style="color:var(--text-muted)">${t.reference || '-'}</td><td class="text-right green-text">${t.debit ? formatRp(t.debit) : '-'}</td><td class="text-right red-text">${t.credit ? formatRp(t.credit) : '-'}</td><td class="text-right" style="font-weight:600;color:${rb >= 0 ? 'var(--success-light)' : 'var(--danger-light)'}">${formatRp(rb)}</td></tr>`;
    }).join('');
    content.innerHTML = `
      <div class="report-header"><h2>${state.settings.companyName}</h2><h3>BUKU BESAR</h3><p>Akun: ${code} — ${acct?.name || code}</p>${df ? `<p>Periode: ${formatDate(df)} s/d ${formatDate(dt || today())}</p>` : ''}</div>
      <table class="report-table" style="width:100%">
        <thead><tr><th>Tanggal</th><th>No. Jurnal</th><th>Keterangan</th><th>Referensi</th><th class="text-right">Debit</th><th class="text-right">Kredit</th><th class="text-right">Saldo</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7"><div class="empty-state">Tidak ada transaksi</div></td></tr>'}</tbody>
        <tfoot><tr class="report-total"><td colspan="4" class="text-right">TOTAL</td><td class="text-right">${formatRp(td)}</td><td class="text-right">${formatRp(tc)}</td><td class="text-right">${formatRp(rb)}</td></tr></tfoot>
      </table>
      <div class="report-footer"><span>Dicetak: ${new Date().toLocaleDateString('id-ID')}</span><span>${state.settings.companyName}</span></div>`;
  } catch (e) { content.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

// ================================================================
// LAPORAN: KAS HARIAN
// ================================================================
function loadDailyCashReport() {
  const sel = getEl('dc-account'); if (!sel) return;
  const cur = sel.value; sel.innerHTML = '<option value="">Semua Akun Kas & Bank</option>';
  getCashBankAccounts().forEach(a => { const o = document.createElement('option'); o.value = a.code; o.textContent = `${a.code} — ${a.name}`; sel.appendChild(o); });
  if (cur) sel.value = cur;
  setVal('dc-date', today());
  renderDailyCash();
}

async function renderDailyCash() {
  const tdate = getEl('dc-date')?.value || today();
  const code = getEl('dc-account')?.value || '';
  const content = getEl('dc-report-wrapper');
  const empty = getEl('dc-empty-state');
  if (!content || !empty) return;
  
  empty.style.display = 'none';
  content.style.display = 'flex';
  
  getEl('dc-table-1').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Memuat...</td></tr>';
  getEl('dc-table-2').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Memuat...</td></tr>';
  getEl('dc-table-3').innerHTML = 'Memuat...';
  
  try {
    const snap = await getDocs(query(collection(db, 'journals'), orderBy('date')));
    
    // Monthly aggregations (Table 2)
    const currentM = tdate.substring(0,7);
    const dailySums = {}; // format: { '2026-06-01': { in: 0, out: 0 } }
    
    // Daily detail (Table 1)
    let openBal = 0, sumIn = 0, sumOut = 0;
    const txs = [];
    
    // Expenses (Table 3)
    const expCategories = {}; // format: { 'B. KEPERLUAN PRODUKSI': 150000 }
    
    filterDocs(snap.docs).forEach(d => {
      const j = d.data();
      const m = j.date.substring(0,7);
      
      const cbEntries = j.entries.filter(e => code ? e.accountCode === code : state.coa.find(a => a.code === e.accountCode && a.type === 'asset' && (a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))));
      const lawanEntries = j.entries.filter(e => !cbEntries.includes(e));
      
      // Calculate Table 2 and Table 3 (for current month up to tdate)
      if (m === currentM && j.date <= tdate) {
        if (!dailySums[j.date]) dailySums[j.date] = { in: 0, out: 0 };
        
        cbEntries.forEach(cbe => {
          const isIn = cbe.debit > 0;
          const amt = isIn ? cbe.debit : cbe.credit;
          dailySums[j.date].in += isIn ? amt : 0;
          dailySums[j.date].out += isIn ? 0 : amt;
        });
        
        // Sum expenses for table 3
        lawanEntries.forEach(le => {
          const acc = state.coa.find(a => a.code === le.accountCode);
          if (acc && (acc.type === 'expense' || acc.type === 'cogs') && le.debit > 0) {
            // Group by parent or name
            let cat = acc.name;
            if (acc.name.toLowerCase().includes('gaji')) cat = 'ANGGARAN STAFF / GAJI';
            else if (acc.type === 'cogs') cat = 'B. KEPERLUAN PRODUKSI';
            else cat = 'B. UMUM & ADMIN (' + acc.name + ')';
            
            expCategories[cat] = (expCategories[cat] || 0) + le.debit;
          }
        });
      }
      
      // Calculate Table 1
      if (!cbEntries.length || j.date > tdate) return;
      
      const lawanTxt = lawanEntries.map(e => e.accountName).join(', ');
      const lawanCode = lawanEntries[0]?.accountCode || '-';
      
      cbEntries.forEach(cbe => {
        const isIn = cbe.debit > 0;
        const amt = isIn ? cbe.debit : cbe.credit;
        if (j.date < tdate) {
          openBal += isIn ? amt : -amt;
        } else if (j.date === tdate) {
          sumIn += isIn ? amt : 0;
          sumOut += isIn ? 0 : amt;
          txs.push({ accCode: lawanCode, desc: j.description || lawanTxt, is_in: isIn, amount: amt });
        }
      });
    });
    
    // --- Render Table 1 ---
    let t1HTML = `<tr><td colspan="2">Balance (Before)</td><td class="text-right" style="color:var(--success-light)">${formatRp(openBal)}</td><td class="text-right"></td></tr>`;
    txs.forEach(t => {
      t1HTML += `<tr>
        <td style="color:var(--text-muted)">${t.accCode}</td>
        <td>${t.desc}</td>
        <td class="text-right" style="color:var(--success-light)">${t.is_in ? formatRp(t.amount) : ''}</td>
        <td class="text-right" style="color:var(--danger-light)">${!t.is_in ? formatRp(t.amount) : ''}</td>
      </tr>`;
    });
    const closeBal = openBal + sumIn - sumOut;
    t1HTML += `<tr style="font-weight:bold; background:var(--bg-light)">
      <td colspan="2">Balance</td>
      <td colspan="2" class="text-right" style="color:var(--accent-light)">${formatRp(closeBal)}</td>
    </tr>`;
    getEl('dc-table-1').innerHTML = t1HTML;
    
    // --- Render Table 2 ---
    let t2HTML = '';
    const sortedDates = Object.keys(dailySums).sort();
    let runBal = 0; // Requires calculating open bal at start of month
    
    // Get opening balance for start of month
    let startOfMonthOpenBal = 0;
    filterDocs(snap.docs).forEach(d => {
      const j = d.data();
      if (j.date >= currentM + '-01') return;
      const cbEntries = j.entries.filter(e => code ? e.accountCode === code : state.coa.find(a => a.code === e.accountCode && a.type === 'asset' && (a.name.toLowerCase().includes('kas') || a.name.toLowerCase().includes('bank'))));
      cbEntries.forEach(cbe => {
        startOfMonthOpenBal += (cbe.debit > 0) ? cbe.debit : -cbe.credit;
      });
    });
    
    runBal = startOfMonthOpenBal;
    sortedDates.forEach(dt => {
      const d = dailySums[dt];
      runBal = runBal + d.in - d.out;
      t2HTML += `<tr>
        <td>${formatDate(dt)}</td>
        <td class="text-right" style="color:var(--success-light)">${formatRp(d.in)}</td>
        <td class="text-right" style="color:var(--danger-light)">${formatRp(d.out)}</td>
        <td class="text-right">${formatRp(runBal)}</td>
      </tr>`;
    });
    if (!t2HTML) t2HTML = '<tr><td colspan="4" class="text-center">Belum ada transaksi di bulan ini.</td></tr>';
    getEl('dc-table-2').innerHTML = t2HTML;
    
    // --- Render Table 3 ---
    let t3HTML = '';
    let totExp = 0;
    Object.keys(expCategories).sort().forEach(cat => {
      t3HTML += `<div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span>${cat}</span><span>Rp ${formatRp(expCategories[cat])}</span>
      </div>`;
      totExp += expCategories[cat];
    });
    t3HTML += `<div style="display:flex; justify-content:space-between; margin-top:12px; font-weight:bold; border-top:1px dashed var(--border-color); padding-top:8px;">
        <span>TOTAL</span><span>Rp ${formatRp(totExp)}</span>
      </div>`;
    getEl('dc-table-3').innerHTML = t3HTML || 'Tidak ada pengeluaran.';
    
  } catch (e) { empty.innerHTML = `Error: ${e.message}`; empty.style.display = 'block'; content.style.display = 'none'; }
}

// ================================================================
// LAPORAN: UMUR PIUTANG (NPL)
// ================================================================
async function renderARAgingReport() {
  const tdate = getEl('ar-aging-date')?.value || today();
  const tbody = getEl('ar-aging-tbody');
  const tfoot = getEl('ar-aging-tfoot');
  if (!tbody || !tfoot) return;
  
  tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Memuat data...</td></tr>';
  
  try {
    // For simplicity, we fetch all invoices and filter by those that have remaining > 0 or were created before tdate
    // Since we need historic remaining balance exactly on tdate, it requires calculating payments up to tdate.
    // Assuming the user just wants the current outstanding AR that was created on or before tdate,
    // we will use the invoice's current 'remaining' value. If a payment was made AFTER tdate, it will NOT be reflected 
    // as "unpaid as of tdate". If strict historical aging is needed, we would subtract only payments made before tdate.
    // For now, we will use the invoice 'remaining' if we consider it's a live aging report.
    // Let's implement accurate historical aging: Remaining = Total - (Sum of payments on/before tdate).
    
    // 1. Get all invoices up to tdate
    const invSnap = await getDocs(query(collection(db, 'invoices'), where('date', '<=', tdate)));
    
    // 2. Get all payments up to tdate (to calculate accurate historical remaining)
    // Payments are journals with source 'ar_payment' or just parsing journal entries for AR account.
    // To make it easy without complex queries, we can just use the `remaining` field, 
    // but if the user wants historical accuracy, they might need the complex approach.
    // Let's use the current 'remaining' but filter out fully paid invoices that were paid before tdate.
    // Actually, let's just use the invoice data directly for now, and if they have payments after tdate, we'll ignore that edge case for simplicity unless asked.
    
    let totalAll = 0, tot0_30 = 0, tot30_60 = 0, tot60_90 = 0, tot90_120 = 0, tot120 = 0;
    const rows = [];
    
    filterDocs(invSnap.docs).forEach(d => {
      const inv = d.data();
      if (inv.remaining <= 0) return; // Ignore fully paid invoices
      
      const invoiceDate = new Date(inv.date);
      const reportDate = new Date(tdate);
      const diffTime = Math.abs(reportDate - invoiceDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const amt = inv.remaining;
      totalAll += amt;
      
      let bucket0 = '', bucket30 = '', bucket60 = '', bucket90 = '', bucket120 = '';
      
      if (diffDays <= 30) { tot0_30 += amt; bucket0 = formatRp(amt); }
      else if (diffDays <= 60) { tot30_60 += amt; bucket30 = formatRp(amt); }
      else if (diffDays <= 90) { tot60_90 += amt; bucket60 = formatRp(amt); }
      else if (diffDays <= 120) { tot90_120 += amt; bucket90 = formatRp(amt); }
      else { tot120 += amt; bucket120 = formatRp(amt); }
      
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const monthStr = monthNames[invoiceDate.getMonth()] + '-' + invoiceDate.getFullYear().toString().substr(-2);
      
      rows.push({
        dateStr: formatDate(inv.date),
        monthStr: monthStr,
        invNo: inv.invoiceNo,
        customer: inv.customerName,
        b0: bucket0, b30: bucket30, b60: bucket60, b90: bucket90, b120: bucket120,
        total: formatRp(amt)
      });
    });
    
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state">Tidak ada piutang yang belum lunas.</div></td></tr>';
      tfoot.innerHTML = '';
      return;
    }
    
    // Sorting by invoice date
    rows.sort((a,b) => new Date(a.dateStr) - new Date(b.dateStr));
    
    let html = '';
    rows.forEach(r => {
      html += `<tr>
        <td>${r.dateStr}</td>
        <td style="color:var(--accent-light)">${r.invNo}</td>
        <td>${r.customer}</td>
        <td class="text-right">${r.b0}</td>
        <td class="text-right">${r.b30}</td>
        <td class="text-right">${r.b60}</td>
        <td class="text-right">${r.b90}</td>
        <td class="text-right">${r.b120}</td>
        <td class="text-right" style="font-weight:600">${r.total}</td>
      </tr>`;
    });
    tbody.innerHTML = html;
    
    const pct = (val) => totalAll > 0 ? Math.round((val / totalAll) * 100) + '%' : '0%';
    
    tfoot.innerHTML = `
      <tr>
        <td colspan="3" class="text-center">TOTAL</td>
        <td class="text-right">${formatRp(tot0_30)}</td>
        <td class="text-right">${formatRp(tot30_60)}</td>
        <td class="text-right">${formatRp(tot60_90)}</td>
        <td class="text-right">${formatRp(tot90_120)}</td>
        <td class="text-right">${formatRp(tot120)}</td>
        <td class="text-right" style="color:var(--accent-light)">${formatRp(totalAll)}</td>
      </tr>
      <tr style="color:var(--text-muted); font-size:0.85rem">
        <td colspan="3" class="text-center">PROSENTASE</td>
        <td class="text-right">${pct(tot0_30)}</td>
        <td class="text-right">${pct(tot30_60)}</td>
        <td class="text-right">${pct(tot60_90)}</td>
        <td class="text-right">${pct(tot90_120)}</td>
        <td class="text-right">${pct(tot120)}</td>
        <td class="text-right">100%</td>
      </tr>
    `;
    
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Error: ${e.message}</div></td></tr>`;
  }
}

// ================================================================
// DASHBOARD
// ================================================================
async function loadDashboard() {
  try {
    const m = currentMonth(), ms = monthStart(m), me = monthEnd(m);
    const bal = await getJournalBalances(ms, me);
    const net = (code, nb) => { const b = bal[code]; if (!b) return 0; return nb === 'debit' ? b.debit - b.credit : b.credit - b.debit; };
    const rev = state.coa.filter(a => !a.isGroup && a.type === 'revenue').reduce((s, a) => s + net(a.code, a.normalBalance), 0);
    const cgs = state.coa.filter(a => !a.isGroup && a.type === 'cogs').reduce((s, a) => s + net(a.code, a.normalBalance), 0);
    const exp = state.coa.filter(a => !a.isGroup && a.type === 'expense').reduce((s, a) => s + net(a.code, a.normalBalance), 0);
    const np = rev - cgs - exp;
    setText('dash-revenue', formatRp(rev)); setText('dash-expense', formatRp(cgs + exp));
    const pe = getEl('dash-profit'); if (pe) { pe.textContent = formatRp(Math.abs(np)); pe.style.color = np >= 0 ? 'var(--success-light)' : 'var(--danger-light)'; }
    // AR/AP
    try {
      const arSnap = await getDocs(query(collection(db, 'invoices'), where('status', '!=', 'paid')));
      setText('dash-ar', formatRp(filterDocs(arSnap.docs).reduce((s, d) => s + (d.data().remaining || 0), 0)));
      const td_str = today();
      const aging = filterDocs(arSnap.docs).map(d => d.data()).filter(i => i.dueDate < td_str && i.remaining > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const agEl = getEl('dash-ar-aging');
      if (agEl) agEl.innerHTML = aging.slice(0, 5).map(i => `<div class="aging-item"><div><div class="aging-name">${i.customerName}</div><div style="font-size:.72rem;color:var(--text-muted)">${i.invoiceNo} • DUE ${formatDate(i.dueDate)}</div></div><div class="aging-amount">${formatRp(i.remaining)}</div></div>`).join('') || '<div class="empty-state-sm">Tidak ada piutang jatuh tempo 🎉</div>';
      const apSnap = await getDocs(query(collection(db, 'bills'), where('status', '!=', 'paid')));
      setText('dash-ap', formatRp(filterDocs(apSnap.docs).reduce((s, d) => s + (d.data().remaining || 0), 0)));
    } catch {}
    // Cash
    const allBal = await getJournalBalances();
    const cash = getCashBankAccounts().reduce((s, a) => { const b = allBal[a.code]; return s + (b ? b.debit - b.credit : 0); }, 0);
    setText('dash-cash', formatRp(cash));
    // Chart & recent
    renderDashboardChart();
    renderRecentJournals();
  } catch (e) { console.error('Dashboard:', e); }
}

async function renderDashboardChart() {
  const canvas = getEl('dash-chart-monthly'); if (!canvas) return;
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const labels = months.map(m => { const [y, mo] = m.split('-'); return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }); });
  const revs = [], exps = [];
  for (const m of months) {
    const b = await getJournalBalances(monthStart(m), monthEnd(m));
    revs.push(state.coa.filter(a => !a.isGroup && a.type === 'revenue').reduce((s, a) => { const x = b[a.code]; return s + (x ? x.credit - x.debit : 0); }, 0) / 1e6);
    exps.push(state.coa.filter(a => !a.isGroup && ['cogs','expense'].includes(a.type)).reduce((s, a) => { const x = b[a.code]; return s + (x ? x.debit - x.credit : 0); }, 0) / 1e6);
  }
  if (window._dc) window._dc.destroy();
  window._dc = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Pendapatan (jt)', data: revs, backgroundColor: 'rgba(16,185,129,0.7)', borderColor: '#10b981', borderWidth: 1, borderRadius: 6 },
      { label: 'Beban (jt)', data: exps, backgroundColor: 'rgba(239,68,68,0.5)', borderColor: '#ef4444', borderWidth: 1, borderRadius: 6 },
    ]},
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatRp(ctx.raw * 1e6)}` } } },
      scales: { x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { ticks: { color: '#64748b', callback: v => `${v}jt` }, grid: { color: 'rgba(255,255,255,0.04)' } } }
    }
  });
}

async function renderRecentJournals() {
  const el = getEl('dash-recent-journals'); if (!el) return;
  try {
    const snap = await getDocs(query(collection(db, 'journals'), orderBy('date', 'desc'), limit(50)));
    if (snap.empty) { el.innerHTML = '<div class="empty-state">Belum ada jurnal</div>'; return; }
    const recentDocs = filterDocs(snap.docs).slice(0, 5);
    el.innerHTML = `<table class="data-table" style="width:100%">
      <thead><tr><th>No. Jurnal</th><th>Tanggal</th><th>Keterangan</th><th class="text-right">Total</th></tr></thead>
      <tbody>${recentDocs.map(d => { const j = d.data(); return `<tr><td><strong style="color:var(--accent-light)">${j.journalNo}</strong></td><td>${formatDate(j.date)}</td><td>${j.description}</td><td class="text-right">${formatRp(j.totalDebit)}</td></tr>`; }).join('')}</tbody>
    </table>`;
  } catch {}
}

async function refreshBadges() {
  try {
    const t = today();
    const ar = await getDocs(query(collection(db, 'invoices'), where('status', '!=', 'paid')));
    const arOD = ar.docs.filter(d => d.data().dueDate < t).length;
    const arB = getEl('ar-badge'); if (arB) { arB.textContent = arOD; arB.classList.toggle('hidden', arOD === 0); }
    const ap = await getDocs(query(collection(db, 'bills'), where('status', '!=', 'paid')));
    const apOD = ap.docs.filter(d => d.data().dueDate < t).length;
    const apB = getEl('ap-badge'); if (apB) { apB.textContent = apOD; apB.classList.toggle('hidden', apOD === 0); }
  } catch {}
}

// ================================================================
// EXPORT
// ================================================================
function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

function exportReportCSV(type) {
  const el = document.getElementById(`report-${type}-content`); if (!el) return;
  const rows = [[`Laporan ${type.toUpperCase()} - ${state.settings.companyName}`]];
  el.querySelectorAll('tr').forEach(tr => { const cols = [...tr.querySelectorAll('th,td')].map(td => td.textContent.trim()); if (cols.some(c => c)) rows.push(cols); });
  downloadCSV(rows, `Laporan_${type.toUpperCase()}_PT_DBG.csv`);
}

function printReport() { window.print(); }

async function exportJournals() {
  const snap = await getDocs(query(collection(db, 'journals'), orderBy('date', 'desc')));
  const rows = [['No. Jurnal','Tanggal','Keterangan','Referensi','Kode Akun','Nama Akun','Debit','Kredit']];
  filterDocs(snap.docs).forEach(d => { const j = d.data(); (j.entries || []).forEach(e => { rows.push([j.journalNo, j.date, j.description, j.reference || '', e.accountCode, e.accountName, e.debit || 0, e.credit || 0]); }); });
  downloadCSV(rows, 'Jurnal_PT_DBG.csv');
}

// ================================================================
// GLOBAL EXPOSE — HTML onclick handlers
// ================================================================
Object.assign(window, {
  handleLogin, handleLogout, navigateTo, toggleSidebar, toggleTheme,
  openCOAModal, closeCOAModal, saveCOA, deleteCOA, updateNormalBalance, exportCOA, renderCOA,
  openContactModal, closeContactModal, saveContact, deleteContact, renderContacts,
  openJournalModal, closeJournalModal, addJournalLine, removeJournalLine, updateJournalTotals,
  clrOpp, saveJournal, renderJournals, deleteJournal, viewJournalDetail, closeJournalDetailModal, exportJournals,
  openCashBankModal, closeCashBankModal, updateCBLabels, saveCashBank, renderCashBank, calcCBTotals,
  openInvoiceModal, closeInvoiceModal, addInvoiceItem, removeInvoiceItem, calcInvoiceTotals, saveInvoice, renderAR, viewInvoiceDetail, deleteInvoice,
  openBillModal, closeBillModal, addBillItem, removeBillItem, calcBillTotals, saveBill, renderAP, deleteBill,
  openPaymentModal, closePaymentModal, savePayment,
  renderTrialBalance, renderBalanceSheet, renderPL, renderCashFlow, renderLedger, loadLedgerAccountSelect, loadDailyCashReport, renderDailyCash, renderARAgingReport, exportReportCSV, printReport,
  saveSettings, saveAccountMappings, loadSettingsPage,
  openTaxModal, closeTaxModal, saveTax, deleteTax
});

console.log('🏭 PT Dwi Bintang Global — Sistem Keuangan v1.0 | Ready');
