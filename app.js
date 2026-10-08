const $app = document.getElementById('app');
let me = null;
let cart = JSON.parse(localStorage.getItem('cart') || '[]'); // [{productId, quantity}]
let productCache = {};

const money = n => '₹' + Number(n).toLocaleString('en-IN');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }
function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); document.getElementById('cartCount').textContent = cart.reduce((s, i) => s + i.quantity, 0); }
function addToCart(id, qty = 1) {
  const line = cart.find(i => i.productId === id);
  line ? line.quantity += qty : cart.push({ productId: id, quantity: qty });
  saveCart(); toast('Added to cart');
}
function renderNav() {
  document.getElementById('navLogin').hidden = !!me;
  document.getElementById('navLogout').hidden = !me;
  document.getElementById('navOrders').hidden = !me;
}
document.getElementById('navLogout').onclick = async () => { await api('/api/logout', { method: 'POST' }); me = null; renderNav(); location.hash = '#/'; toast('Logged out'); };

// ---------- views ----------
async function shopView() {
  $app.innerHTML = `
    <h1>Plants that survive<br>your busy week.</h1>
    <p class="sub">Healthy plants and pots, packed carefully and delivered to your door.</p>
    <div class="tools">
      <input id="q" type="search" placeholder="Search plants" aria-label="Search plants">
      <select id="cat" aria-label="Category"><option>All</option><option>Indoor</option><option>Succulent</option><option>Herb</option><option>Pots</option></select>
    </div>
    <div class="grid" id="grid"></div>`;
  const load = async () => {
    const q = document.getElementById('q').value, category = document.getElementById('cat').value;
    const list = await api(`/api/products?q=${encodeURIComponent(q)}&category=${category}`);
    list.forEach(p => productCache[p.id] = p);
    document.getElementById('grid').innerHTML = list.length ? list.map(p => `
      <a class="card" href="#/product/${p.id}">
        <div class="tile" style="background:${p.color}">${p.emoji}</div>
        <div class="body"><h3>${esc(p.name)}</h3><div class="muted">${esc(p.category)}</div><div class="price">${money(p.price)}</div></div>
      </a>`).join('') : '<p class="muted">No plants match that search. Try a different word.</p>';
  };
  let t; document.getElementById('q').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  document.getElementById('cat').onchange = load;
  load();
}

async function productView(id) {
  const p = await api('/api/products/' + id);
  productCache[p.id] = p;
  $app.innerHTML = `
    <p><a href="#/">← Back to shop</a></p>
    <div class="detail">
      <div class="tile" style="background:${p.color}">${p.emoji}</div>
      <div>
        <div class="muted">${esc(p.category)}</div>
        <h1 style="font-size:2.6rem">${esc(p.name)}</h1>
        <p>${esc(p.description)}</p>
        <p class="price" style="font-size:1.6rem">${money(p.price)}</p>
        <p class="muted">${p.stock > 0 ? p.stock + ' in stock' : 'Out of stock'}</p>
        <button class="btn" id="add" ${p.stock < 1 ? 'disabled' : ''}>Add to cart</button>
      </div>
    </div>`;
  document.getElementById('add').onclick = () => addToCart(p.id);
}

