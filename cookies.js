/* ═══════════════════════════════════════════════════
   COOKIE STORE — cookies.js (VERSÃO FINAL - FORM HTML)
   Sem fetch → Sem erro de CORS
═══════════════════════════════════════════════════ */

const ADMIN_PASSWORD = "cookies123";
const PIX_KEY = "12988515550";

const DEFAULT_PRODUCTS = [
  { id: "1", name: "Cookie de Chocolate Belga", desc: "Recheado com gotas de chocolate belga 70%.", price: 14.90, weight: 90, image: null },
  { id: "2", name: "Cookie de Pasta de Amendoim", desc: "Massa leve com recheio cremoso.", price: 13.90, weight: 85, image: null },
  { id: "3", name: "Cookie Clássico com Gotas", desc: "Clássico com gotas de chocolate ao leite.", price: 11.90, weight: 80, image: null }
];

let products = [];
let cart = [];
let editingId = null;
let pendingImageBase64 = null;

/* UTILS */
function fmtPrice(val) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function generateOrderId() {
  const now = new Date();
  const datePart = now.toISOString().slice(0,10).replace(/-/g,"");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CK-${datePart}-${rand}`;
}
function calcDeliveryDate(totalQty) {
  const days = totalQty > 3 ? 3 : 2;
  const date = new Date();
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) added++;
  }
  return date.toLocaleDateString("pt-BR");
}

/* STORAGE */
function saveProducts() { localStorage.setItem("cs_products", JSON.stringify(products)); }
function loadProducts() {
  const raw = localStorage.getItem("cs_products");
  if (raw) try { products = JSON.parse(raw); } catch(e){}
  else products = DEFAULT_PRODUCTS.map(p => ({...p}));
  saveProducts();
}
function saveCart() {
  const lean = cart.map(c => ({ productId: c.product.id, qty: c.qty }));
  localStorage.setItem("cs_cart", JSON.stringify(lean));
}
function loadCart() {
  const raw = localStorage.getItem("cs_cart");
  if (!raw) return;
  try {
    const lean = JSON.parse(raw);
    cart = lean.map(item => {
      const p = products.find(x => x.id === item.productId);
      return p ? { product: p, qty: item.qty } : null;
    }).filter(Boolean);
  } catch(e) { cart = []; }
}

/* Tabs, Admin, Render functions (Loja, Admin, Carrinho), Cart logic, Modal produto... */
function goToTab(name) { /* seu código original */ }
function activateTab(name) { /* seu código original */ }
function renderLoja() { /* seu código original */ }
function renderAdmin() { /* seu código original */ }
function renderCart() { /* seu código original */ }
function addToCart(productId, qty = 1) { /* seu código original */ }
function removeFromCart(productId) { /* seu código original */ }
function updateCartQty(productId, delta) { /* seu código original */ }
function clearCart() { cart = []; saveCart(); updateBadge(); }
function updateBadge() { /* seu código original */ }

/* Modal Produto */
function openModal(title) { /* original */ }
function closeModal() { /* original */ }
function openNewModal() { /* original */ }
function openEditModal(id) { /* original */ }
document.getElementById("productForm").addEventListener("submit", (e) => { /* seu código original de salvar produto */ });
function deleteProduct(id) { /* original */ }

/* Modal Confirmação */
function openOrderConfirmModal({ orderId, total, deliveryDate, payment }) { /* seu código original */ }
function closeOrderConfirmModal() { /* original */ }

/* TOAST */
let toastTimer = null;
function showToast(msg, type = "default") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

/* ENVIO VIA FORM (Sem CORS) */
document.getElementById("orderForm").addEventListener("submit", function(e) {
  if (!cart.length) {
    e.preventDefault();
    showToast("Adicione itens ao carrinho primeiro!", "error");
    return;
  }

  const name = document.getElementById("clientName").value.trim();
  const phone = document.getElementById("clientPhone").value.trim();
  const payment = document.getElementById("paymentMethod").value;

  if (!name || !phone || !payment) {
    e.preventDefault();
    showToast("Preencha nome, telefone e forma de pagamento!", "error");
    return;
  }

  // Mostra loading
  const label = document.getElementById("submitLabel");
  const loading = document.getElementById("submitLoading");
  const btn = document.getElementById("submitOrder");
  label.classList.add("hidden");
  loading.classList.remove("hidden");
  btn.disabled = true;

  // O formulário envia sozinho para o Apps Script
  // Depois do envio, o Apps Script pode mostrar página de sucesso ou redirecionar
});

/* INIT */
function init() {
  loadProducts();
  loadCart();
  updateBadge();
  renderLoja();
  if (sessionStorage.getItem("cs_admin_ok")) {
    document.getElementById("adminContent").classList.remove("hidden");
  }
}
init();