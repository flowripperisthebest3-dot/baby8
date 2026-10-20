const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DB_FILE = './keys.json';
const FILES_FILE = './files.json';
const ADMIN_PASSWORD = "Fearless@Admin2026";

function loadKeys() {
  if (!fs.existsSync(DB_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch(e) {
    return {};
  }
}

function saveKeys(keys) {
  fs.writeFileSync(DB_FILE, JSON.stringify(keys, null, 2));
}

// --- FILES FUNCTIONS - NEW ---
function loadFiles() {
  if (!fs.existsSync(FILES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILES_FILE, 'utf8'));
  } catch(e) {
    return [];
  }
}

function saveFiles(files) {
  fs.writeFileSync(FILES_FILE, JSON.stringify(files, null, 2));
}
// --- END FILES FUNCTIONS ---

// HOME
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

// GENERATE KEY - for your admin panel
app.post('/api/generate', (req, res) => {
  const days = parseInt(req.body.days) || 30;
  const key = "FEARLESS-" + Math.random().toString(36).substring(2,6).toUpperCase() + "-" + Math.random().toString(36).substring(2,6).toUpperCase() + "-" + Math.random().toString(36).substring(2,4).toUpperCase();
  
  const expiry = Date.now() + (days * 24 * 60 * 60 * 1000);
  const keys = loadKeys();
  
  keys[key] = {
    expiry: expiry,
    days: days,
    banned: false,
    hwid: null,
    createdAt: new Date().toISOString()
  };
  
  saveKeys(keys);
  console.log(`Generated: ${key} for ${days} days`);
  res.json({ success: true, key: key, days: days, expiry: new Date(expiry).toISOString() });
});

// VALIDATE KEY - this is what your app will call
// URL: /api/v1/auth/validate (same as evucore so your app code doesn't change much)
app.post('/api/v1/auth/validate', (req, res) => {
  const { key, hwid } = req.body;
  
  if (!key) return res.status(400).json({ error: "key_required" });
  
  const keys = loadKeys();
  
  if (!keys[key]) {
    return res.status(401).json({ error: "invalid_key" });
  }
  
  if (keys[key].banned) {
    return res.status(403).json({ error: "key_banned" });
  }
  
  if (Date.now() > keys[key].expiry) {
    return res.status(403).json({ error: "key_expired" });
  }
  
  // Device lock (optional - like evucore does)
  if (keys[key].hwid && keys[key].hwid !== hwid) {
    return res.status(403).json({ error: "device_locked", message: "Key already used on another device" });
  }
  
  if (!keys[key].hwid && hwid) {
    keys[key].hwid = hwid;
    saveKeys(keys);
  }
  
  const daysLeft = Math.ceil((keys[key].expiry - Date.now()) / (24*60*60*1000));
  
  res.json({
    success: true,
    days: daysLeft,
    keyExpiresAt: new Date(keys[key].expiry).toISOString(),
    valid: true
  });
});

// GET ALL KEYS - for admin panel
app.get('/api/keys', (req, res) => {
  res.json(loadKeys());
});

// BAN / UNBAN
app.post('/api/ban', (req, res) => {
  const keys = loadKeys();
  if (keys[req.body.key]) {
    keys[req.body.key].banned = !keys[req.body.key].banned;
    saveKeys(keys);
  }
  res.json({ success: true });
});

// DELETE
app.post('/api/delete', (req, res) => {
  const keys = loadKeys();
  delete keys[req.body.key];
  saveKeys(keys);
  res.json({ success: true });
});

// ==========================================
// NEW: FILES API FOR YOUR APP DASHBOARD
// ==========================================

// GET FILES - App dashboard calls this
app.get('/api/v1/files', (req, res) => {
  const files = loadFiles();
  res.json({ files: files });
});

// UPLOAD FILE - Hidden Admin in app calls this
app.post('/api/v1/files', (req, res) => {
  const { title, desc, adminPassword } = req.body;
  
  if (adminPassword !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "wrong_admin_password" });
  }
  
  if (!title) {
    return res.status(400).json({ error: "title_required" });
  }
  
  const files = loadFiles();
  const newFile = {
    id: Date.now(),
    title: title,
    desc: desc || "",
    date: new Date().toLocaleString()
  };
  
  files.unshift(newFile); // new files on top
  saveFiles(files);
  
  console.log(`File uploaded: ${title}`);
  res.json({ success: true, file: newFile });
});

// CLEAR ALL FILES - Hidden Admin clear button
app.delete('/api/v1/files/clear', (req, res) => {
  const { adminPassword } = req.body;
  
  if (adminPassword !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "wrong_admin_password" });
  }
  
  saveFiles([]);
  console.log("All files cleared");
  res.json({ success: true });
});

// For compatibility with POST clear too
app.post('/api/v1/files/clear', (req, res) => {
  const { adminPassword } = req.body;
  if (adminPassword !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "wrong_admin_password" });
  }
  saveFiles([]);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Auth server running on port ${PORT}`);
  console.log(`✅ Files API ready at /api/v1/files`);
});