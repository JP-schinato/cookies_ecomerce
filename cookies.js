/* ═══════════════════════════════════════════════════
   COOKIE STORE — cookies.js

   ⚙️  CONFIGURAÇÕES — altere aqui:
═══════════════════════════════════════════════════ */

// URL do Google Apps Script (veja o guia na aba Gerenciar)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyJvrJfETE3yeNFIqfIlql9joglf98sk5DZJ2LsqNrcFiXl5RRLsNCpFPI0tXY0HAax/exec";

// Senha da aba de gerenciamento (troque para a sua!)
const ADMIN_PASSWORD = "cookies123";

// Chave PIX para pagamento
const PIX_KEY = "12988515550";

/* ─── PRODUTOS PADRÃO (primeira visita) ─── */
const DEFAULT_PRODUCTS = [
  {
    id: "1",
    name: "Cookie de Chocolate Belga",
    desc: "Recheado com gotas de chocolate belga 70%, crocante por fora e macio por dentro.",
    price: 14.90,
    weight: 90,
    image: null
  },
  {
    id: "2",
    name: "Cookie de Pasta de Amendoim",
    desc: "Massa leve com recheio cremoso de pasta de amendoim artesanal.",
    price: 13.90,
    weight: 85,
    image: null
  },
  {
    id: "3",
    name: "Cookie Clássico com Gotas",
    desc: "O clássico de sempre, com gotas de chocolate ao leite e toque de baunilha.",
    price: 11.90,
    weight: 80,
    image: null
  }
];

/* ═══════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════ */
let products  = [];
let cart      = [];
let editingId = null;
let pendingImageBase64 = null;

