const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = "TIGER2006";

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    cb(null, name);
  }
});

const upload = multer({ storage });

function createUserIfNotExists(userId, username = "") {
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

  if (!existing) {
    db.prepare("INSERT INTO users (id, username, balance) VALUES (?, ?, ?)")
      .run(String(userId), username, 0);
  }

  return db.prepare("SELECT * FROM users WHERE id = ?").get(String(userId));
}

app.get("/api/user/:userId", (req, res) => {
  try {
    const user = createUserIfNotExists(req.params.userId);
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/admin/add-balance", (req, res) => {
  try {
    const { password, user_id, amount } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    if (!user_id || amount === undefined || isNaN(Number(amount))) {
      return res.status(400).json({ error: "Champs manquants ou invalides" });
    }

    createUserIfNotExists(String(user_id));

    db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?")
      .run(Number(amount), String(user_id));

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(String(user_id));
    res.json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/api/products", (req, res) => {
  try {
    const products = db
      .prepare("SELECT id, title, subtitle, price, image_url FROM products WHERE visible = 1 ORDER BY id DESC")
      .all();

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/api/admin/products", (req, res) => {
  try {
    const products = db.prepare("SELECT * FROM products ORDER BY id DESC").all();
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/admin/products", upload.single("image"), (req, res) => {
  try {
    const { password, title, subtitle, price, hidden_content } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    if (!title || price === undefined || !hidden_content) {
      return res.status(400).json({ error: "Champs manquants" });
    }

    const imageUrl = req.file
      ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
      : "";

    const result = db.prepare(`
      INSERT INTO products (title, subtitle, price, image_url, hidden_content, visible)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(
      title,
      subtitle || "",
      Number(price),
      imageUrl,
      hidden_content
    );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.delete("/api/admin/products/:id", (req, res) => {
  try {
    const { password } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/checkout", (req, res) => {
  try {
    const { user_id, product_id } = req.body;

    if (!user_id || !product_id) {
      return res.status(400).json({ error: "Champs manquants" });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(String(user_id));
    const product = db.prepare("SELECT * FROM products WHERE id = ? AND visible = 1").get(product_id);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    if (!product) {
      return res.status(404).json({ error: "Produit introuvable" });
    }

    if (Number(user.balance) < Number(product.price)) {
      return res.status(400).json({ error: "Solde insuffisant" });
    }

    const insertOrder = db.prepare(`
      INSERT INTO orders (user_id, status)
      VALUES (?, ?)
    `).run(String(user_id), "COMPLETED");

    const orderId = insertOrder.lastInsertRowid;

    db.prepare(`
      INSERT INTO order_items (
        order_id,
        product_id,
        title,
        subtitle,
        price,
        image_url,
        hidden_content
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      product.id,
      product.title,
      product.subtitle || "",
      Number(product.price),
      product.image_url || "",
      product.hidden_content || ""
    );

    db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?")
      .run(Number(product.price), String(user_id));

    db.prepare("DELETE FROM products WHERE id = ?").run(product.id);

    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(String(user_id));

    res.json({
      success: true,
      balance: Number(updatedUser.balance),
      order_id: orderId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/api/orders/:userId", (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT * FROM orders
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(String(req.params.userId));

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/api/orders/:userId/:orderId", (req, res) => {
  try {
    const order = db.prepare(`
      SELECT * FROM orders
      WHERE id = ? AND user_id = ?
    `).get(req.params.orderId, String(req.params.userId));

    if (!order) {
      return res.status(404).json({ error: "Commande introuvable" });
    }

    const items = db.prepare(`
      SELECT * FROM order_items
      WHERE order_id = ?
      ORDER BY id DESC
    `).all(order.id);

    res.json({
      ...order,
      items
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("API lancée sur le port " + PORT);
});
