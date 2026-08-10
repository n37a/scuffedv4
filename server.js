import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { readFile, writeFile } from "fs/promises";

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesFile = path.join(__dirname, "messages.json");
const usersFile = path.join(__dirname, "users.json");
const passFile = path.join(__dirname, "pass.json");

const activeUsers = new Map(); // username => lastSeen timestamp

// Block access to pass.json
app.get('/pass.json', (req, res) => {
  res.redirect('/');
});

// Block access to messages.json
app.get('/messages.json', (req, res) => {
  res.redirect('/');
});

// Block access to users.json
app.get('/users.json', (req, res) => {
  res.redirect('/');
});

app.use(express.json());
app.use(express.static(__dirname));

// Gate check API
app.post("/api/check-pass", async (req, res) => {
  const { code } = req.body;
  try {
    const data = JSON.parse(await readFile(passFile, "utf8"));
    res.json({ success: code === data.code });
  } catch {
    res.status(500).json({ success: false });
  }
});

// Register username
app.post("/api/register-username", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ success: false, message: "Username required" });
  try {
    let users = [];
    try {
      const data = await readFile(usersFile, "utf8");
      users = JSON.parse(data);
    } catch {}
    if (users.includes(username)) {
      return res.json({ success: false, message: "Username taken" });
    }
    users.push(username);
    await writeFile(usersFile, JSON.stringify(users, null, 2));
    activeUsers.set(username, Date.now());
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

// Ping to update presence
app.post("/api/ping", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ success: false });
  try {
    const data = await readFile(usersFile, "utf8");
    const users = JSON.parse(data);
    if (users.includes(username)) {
      activeUsers.set(username, Date.now());
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch {
    res.status(500).json({ success: false });
  }
});

// Check if user exists
app.post("/api/check-user", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ exists: false });
  try {
    const data = await readFile(usersFile, "utf8");
    const users = JSON.parse(data);
    res.json({ exists: users.includes(username) });
  } catch {
    res.json({ exists: false });
  }
});

// Get online users
app.get("/api/online-users", (req, res) => {
  const now = Date.now();
  const online = [];
  activeUsers.forEach((lastSeen, username) => {
    if (now - lastSeen < 60000) { // 1 minute
      online.push(username);
    }
  });
  res.json(online);
});

// Messages API
app.get("/api/messages", async (req, res) => {
  try {
    const data = await readFile(messagesFile, "utf8");
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});
app.post("/api/messages", async (req, res) => {
  const { username, message, to } = req.body;
  if (!username || !message) return res.status(400).json({ success: false });
  try {
    const userData = await readFile(usersFile, "utf8");
    const users = JSON.parse(userData);
    if (!users.includes(username)) {
      return res.status(403).json({ success: false, message: "Invalid username" });
    }
    if (to && !users.includes(to)) {
      return res.status(403).json({ success: false, message: "Recipient does not exist" });
    }
    activeUsers.set(username, Date.now());
    const data = await readFile(messagesFile, "utf8");
    let messages = [];
    try { messages = JSON.parse(data); } catch {}
    messages.push({ username, message, timestamp: new Date().toISOString(), to });
    await writeFile(messagesFile, JSON.stringify(messages, null, 2));
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

// Pages
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/chat.html", (req, res) => res.sendFile(path.join(__dirname, "chat.html")));

app.listen(PORT, () => {
  console.log(`Chat app running on http://localhost:${PORT}`);
});