/* ═══════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════ */
function fmtPrice(val) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/** Gera ID de pedido no formato CK-YYYYMMDD-XXXX */
function generateOrderId() {
  const now = new Date();
  const datePart = now.toISOString().slice(0,10).replace(/-/g,"");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CK-${datePart}-${rand}`;
}

/** Calcula prazo de entrega: >3 cookies = +3 dias úteis, senão +2 dias úteis */
function calcDeliveryDate(totalQty) {
  const days = totalQty > 3 ? 3 : 2;
  const date = new Date();
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) added++; // pula fins de semana
  }
  return date.toLocaleDateString("pt-BR"); // dd/mm/aaaa
}

/* ═══════════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════════ */
function saveProducts() {
  localStorage.setItem("cs_products", JSON.stringify(products));
}
function loadProducts() {
  const raw = localStorage.getItem("cs_products");
  if (raw) { try { products = JSON.parse(raw); return; } catch(e){} }
  products = DEFAULT_PRODUCTS.map(p => ({...p}));
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
    cart = lean
      .map(item => {
        const product = products.find(p => p.id === item.productId);
        return product ? { product, qty: item.qty } : null;
      })
      .filter(Boolean);
  } catch(e) { cart = []; }
}

/* ═══════════════════════════════════════════════════
   TABS
═══════════════════════════════════════════════════ */
function goToTab(name) {
  if (name === "admin") {
    if (!sessionStorage.getItem("cs_admin_ok")) {
      openPasswordModal();
      return;
    }
  }
  activateTab(name);
}

function activateTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  const btn   = document.querySelector(`.tab[data-tab="${name}"]`);
  const panel = document.getElementById(`tab-${name}`);
  if (btn)   btn.classList.add("active");
  if (panel) panel.classList.add("active");

  if (name === "loja")     renderLoja();
  if (name === "carrinho") renderCart();
  if (name === "admin")    renderAdmin();
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => goToTab(tab.dataset.tab));
});

/* ═══════════════════════════════════════════════════
   SENHA / ADMIN LOCK
═══════════════════════════════════════════════════ */
function openPasswordModal() {
  document.getElementById("passwordModalOverlay").classList.remove("hidden");
  document.getElementById("adminPassInput").value = "";
  document.getElementById("passError").classList.add("hidden");
  setTimeout(() => document.getElementById("adminPassInput").focus(), 100);
}
function closePasswordModal() {
  document.getElementById("passwordModalOverlay").classList.add("hidden");
}

document.getElementById("btnConfirmPass").addEventListener("click", checkPassword);
document.getElementById("adminPassInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") checkPassword();
});
document.getElementById("btnCancelPass").addEventListener("click", closePasswordModal);

function checkPassword() {
  const input = document.getElementById("adminPassInput").value;
  if (input === ADMIN_PASSWORD) {
    sessionStorage.setItem("cs_admin_ok", "1");
    closePasswordModal();
    activateTab("admin");
    document.getElementById("adminContent").classList.remove("hidden");
  } else {
    document.getElementById("passError").classList.remove("hidden");
    document.getElementById("adminPassInput").value = "";
    document.getElementById("adminPassInput").focus();
  }
}

document.getElementById("btnLockAdmin").addEventListener("click", () => {
  sessionStorage.removeItem("cs_admin_ok");
  document.getElementById("adminContent").classList.add("hidden");
  goToTab("loja");
  showToast("Sessão encerrada 🔒");
});

/* ═══════════════════════════════════════════════════
   RENDER — LOJA
═══════════════════════════════════════════════════ */
function renderLoja() {
  const grid  = document.getElementById("productsGrid");
  const empty = document.getElementById("lojaEmpty");
  grid.innerHTML = "";

  if (!products.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  products.forEach(p => {
    const inCart     = cart.find(c => c.product.id === p.id);
    const currentQty = inCart ? inCart.qty : 1;

    const card = document.createElement("div");
    card.className = "product-card";

    const imgHtml = p.image
      ? `<img src="${p.image}" alt="${escHtml(p.name)}">`
      : `<div class="card-img-placeholder">🍪</div>`;

    card.innerHTML = `
      <div class="card-img-wrap">${imgHtml}</div>
      <div class="card-body">
        <div class="card-name">${escHtml(p.name)}</div>
        <div class="card-desc">${escHtml(p.desc)}</div>
        <div class="card-meta">
          <span class="card-price">${fmtPrice(p.price)}</span>
          <span class="card-weight">${p.weight}g</span>
        </div>
      </div>
      <div class="card-footer">
        <div class="qty-control">
          <button class="qty-btn" data-action="dec">−</button>
          <span class="qty-display" id="qty-${p.id}">${currentQty}</span>
          <button class="qty-btn" data-action="inc">+</button>
        </div>
        <button class="btn-add-cart" data-id="${p.id}">🛒 Adicionar</button>
      </div>
    `;

    card.querySelectorAll(".qty-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const el  = document.getElementById(`qty-${p.id}`);
        let val   = parseInt(el.textContent);
        val = btn.dataset.action === "inc" ? val + 1 : Math.max(1, val - 1);
        el.textContent = val;
      });
    });

    card.querySelector(".btn-add-cart").addEventListener("click", () => {
      const qty = parseInt(document.getElementById(`qty-${p.id}`).textContent);
      addToCart(p.id, qty);
    });

    grid.appendChild(card);
  });
}

/* ═══════════════════════════════════════════════════
   RENDER — ADMIN
═══════════════════════════════════════════════════ */
function renderAdmin() {
  if (sessionStorage.getItem("cs_admin_ok")) {
    document.getElementById("adminContent").classList.remove("hidden");
  }

  const grid  = document.getElementById("adminGrid");
  const empty = document.getElementById("adminEmpty");
  grid.innerHTML = "";

  if (!products.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  products.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";

    const imgHtml = p.image
      ? `<img src="${p.image}" alt="${escHtml(p.name)}">`
      : `<div class="card-img-placeholder">🍪</div>`;

    card.innerHTML = `
      <div class="card-img-wrap">${imgHtml}</div>
      <div class="card-body">
        <div class="card-name">${escHtml(p.name)}</div>
        <div class="card-desc">${escHtml(p.desc)}</div>
        <div class="card-meta">
          <span class="card-price">${fmtPrice(p.price)}</span>
          <span class="card-weight">${p.weight}g</span>
        </div>
      </div>
      <div class="card-admin-actions">
        <button class="btn btn--edit" data-id="${p.id}">✏️ Editar</button>
        <button class="btn btn--danger" data-id="${p.id}">🗑 Apagar</button>
      </div>
    `;

    card.querySelector(".btn--edit").addEventListener("click", () => openEditModal(p.id));
    card.querySelector(".btn--danger").addEventListener("click", () => deleteProduct(p.id));

    grid.appendChild(card);
  });
}

/* ═══════════════════════════════════════════════════
   RENDER — CARRINHO
═══════════════════════════════════════════════════ */
function renderCart() {
  const cartEmpty  = document.getElementById("cartEmpty");
  const cartLayout = document.getElementById("cartLayout");
  const itemsEl    = document.getElementById("cartItems");
  const totalEl    = document.getElementById("cartTotalDisplay");

  itemsEl.innerHTML = "";

  if (!cart.length) {
    cartEmpty.classList.remove("hidden");
    cartLayout.classList.add("hidden");
    return;
  }

  cartEmpty.classList.add("hidden");
  cartLayout.classList.remove("hidden");

  let total    = 0;
  let totalQty = 0;

  cart.forEach(({ product: p, qty }) => {
    const subtotal = p.price * qty;
    total    += subtotal;
    totalQty += qty;

    const item = document.createElement("div");
    item.className = "cart-item";
    item.dataset.id = p.id;

    const imgHtml = p.image
      ? `<img class="cart-item-img" src="${p.image}" alt="${escHtml(p.name)}">`
      : `<div class="cart-item-img-placeholder">🍪</div>`;

    item.innerHTML = `
      ${imgHtml}
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(p.name)}</div>
        <div class="cart-item-weight">${p.weight}g · ${fmtPrice(p.price)} cada</div>
      </div>
      <div class="cart-item-controls">
        <div class="qty-control">
          <button class="qty-btn" data-action="dec">−</button>
          <span class="qty-display">${qty}</span>
          <button class="qty-btn" data-action="inc">+</button>
        </div>
      </div>
      <div class="cart-item-price">${fmtPrice(subtotal)}</div>
      <button class="cart-remove" aria-label="Remover">🗑</button>
    `;

    item.querySelectorAll(".qty-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        updateCartQty(p.id, btn.dataset.action === "inc" ? 1 : -1);
      });
    });
    item.querySelector(".cart-remove").addEventListener("click", () => removeFromCart(p.id));

    itemsEl.appendChild(item);
  });

  totalEl.textContent = fmtPrice(total);

  // Atualiza prazo de entrega estimado no formulário
  const deadlineEl = document.getElementById("deliveryDeadlineInfo");
  if (deadlineEl) {
    const prazo = totalQty > 3 ? 3 : 2;
    const dataEstimada = calcDeliveryDate(totalQty);
    deadlineEl.innerHTML = `
      <span class="deadline-icon">📦</span>
      Prazo estimado: <strong>${prazo} dias úteis</strong> — entrega até <strong>${dataEstimada}</strong>
      ${totalQty > 3 ? '<span class="deadline-note">(pedidos acima de 3 cookies: +1 dia)</span>' : ''}
    `;
  }
}

/* ═══════════════════════════════════════════════════
   CART LOGIC
═══════════════════════════════════════════════════ */
function addToCart(productId, qty = 1) {
  const product  = products.find(p => p.id === productId);
  if (!product) return;
  const existing = cart.find(c => c.product.id === productId);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ product, qty });
  }
  saveCart();
  updateBadge();
  showToast(`🍪 ${product.name} adicionado!`);
}

function removeFromCart(productId) {
  cart = cart.filter(c => c.product.id !== productId);
  saveCart();
  updateBadge();
  renderCart();
}

function updateCartQty(productId, delta) {
  const item = cart.find(c => c.product.id === productId);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
  renderCart();
}

function clearCart() {
  cart = [];
  saveCart();
  updateBadge();
}

function updateBadge() {
  const badge = document.getElementById("cartBadge");
  const total = cart.reduce((s, c) => s + c.qty, 0);
  badge.textContent = total;
  total > 0 ? badge.classList.remove("hidden") : badge.classList.add("hidden");
}

/* ═══════════════════════════════════════════════════
   MODAL — PRODUTO
═══════════════════════════════════════════════════ */
function openModal(title) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalOverlay").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => document.getElementById("pName").focus(), 100);
}

function closeModal() {
  document.getElementById("modalOverlay").classList.add("hidden");
  document.getElementById("productForm").reset();
  document.getElementById("pId").value = "";
  editingId = null;
  pendingImageBase64 = null;
  document.getElementById("imgPreview").classList.add("hidden");
  document.getElementById("imgPlaceholder").classList.remove("hidden");
  document.body.style.overflow = "";
}

function openNewModal() {
  editingId = null;
  pendingImageBase64 = null;
  document.getElementById("productForm").reset();
  document.getElementById("pId").value = "";
  document.getElementById("imgPreview").classList.add("hidden");
  document.getElementById("imgPlaceholder").classList.remove("hidden");
  openModal("Novo Cookie");
}

function openEditModal(id) {
  const p = products.find(p => p.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById("pId").value    = id;
  document.getElementById("pName").value  = p.name;
  document.getElementById("pDesc").value  = p.desc;
  document.getElementById("pPrice").value = p.price;
  document.getElementById("pWeight").value = p.weight;
  pendingImageBase64 = p.image || null;
  if (p.image) {
    document.getElementById("imgPreview").src = p.image;
    document.getElementById("imgPreview").classList.remove("hidden");
    document.getElementById("imgPlaceholder").classList.add("hidden");
  } else {
    document.getElementById("imgPreview").classList.add("hidden");
    document.getElementById("imgPlaceholder").classList.remove("hidden");
  }
  openModal("Editar Cookie");
}

document.getElementById("btnNewProduct").addEventListener("click", openNewModal);
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("btnCancelModal").addEventListener("click", closeModal);
document.getElementById("modalOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

/* ─── Upload de Imagem ─── */
document.getElementById("pImage").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast("Imagem muito grande! Máximo 2MB.", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    pendingImageBase64 = ev.target.result;
    document.getElementById("imgPreview").src = pendingImageBase64;
    document.getElementById("imgPreview").classList.remove("hidden");
    document.getElementById("imgPlaceholder").classList.add("hidden");
  };
  reader.readAsDataURL(file);
});

document.getElementById("imgUploadWrap").addEventListener("click", (e) => {
  if (e.target !== document.getElementById("pImage")) {
    document.getElementById("pImage").click();
  }
});

/* ─── Salvar Produto ─── */
document.getElementById("productForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name   = document.getElementById("pName").value.trim();
  const desc   = document.getElementById("pDesc").value.trim();
  const price  = parseFloat(document.getElementById("pPrice").value);
  const weight = parseInt(document.getElementById("pWeight").value);

  if (!name || isNaN(price) || isNaN(weight)) {
    showToast("Preencha nome, preço e peso!", "error");
    return;
  }

  const productData = { name, desc, price, weight, image: pendingImageBase64 };

  if (editingId) {
    const idx = products.findIndex(p => p.id === editingId);
    if (idx !== -1) {
      products[idx] = { id: editingId, ...productData };
      cart.forEach(c => {
        if (c.product.id === editingId) c.product = { ...products[idx] };
      });
      saveCart();
    }
    showToast("Cookie atualizado! ✏️");
  } else {
    products.push({ id: Date.now().toString(), ...productData });
    showToast("Cookie criado! 🎉");
  }

  saveProducts();
  closeModal();
  renderAdmin();
});

function deleteProduct(id) {
  const p = products.find(p => p.id === id);
  if (!p || !confirm(`Apagar "${p.name}"?\nEsta ação não pode ser desfeita.`)) return;
  products = products.filter(p => p.id !== id);
  cart     = cart.filter(c => c.product.id !== id);
  saveProducts();
  saveCart();
  updateBadge();
  renderAdmin();
  showToast("Cookie removido.", "error");
}

/* ═══════════════════════════════════════════════════
   MODAL — CONFIRMAÇÃO DE PEDIDO
═══════════════════════════════════════════════════ */
function openOrderConfirmModal({ orderId, total, deliveryDate, payment }) {
  const overlay = document.getElementById("orderConfirmOverlay");
  const isPix   = payment === "PIX";

  document.getElementById("confirmOrderId").textContent    = orderId;
  document.getElementById("confirmDelivery").textContent   = deliveryDate;
  document.getElementById("confirmTotal").textContent      = fmtPrice(total);
  document.getElementById("confirmPayment").textContent    = payment;

  const pixSection = document.getElementById("pixSection");
  if (isPix) {
    document.getElementById("pixKeyDisplay").textContent = PIX_KEY;
    pixSection.classList.remove("hidden");
  } else {
    pixSection.classList.add("hidden");
  }

  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeOrderConfirmModal() {
  document.getElementById("orderConfirmOverlay").classList.add("hidden");
  document.body.style.overflow = "";
}

document.getElementById("btnCloseConfirm").addEventListener("click", () => {
  closeOrderConfirmModal();
  goToTab("loja");
});

document.getElementById("orderConfirmOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    closeOrderConfirmModal();
    goToTab("loja");
  }
});

/* Copiar chave PIX */
document.getElementById("btnCopyPix").addEventListener("click", () => {
  navigator.clipboard.writeText(PIX_KEY).then(() => {
    showToast("Chave PIX copiada! 📋");
  }).catch(() => {
    showToast("Chave: " + PIX_KEY);
  });
});

/* ═══════════════════════════════════════════════════
   ORDER FORM
═══════════════════════════════════════════════════ */
document.getElementById("orderForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!cart.length) {
    showToast("Adicione itens ao carrinho primeiro!", "error");
    return;
  }

  const name    = document.getElementById("clientName").value.trim();
  const phone   = document.getElementById("clientPhone").value.trim();
  const slack   = document.getElementById("clientSlack").value.trim();
  const payment = document.getElementById("paymentMethod").value;
  const notes   = document.getElementById("orderNotes").value.trim();

  // Validação
  const requiredFields = { clientName: name, clientPhone: phone, paymentMethod: payment };
  document.querySelectorAll(".form-group input,.form-group select").forEach(el => el.classList.remove("error"));
  let hasError = false;
  Object.entries(requiredFields).forEach(([id, val]) => {
    if (!val) {
      document.getElementById(id).classList.add("error");
      hasError = true;
    }
  });
  if (hasError) { showToast("Preencha todos os campos obrigatórios!", "error"); return; }

  // Calcular prazo e ID
  const totalQty    = cart.reduce((s, c) => s + c.qty, 0);
  const deliveryDate = calcDeliveryDate(totalQty);
  const orderId     = generateOrderId();

  const itemsList = cart.map(c =>
    `${c.qty}x ${c.product.name} (${c.product.weight}g) = ${fmtPrice(c.product.price * c.qty)}`
  ).join(" | ");

  const total = cart.reduce((s, c) => s + c.product.price * c.qty, 0);

  const orderData = {
    id_pedido:     orderId,
    data_pedido:   new Date().toLocaleString("pt-BR"),
    nome:          name,
    telefone:      phone,
    slack:         slack || "—",
    data_entrega:  deliveryDate,
    prazo_dias:    totalQty > 3 ? "3" : "2",
    pagamento:     payment,
    itens:         itemsList,
    total:         fmtPrice(total),
    observacoes:   notes || "—",
    prioridade:    new Date().toISOString() // ISO para ordenação no Sheets
  };

  // Loading state
  const btn = document.getElementById("submitOrder");
  document.getElementById("submitLabel").classList.add("hidden");
  document.getElementById("submitLoading").classList.remove("hidden");
  btn.disabled = true;

  try {
    sendToSheets(orderData);
    clearCart();
    document.getElementById("orderForm").reset();
    renderCart();
    // Fecha o estado de loading antes de abrir o modal
    document.getElementById("submitLabel").classList.remove("hidden");
    document.getElementById("submitLoading").classList.add("hidden");
    btn.disabled = false;
    // Abre modal de confirmação
    openOrderConfirmModal({ orderId, total, deliveryDate, payment });
  } catch(err) {
    console.error(err);
    showToast("Erro ao enviar. Verifique a URL do Apps Script.", "error");
    document.getElementById("submitLabel").classList.remove("hidden");
    document.getElementById("submitLoading").classList.add("hidden");
    btn.disabled = false;
  }
});

/* ═══════════════════════════════════════════════════
   GOOGLE SHEETS
═══════════════════════════════════════════════════ */
function sendToSheets(data) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = APPS_SCRIPT_URL;
  form.target = "hidden_iframe";

  for (let key in data) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = data[key];
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

/* ═══════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════ */
let toastTimer = null;
function showToast(msg, type = "default") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

/* ═══════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════ */
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