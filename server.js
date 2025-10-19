// server.js

// Modules
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');       // Remplacement de bcrypt
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose(); // Remplacement de better-sqlite3
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error('Erreur DB :', err.message);
  else console.log('✅ Base de données SQLite connectée');
});

// Créer table utilisateurs si elle n'existe pas
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)`);

// Routes

// Exemple : Inscription
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Champs manquants' });

  const hashedPassword = bcrypt.hashSync(password, 10);

  const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
  stmt.run(username, hashedPassword, function(err) {
    if (err) return res.status(400).json({ message: 'Utilisateur existant' });
    res.json({ message: 'Utilisateur créé', id: this.lastID });
  });
});

// Exemple : Connexion
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Champs manquants' });

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ message: 'Erreur serveur' });
    if (!user) return res.status(400).json({ message: 'Utilisateur non trouvé' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Mot de passe incorrect' });

    // Création d’un token JWT (optionnel)
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    res.json({ message: 'Connexion réussie', token });
  });
});

// Exemple route test
app.get('/', (req, res) => {
  res.send('✅ Serveur en ligne sur Render !');
});

// Port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});
