const Database = require('better-sqlite3');
const db = new Database(__dirname + '/store.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  emoji TEXT NOT NULL,
  color TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  total REAL NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL
);
`);

if (db.prepare('SELECT COUNT(*) c FROM products').get().c === 0) {
  const ins = db.prepare('INSERT INTO products (name,description,price,stock,category,emoji,color) VALUES (?,?,?,?,?,?,?)');
  [
    ['Monstera Deliciosa', 'Big split leaves, easy to grow. Likes bright, indirect light and water once a week.', 899, 12, 'Indoor', '🌿', '#CFE8D5'],
    ['Snake Plant', 'Nearly unkillable. Tolerates low light and forgets to be thirsty for weeks.', 449, 30, 'Indoor', '🪴', '#E3EBC4'],
    ['Aloe Vera', 'Soothing gel inside, sun-lover outside. Great for a kitchen window.', 299, 25, 'Succulent', '🌵', '#D6EFE0'],
    ['Peace Lily', 'White blooms and glossy leaves. Droops dramatically when it needs water.', 549, 15, 'Indoor', '🌼', '#F6E7B8'],
    ['Money Plant', 'Trails down shelves or climbs a pole. Grows in just a glass of water.', 199, 40, 'Indoor', '🍃', '#D2EBCB'],
    ['Jade Plant', 'Thick, coin-like leaves. A slow, long-living desk companion.', 349, 18, 'Succulent', '🌱', '#CBE9DD'],
    ['Tulsi (Holy Basil)', 'Fragrant, sacred and useful for tea. Needs sun and regular watering.', 149, 50, 'Herb', '🌾', '#E1EDB9'],
    ['Terracotta Pot (6")', 'Hand-finished clay pot with a drainage hole and saucer.', 249, 60, 'Pots', '🏺', '#F5D9C6'],
  ].forEach(p => ins.run(...p));
}
module.exports = db;
