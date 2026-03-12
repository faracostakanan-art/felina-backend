const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("./database");

const app = express();
const PORT = 3001;
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
      .run(userId, username, 0);
  }

  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
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

    createUserIfNotExists(user_id);

    db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?")
      .run(Number(amount), user_id);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(user_id);
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

    const imageUrl = req.file ? `http://localhost:${PORT}/uploads/${req.file.filename}` : "";

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

app.listen(PORT, () => {
  console.log("API lancée sur http://localhost:" + PORT);
});
