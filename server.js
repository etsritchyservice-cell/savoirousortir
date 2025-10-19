// === SERVER.JS ===
// Version professionnelle avec sécurité JWT, CORS, protection des routes
const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const db = new Database("database.sqlite");

// === CONFIGURATION ===
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey"; // À personnaliser pour production
const TOKEN_EXPIRY = "7d"; // Validité du token

// CORS (autorise tout le monde, à restreindre si besoin)
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// === Création des tables (si non existantes) ===
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstname TEXT,
    lastname TEXT,
    email TEXT UNIQUE,
    password TEXT,
    created_at TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    date TEXT,
    place TEXT,
    category TEXT,
    description TEXT,
    created_at TEXT
  )
`).run();

// === MIDDLEWARE JWT PROTECTION ===
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token manquant" });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token invalide" });
    req.user = user;
    next();
  });
}

// === ROUTES ===

// Inscription utilisateur
app.post("/api/register", async (req, res) => {
  const { firstname, lastname, email, password } = req.body;
  if (!firstname || !lastname || !email || !password)
    return res.status(400).json({ error: "Champs manquants" });

  try {
    const hash = await bcrypt.hash(password, 10);
    db.prepare(
      "INSERT INTO users (firstname, lastname, email, password, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(firstname, lastname, email, hash, new Date().toISOString());
    res.json({ success: true, message: "Inscription réussie" });
  } catch (err) {
    res.status(400).json({ error: "Email déjà utilisé" });
  }
});

// Connexion utilisateur (renvoie un JWT)
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) return res.status(401).json({ error: "Utilisateur inconnu" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Mot de passe incorrect" });

  // Génère un token JWT (ne renvoie jamais le mot de passe)
  const token = jwt.sign(
    {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email
    }
  });
});

// Publier un événement (protéger la route)
app.post("/api/events", authenticateToken, (req, res) => {
  const { title, date, place, category, description } = req.body;
  const user_id = req.user.id;
  if (!user_id || !title || !date || !place)
    return res.status(400).json({ error: "Champs obligatoires manquants" });

  db.prepare(
    "INSERT INTO events (user_id, title, date, place, category, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(user_id, title, date, place, category, description, new Date().toISOString());
  res.json({ success: true, message: "Événement publié !" });
});

// Liste de tous les événements publics (pagination possible)
app.get("/api/events", (req, res) => {
  let { page = 1, limit = 30 } = req.query;
  page = parseInt(page);
  limit = parseInt(limit);
  const offset = (page - 1) * limit;

  const events = db.prepare(`
    SELECT e.*, u.firstname || ' ' || u.lastname AS author
    FROM events e
    LEFT JOIN users u ON e.user_id = u.id
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  res.json(events);
});

// Supprimer un événement (propriétaire uniquement)
app.delete("/api/events/:id", authenticateToken, (req, res) => {
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Événement introuvable" });
  if (event.user_id !== req.user.id)
    return res.status(403).json({ error: "Non autorisé à supprimer cet événement" });

  db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
  res.json({ success: true, message: "Événement supprimé" });
});

// Modifier un événement (propriétaire uniquement)
app.put("/api/events/:id", authenticateToken, (req, res) => {
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).json({ error: "Événement introuvable" });
  if (event.user_id !== req.user.id)
    return res.status(403).json({ error: "Non autorisé à modifier cet événement" });

  const { title, date, place, category, description } = req.body;
  db.prepare(
    "UPDATE events SET title = ?, date = ?, place = ?, category = ?, description = ? WHERE id = ?"
  ).run(title, date, place, category, description, req.params.id);
  res.json({ success: true, message: "Événement mis à jour" });
});

// === GESTION DES ERREURS GLOBALES ===
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erreur serveur" });
});

// === Lancement du serveur ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});