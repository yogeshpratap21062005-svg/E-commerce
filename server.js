const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));

// ---------- auth helpers ----------
function sign(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET, { expiresIn: '7d' });
}
function setCookie(res, token) {
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 });
}
function auth(req, res, next) {
  try { req.user = jwt.verify(req.cookies.token, SECRET); next(); }
  catch { res.status(401).json({ error: 'Please log in first.' }); }
}

// ---------- auth routes ----------
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase()))
    return res.status(409).json({ error: 'That email is already registered.' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)').run(name.trim(), email.toLowerCase(), hash);
  const user = { id: info.lastInsertRowid, name: name.trim(), email: email.toLowerCase() };
  setCookie(res, sign(user));
  res.status(201).json(user);
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase());
  if (!row || !bcrypt.compareSync(password || '', row.password_hash))
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  const user = { id: row.id, name: row.name, email: row.email };
  setCookie(res, sign(user));
  res.json(user);
});

app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

app.get('/api/me', (req, res) => {
  try { const u = jwt.verify(req.cookies.token, SECRET); res.json({ id: u.id, name: u.name, email: u.email }); }
  catch { res.json(null); }
});

// ---------- products ----------
app.get('/api/products', (req, res) => {
  const { q, category } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const args = [];
  if (q) { sql += ' AND (name LIKE ? OR description LIKE ?)'; args.push(`%${q}%`, `%${q}%`); }
  if (category && category !== 'All') { sql += ' AND category = ?'; args.push(category); }
  res.json(db.prepare(sql + ' ORDER BY id').all(...args));
});

app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  p ? res.json(p) : res.status(404).json({ error: 'Product not found.' });
});

// ---------- orders ----------
app.post('/api/orders', auth, (req, res) => {
  const { items, address } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Your cart is empty.' });
  if (!address || address.trim().length < 8) return res.status(400).json({ error: 'Please enter a full delivery address.' });

  const place = db.transaction(() => {
    let total = 0;
    const lines = [];
    for (const it of items) {
      const qty = parseInt(it.quantity, 10);
      const p = db.prepare('SELECT * FROM products WHERE id = ?').get(it.productId);
      if (!p || !(qty > 0)) throw new Error('Invalid item in cart.');
      if (p.stock < qty) throw new Error(`Only ${p.stock} left of ${p.name}.`);
      total += p.price * qty;               // price always comes from DB, never from the client
      lines.push({ p, qty });
    }
    const o = db.prepare('INSERT INTO orders (user_id,total,address) VALUES (?,?,?)').run(req.user.id, total, address.trim());
    for (const { p, qty } of lines) {
      db.prepare('INSERT INTO order_items (order_id,product_id,quantity,unit_price) VALUES (?,?,?,?)').run(o.lastInsertRowid, p.id, qty, p.price);
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(qty, p.id);
    }
    return { id: o.lastInsertRowid, total };
  });

  try { res.status(201).json(place()); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/orders', auth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  const itemsStmt = db.prepare(`SELECT oi.quantity, oi.unit_price, p.name, p.emoji FROM order_items oi
                                JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`);
  res.json(orders.map(o => ({ ...o, items: itemsStmt.all(o.id) })));
});

app.listen(PORT, () => console.log(`Leafline store running at http://localhost:${PORT}`));
