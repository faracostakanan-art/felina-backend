const Database = require("better-sqlite3");

const db = new Database("shop.sqlite");

db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT DEFAULT '',
  balance REAL DEFAULT 0
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  price REAL NOT NULL,
  image_url TEXT DEFAULT '',
  hidden_content TEXT DEFAULT '',
  visible INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'COMPLETED',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  price REAL NOT NULL,
  image_url TEXT DEFAULT '',
  hidden_content TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

try {
  db.prepare(`ALTER TABLE products ADD COLUMN image_url TEXT DEFAULT ''`).run();
} catch (e) {}

try {
  db.prepare(`ALTER TABLE order_items ADD COLUMN image_url TEXT DEFAULT ''`).run();
} catch (e) {}

module.exports = db;