async function cartView() {
  if (!cart.length) { $app.innerHTML = `<h1>Your cart</h1><p class="sub">It's empty. <a href="#/">Browse the shop</a> to find your first plant.</p>`; return; }
  for (const i of cart) if (!productCache[i.productId]) productCache[i.productId] = await api('/api/products/' + i.productId);
  const total = cart.reduce((s, i) => s + productCache[i.productId].price * i.quantity, 0);
  $app.innerHTML = `
    <h1>Your cart</h1>
    <div style="max-width:720px">
      ${cart.map(i => { const p = productCache[i.productId]; return `
        <div class="row">
          <div class="mini" style="background:${p.color}">${p.emoji}</div>
          <div class="grow"><strong>${esc(p.name)}</strong><div class="muted">${money(p.price)} each</div></div>
          <div class="qty"><button data-dec="${p.id}" aria-label="Decrease">−</button><span>${i.quantity}</span><button data-inc="${p.id}" aria-label="Increase">+</button></div>
          <strong style="width:80px;text-align:right">${money(p.price * i.quantity)}</strong>
          <button class="link" data-rm="${p.id}">Remove</button>
        </div>`; }).join('')}
      <div class="total"><span>Total</span><span>${money(total)}</span></div>
      <div class="panel" style="max-width:none">
        <label for="addr">Delivery address</label>
        <textarea id="addr" rows="3" placeholder="House no., street, city, PIN"></textarea>
        <div class="err" id="err"></div>
        <button class="btn" id="checkout">Place order</button>
      </div>
    </div>`;
  $app.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => { cart.find(i => i.productId == b.dataset.inc).quantity++; saveCart(); cartView(); });
  $app.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { const l = cart.find(i => i.productId == b.dataset.dec); if (--l.quantity < 1) cart = cart.filter(x => x !== l); saveCart(); cartView(); });
  $app.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { cart = cart.filter(i => i.productId != b.dataset.rm); saveCart(); cartView(); });
  document.getElementById('checkout').onclick = async () => {
    if (!me) { toast('Log in to place your order'); location.hash = '#/login'; return; }
    try {
      const o = await api('/api/orders', { method: 'POST', body: { items: cart, address: document.getElementById('addr').value } });
      cart = []; saveCart(); productCache = {};
      $app.innerHTML = `<h1>Order #${o.id} placed</h1><p class="sub">Total ${money(o.total)}. We'll pack it today. <a href="#/orders">View your orders</a>.</p>`;
    } catch (e) { document.getElementById('err').textContent = e.message; }
  };
}

function authView(mode) {
  const reg = mode === 'register';
  $app.innerHTML = `
    <h1>${reg ? 'Create your account' : 'Welcome back'}</h1>
    <div class="panel">
      ${reg ? '<label for="name">Name</label><input id="name" autocomplete="name">' : ''}
      <label for="email">Email</label><input id="email" type="email" autocomplete="email">
      <label for="pw">Password</label><input id="pw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}">
      <div class="err" id="err"></div>
      <button class="btn" id="go">${reg ? 'Create account' : 'Log in'}</button>
      <p class="muted">${reg ? 'Already registered? <a href="#/login">Log in</a>' : 'New here? <a href="#/register">Create an account</a>'}</p>
    </div>`;
  const submit = async () => {
    try {
      const body = { email: email.value, password: pw.value }; if (reg) body.name = name.value;
      me = await api(reg ? '/api/register' : '/api/login', { method: 'POST', body });
      renderNav(); toast('Welcome, ' + me.name); location.hash = cart.length ? '#/cart' : '#/';
    } catch (e) { err.textContent = e.message; }
  };
  go.onclick = submit; pw.onkeydown = e => e.key === 'Enter' && submit();
}

async function ordersView() {
  if (!me) { location.hash = '#/login'; return; }
  const orders = await api('/api/orders');
  $app.innerHTML = `<h1>My orders</h1>` + (orders.length ? orders.map(o => `
    <div class="order">
      <div style="display:flex;justify-content:space-between"><strong>Order #${o.id}</strong><span class="status">${esc(o.status)}</span></div>
      <div class="muted">${new Date(o.created_at + 'Z').toLocaleString()} · ${esc(o.address)}</div>
      ${o.items.map(i => `<div>${i.emoji} ${esc(i.name)} × ${i.quantity} — ${money(i.unit_price * i.quantity)}</div>`).join('')}
      <div class="price" style="margin-top:8px">Total ${money(o.total)}</div>
    </div>`).join('') : `<p class="sub">No orders yet. <a href="#/">Start shopping</a>.</p>`);
}

// ---------- router ----------
async function route() {
  const [, page, arg] = location.hash.split('/');
  try {
    if (!page) await shopView();
    else if (page === 'product') await productView(arg);
    else if (page === 'cart') await cartView();
    else if (page === 'login') authView('login');
    else if (page === 'register') authView('register');
    else if (page === 'orders') await ordersView();
    else await shopView();
  } catch (e) { $app.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
(async () => { me = await api('/api/me'); renderNav(); saveCart(); route(); })();
