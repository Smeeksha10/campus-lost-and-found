const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// ================= ADMIN LOGIN =================
const ADMIN_EMAIL = "admin@findora.com";
const ADMIN_PASSWORD = "1234";

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ================= ENSURE UPLOADS FOLDER EXISTS =================
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// ================= DATABASE =================
const db = new sqlite3.Database('./campus.db', (err) => {
    if (err) {
        console.error("Database Error:", err.message);
    } else {
        console.log("📡 Connected to SQLite Database");
    }
});

// ================= IMAGE UPLOAD =================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });

// ================= CREATE TABLES =================
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            email TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            type TEXT NOT NULL,
            image TEXT,
            email TEXT,
            date TEXT,
            time TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("✅ Database Tables Ready");
});

// ================= ROUTES =================

// HOME PAGE
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ADMIN LOGIN
app.post('/api/admin-login', (req, res) => {
    const { email, password } = req.body;

    if (email === "admin@findora.com" && password === "1234") {
        res.json({ success: true });
    } else {
        res.status(401).json({ message: "Invalid credentials" });
    }
});
// GET ITEMS
app.get('/api/items', (req, res) => {
    const { search, date } = req.query;

    let query = "SELECT * FROM items WHERE 1=1";
    let params = [];

    if (search) {
        query += " AND (name LIKE ? OR location LIKE ? OR date LIKE ?)";
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (date) {
        query += " AND date = ?";
        params.push(date);
    }

    query += " ORDER BY id DESC";

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error("❌ Fetch Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ADD ITEM FROM ADMIN PANEL
app.post('/api/items', (req, res) => {
    const { name, location, type, image, email } = req.body;

    if (!name || !location || !type) {
        return res.status(400).json({ error: "All fields required" });
    }

    const sql = `
        INSERT INTO items (name, location, type, image, email, status)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [name, location, type, image || null, email || null, "Available"];

    db.run(sql, values, function (err) {
        if (err) {
            console.error("❌ DB ERROR:", err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json({ message: "Item added successfully", id: this.lastID });
    });
});

// REPORT ITEM WITH FILE UPLOAD
app.post('/api/report', upload.single('image'), (req, res) => {
    const { name, location, type, email, date } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !location || !type || !email || !date) {
        return res.status(400).json({ error: "All fields required" });
    }

    const sql = `
        INSERT INTO items (name, location, type, image, email, date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [name, location, type, image, email, date, "Available"];

    console.log("SQL values:", values);

    db.run(sql, values, function (err) {
        if (err) {
            console.error("❌ DB ERROR:", err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json({ message: "Item added successfully", id: this.lastID });
    });
});

// UPDATE ITEM TYPE / STATUS
app.put('/api/items/:id', (req, res) => {
    const { type } = req.body;
    const id = req.params.id;

    if (!type) {
        return res.status(400).json({ error: "Type is required" });
    }

    db.run(
        "UPDATE items SET type = ? WHERE id = ?",
        [type, id],
        function (err) {
            if (err) {
                console.error("❌ Update Error:", err.message);
                return res.status(500).json({ error: err.message });
            }

            res.json({ message: "Updated successfully" });
        }
    );
});

// DELETE ITEM
app.delete('/api/items/:id', (req, res) => {
    const id = req.params.id;

    db.run(
        "DELETE FROM items WHERE id = ?",
        [id],
        function (err) {
            if (err) {
                console.error("❌ Delete Error:", err.message);
                return res.status(500).json({ error: err.message });
            }

            res.json({ message: "Deleted successfully" });
        }
    );
});

// SIGNUP
app.post('/api/signup', (req, res) => {
    const { username, email, password } = req.body;

    db.run(
        "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
        [username, email, password],
        function (err) {
            if (err) {
                console.error("❌ Signup Error:", err.message);
                return res.status(400).json({ message: "User exists or invalid data" });
            }

            res.json({ message: "Signup successful" });
        }
    );
});

// LOGIN
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get(
        "SELECT * FROM users WHERE username = ? AND password = ?",
        [username, password],
        (err, user) => {
            if (err) {
                console.error("❌ Login Error:", err.message);
                return res.status(500).json({ message: err.message });
            }

            if (user) {
                res.json({
                    message: "Login successful",
                    user: {
                        username: user.username,
                        email: user.email
                    }
                });
            } else {
                res.status(401).json({ message: "Invalid credentials" });
            }
        }
    );
});

// MATCHING SYSTEM
app.get('/api/match', (req, res) => {
    const { name, location, type } = req.query;
    const oppositeType = type === 'lost' ? 'found' : 'lost';

    db.all(
        "SELECT * FROM items WHERE type = ? AND (name LIKE ? OR location LIKE ?)",
        [oppositeType, `%${name || ''}%`, `%${location || ''}%`],
        (err, rows) => {
            if (err) {
                console.error("❌ Match Error:", err.message);
                return res.status(500).json({ error: err.message });
            }

            res.json(rows);
        }
    );
});

app.put('/api/items/:id/return', (req, res) => {
    const id = req.params.id;

    db.run(
        "UPDATE items SET status = ? WHERE id = ?",
        ["Returned", id],
        function(err) {
            if (err) {
                console.error("❌ Return Update Error:", err.message);
                return res.status(500).json({ error: err.message });
            }

            res.json({ message: "Item marked as returned" });
        }
    );
});

// ================= SERVER START =================
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});