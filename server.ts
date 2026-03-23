import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 🔐 JWT Secret - MUST be set in environment variables
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set!');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const DB_FILE = path.join(__dirname, 'db.json');

// --- Database Helper Functions ---
const initDB = () => {
  let data: any = { users: [], items: [], feedbacks: [], claims: [], bannedUsers: [], lostItems: [], notifications: [] };
  if (fs.existsSync(DB_FILE)) {
    try { data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
  }
  const defaultUsers = [
    { username: 'Omar12', password: bcrypt.hashSync('1234', 10), role: 'MANAGER' },
    { username: 'Ahmed11', password: bcrypt.hashSync('1234', 10), role: 'MANAGER' }
  ];
  let changed = false;
  for (const u of defaultUsers) {
    if (!data.users || !data.users.find((x: any) => x.username === u.username)) {
      data.users = data.users || [];
      data.users.push(u);
      changed = true;
    }
  }
  if (!data.items) { data.items = []; changed = true; }
  if (!data.feedbacks) { data.feedbacks = []; changed = true; }
  if (!data.claims) { data.claims = []; changed = true; }
  if (!data.bannedUsers) { data.bannedUsers = []; changed = true; }
  if (!data.lostItems) { data.lostItems = []; changed = true; }
  if (!data.notifications) { data.notifications = []; changed = true; }
  if (changed) fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

const readDB = () => {
  try {
    if (!fs.existsSync(DB_FILE)) initDB();
    const data = fs.readFileSync(DB_FILE, 'utf8');
    if (!data || data.trim() === '') { initDB(); return readDB(); }
    const db = JSON.parse(data);
    return {
      users: db.users || [],
      items: db.items || [],
      feedbacks: db.feedbacks || [],
      claims: db.claims || [],
      lostItems: db.lostItems || [],
      notifications: db.notifications || [],
      bannedUsers: db.bannedUsers || []
    };
  } catch (error) {
    console.error('Error reading database:', error);
    return { users: [], items: [], feedbacks: [], claims: [], lostItems: [], notifications: [], bannedUsers: [] };
  }
};

const writeDB = (data: any) => {
  const TEMP_FILE = `${DB_FILE}.tmp`;
  try {
    const dbToWrite = {
      users: data.users || [],
      items: data.items || [],
      feedbacks: data.feedbacks || [],
      claims: data.claims || [],
      lostItems: data.lostItems || [],
      notifications: data.notifications || [],
      bannedUsers: data.bannedUsers || []
    };
    fs.writeFileSync(TEMP_FILE, JSON.stringify(dbToWrite, null, 2));
    fs.renameSync(TEMP_FILE, DB_FILE);
  } catch (error) {
    console.error('Error writing to database:', error);
    if (fs.existsSync(TEMP_FILE)) { try { fs.unlinkSync(TEMP_FILE); } catch (e) {} }
  }
};

// Input sanitization helper
const sanitize = (str: any, maxLength = 500): string => {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
};

initDB();

// --- CORS: Only allow specific origins ---
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://mawjood.vercel.app',
    'https://mawjood-git-main-gebzaaas-projects.vercel.app'
  ],
  credentials: true
}));

// --- Reduced body limit to prevent DoS ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

// --- Rate Limiters ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 login attempts per 15 mins per IP
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 signups per hour per IP
  message: { message: 'Too many accounts created. Please try again later.' },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // max 100 requests per minute per IP
  message: { message: 'Too many requests. Please slow down.' },
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: 'Too many search requests. Please slow down.' },
});

app.use(generalLimiter);

// --- JWT Middleware ---
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// --- Helper: check if user is banned ---
const checkBan = (db: any, email: string, phoneNumber: string) => {
  const ban = (db.bannedUsers || []).find((b: any) =>
    (email && b.email === email) || (phoneNumber && b.phoneNumber === phoneNumber)
  );
  if (!ban) return null;
  const isExpired = ban.banExpires !== 'PERMANENT' && new Date(ban.banExpires) < new Date();
  return isExpired ? null : ban;
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: process.env.NODE_ENV || 'development' });
});

// Login - with rate limiting
app.post('/api/login', loginLimiter, (req, res) => {
  const username = sanitize(req.body.username, 100);
  const password = sanitize(req.body.password, 200);
  const { isAdmin } = req.body;

  if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });

  const db = readDB();
  const user = db.users.find((u: any) =>
    u.username === username || (u.email && u.email === username) || (u.phoneNumber && u.phoneNumber === username)
  );

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const ban = checkBan(db, user.email, user.phoneNumber);
  if (ban) return res.status(403).json({ message: 'Your account has been banned.', reason: ban.reason, expires: ban.banExpires });

  const isUserAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
  if (isAdmin && !isUserAdmin) return res.status(401).json({ message: 'Invalid credentials' });
  if (!isAdmin && isUserAdmin) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { username: user.username, role: user.role, fullName: user.fullName, email: user.email, passportNumber: user.passportNumber, phoneNumber: user.phoneNumber, gender: user.gender, nationality: user.nationality, dob: user.dob } });
});

// Signup - with rate limiting
app.post('/api/signup', signupLimiter, (req, res) => {
  const username = sanitize(req.body.username, 50);
  const password = sanitize(req.body.password, 200);
  const fullName = sanitize(req.body.fullName, 100);
  const email = sanitize(req.body.email, 100);
  const passportNumber = sanitize(req.body.passportNumber, 50);
  const phoneNumber = sanitize(req.body.phoneNumber, 20);
  const gender = sanitize(req.body.gender, 20);
  const nationality = sanitize(req.body.nationality, 50);
  const dob = sanitize(req.body.dob, 20);

  if (!password || password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });

  const db = readDB();
  const ban = checkBan(db, email, phoneNumber);
  if (ban) return res.status(403).json({ message: 'This email or phone number is banned.', reason: ban.reason });

  if (db.users.find((u: any) => u.username === username || (passportNumber && u.passportNumber === passportNumber))) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const newUser = { username: username || passportNumber, password: bcrypt.hashSync(password, 10), role: 'USER', fullName, email, passportNumber, phoneNumber, gender, nationality, dob };
  db.users.push(newUser);
  writeDB(db);

  const token = jwt.sign({ username: newUser.username, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });
  res.status(201).json({ token, user: { username: newUser.username, role: newUser.role, fullName, email, passportNumber, phoneNumber, gender, nationality, dob } });
});

// Admin: create account
app.post('/api/mgmt/accounts', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
    const username = sanitize(req.body.username, 50);
    const password = sanitize(req.body.password, 200);
    const { role } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
    const db = readDB();
    if (db.users.find((u: any) => u.username === username)) return res.status(400).json({ message: 'Username already exists' });
    db.users.push({ username, password: bcrypt.hashSync(password, 10), role: role || 'MANAGER' });
    writeDB(db);
    res.status(201).json({ message: 'User created successfully' });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

// Admin: get accounts
app.get('/api/mgmt/accounts', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
  const db = readDB();
  res.json(db.users.map(({ password, ...u }: any) => u));
});

// Admin: update account
app.put('/api/mgmt/accounts/:username', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
  const { username } = req.params;
  const { newUsername, newPassword, role, fullName, email, passportNumber, phoneNumber } = req.body;
  const db = readDB();
  const userIndex = db.users.findIndex((u: any) => u.username === username);
  if (userIndex === -1) return res.status(404).json({ message: 'User not found' });
  if (db.users[userIndex].role === 'MANAGER' && username !== req.user.username) return res.status(403).json({ message: 'Cannot update other managers' });
  if (newUsername && newUsername !== username) {
    if (db.users.find((u: any) => u.username === newUsername)) return res.status(400).json({ message: 'Username already exists' });
    db.users[userIndex].username = sanitize(newUsername, 50);
  }
  if (newPassword) db.users[userIndex].password = bcrypt.hashSync(sanitize(newPassword, 200), 10);
  if (role) db.users[userIndex].role = role;
  if (fullName !== undefined) db.users[userIndex].fullName = sanitize(fullName, 100);
  if (email !== undefined) db.users[userIndex].email = sanitize(email, 100);
  if (passportNumber !== undefined) db.users[userIndex].passportNumber = sanitize(passportNumber, 50);
  if (phoneNumber !== undefined) db.users[userIndex].phoneNumber = sanitize(phoneNumber, 20);
  writeDB(db);
  res.json({ message: 'User updated successfully' });
});

// Admin: delete account
app.delete('/api/mgmt/accounts/:username', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
  const { username } = req.params;
  if (username === req.user.username) return res.status(400).json({ message: 'Cannot delete yourself' });
  const db = readDB();
  const userToDelete = db.users.find((u: any) => u.username === username);
  if (!userToDelete) return res.status(404).json({ message: 'User not found' });
  if (userToDelete.role === 'MANAGER' && username !== req.user.username) return res.status(403).json({ message: 'Cannot delete other managers' });
  const index = db.users.findIndex((u: any) => u.username === username);
  db.users.splice(index, 1);
  writeDB(db);
  res.json({ message: 'User deleted successfully' });
});

// Delete self
app.post('/api/mgmt/delete-self', authenticateToken, (req: any, res) => {
  const { password, confirmPassword } = req.body;
  if (!password || password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' });
  const db = readDB();
  const user = db.users.find((u: any) => u.username === req.user.username);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ message: 'Incorrect password' });
  const index = db.users.findIndex((u: any) => u.username === req.user.username);
  db.users.splice(index, 1);
  writeDB(db);
  res.json({ message: 'Account deleted successfully' });
});

// Update profile
app.put('/api/user/profile', authenticateToken, (req: any, res) => {
  const { fullName, email, phoneNumber, gender, nationality, dob, currentPassword, newPassword } = req.body;
  const db = readDB();
  const userIndex = db.users.findIndex((u: any) => u.username === req.user.username);
  if (userIndex === -1) return res.status(404).json({ message: 'User not found' });
  const user = db.users[userIndex];
  if (newPassword) {
    if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password)) return res.status(401).json({ message: 'Incorrect current password' });
    if (newPassword.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    db.users[userIndex].password = bcrypt.hashSync(sanitize(newPassword, 200), 10);
  }
  if (fullName !== undefined) db.users[userIndex].fullName = sanitize(fullName, 100);
  if (email !== undefined) db.users[userIndex].email = sanitize(email, 100);
  if (phoneNumber !== undefined) db.users[userIndex].phoneNumber = sanitize(phoneNumber, 20);
  if (gender !== undefined) db.users[userIndex].gender = sanitize(gender, 20);
  if (nationality !== undefined) db.users[userIndex].nationality = sanitize(nationality, 50);
  if (dob !== undefined) db.users[userIndex].dob = sanitize(dob, 20);
  writeDB(db);
  const { password, ...updatedUser } = db.users[userIndex];
  res.json({ message: 'Profile updated successfully', user: updatedUser });
});

// Get user info
app.get('/api/mgmt/users/:username', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
  const db = readDB();
  const user = db.users.find((u: any) => u.username === req.params.username);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { password, ...userInfo } = user;
  res.json(userInfo);
});

// Ban user
app.post('/api/mgmt/ban', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
  const email = sanitize(req.body.email, 100);
  const phoneNumber = sanitize(req.body.phoneNumber, 20);
  const reason = sanitize(req.body.reason, 500);
  const { duration } = req.body;
  const db = readDB();
  const banExpires = duration === 'PERMANENT' ? 'PERMANENT' : new Date(Date.now() + duration).toISOString();
  db.bannedUsers.push({ id: `BAN-${Date.now()}`, email, phoneNumber, banExpires, reason, bannedAt: new Date().toISOString(), bannedBy: req.user.username });
  writeDB(db);
  res.json({ message: 'User banned successfully' });
});

// Get banned users
app.get('/api/mgmt/banned', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
  const db = readDB();
  res.json(db.bannedUsers || []);
});

// Unban user
app.delete('/api/mgmt/ban/:id', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
  const db = readDB();
  const index = db.bannedUsers.findIndex((b: any) => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Ban record not found' });
  db.bannedUsers.splice(index, 1);
  writeDB(db);
  res.json({ message: 'User unbanned successfully' });
});

// Search items - with rate limiting and auth required
app.get('/api/search', authenticateToken, searchLimiter, (req, res) => {
  const { q, city } = req.query;
  const db = readDB();
  let items = db.items.filter((item: any) => item.status === 'APPROVED');
  if (city) items = items.filter((item: any) => item.city === city);
  if (q) {
    const queryWords = (q as string).toLowerCase().split(/\s+/).filter((w: string) => w.length > 1);
    items = items.filter((item: any) => {
      const searchFields = [item.name, item.description, item.nameEn || '', item.descriptionEn || '', item.foundLocation, item.foundLocationEn || ''].map((f: string) => (f || '').toLowerCase());
      return queryWords.some((word: string) => searchFields.some((field: string) => field.includes(word)));
    });
  }
  res.json(items);
});

// Get items - require auth
app.get('/api/items', authenticateToken, (req, res) => {
  const db = readDB();
  res.json(db.items);
});

// Feedback
app.post('/api/feedback', (req, res) => {
  const feedback = sanitize(req.body.feedback, 2000);
  const type = sanitize(req.body.type, 50);
  const lang = sanitize(req.body.lang, 10);
  const { timestamp, submittedBy } = req.body;
  const db = readDB();
  let userFromToken = null;
  const token = req.headers['authorization']?.split(' ')[1];
  if (token) { try { const d: any = jwt.verify(token, JWT_SECRET); userFromToken = d.username; } catch (e) {} }
  db.feedbacks.push({ id: `FB-${Date.now()}`, content: feedback, type: type || 'GENERAL', lang, timestamp, read: false, submittedBy: sanitize(submittedBy || userFromToken || 'Anonymous', 50) });
  writeDB(db);
  res.status(201).json({ message: 'Feedback received' });
});

app.get('/api/feedback', authenticateToken, (req, res) => {
  const db = readDB();
  res.json([...db.feedbacks].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
});

app.post('/api/feedback/mark-read', authenticateToken, (req, res) => {
  try {
    const { ids } = req.body;
    const db = readDB();
    if (Array.isArray(ids)) { db.feedbacks.forEach((fb: any) => { if (ids.includes(fb.id)) fb.read = true; }); }
    else { db.feedbacks.forEach((fb: any) => fb.read = true); }
    writeDB(db);
    res.json({ message: 'Marked as read' });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

// Claims
app.post('/api/claims', authenticateToken, (req: any, res) => {
  const { itemId } = req.body;
  const db = readDB();
  const existingClaim = db.claims?.find((c: any) => c.itemId === itemId && c.userId === req.user.username);
  if (existingClaim) return res.status(400).json({ message: 'You have already submitted a claim for this item.' });
  const newClaim = {
    id: `CLAIM-${Date.now()}`,
    itemId: sanitize(itemId, 50),
    userId: req.user.username, // Always from token, never from body
    userName: sanitize(req.body.userFullName, 100),
    userPassport: sanitize(req.body.userPassport, 50),
    userPhone: sanitize(req.body.userPhone, 20),
    userEmail: sanitize(req.body.userEmail, 100),
    itemName: sanitize(req.body.itemName, 200),
    itemImage: req.body.itemImage,
    description: sanitize(req.body.description, 2000),
    lostDate: sanitize(req.body.lostDate, 20),
    lostTime: sanitize(req.body.lostTime, 20),
    status: 'PENDING',
    timestamp: new Date().toISOString()
  };
  db.claims = db.claims || [];
  db.claims.push(newClaim);
  writeDB(db);
  res.status(201).json(newClaim);
});

app.get('/api/claims', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
  const db = readDB();
  res.json(db.claims || []);
});

app.put('/api/claims/:id', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
  const { id } = req.params;
  const { status } = req.body;
  const db = readDB();
  const index = db.claims.findIndex((c: any) => c.id === id);
  if (index === -1) return res.status(404).json({ message: 'Claim not found' });
  const oldStatus = db.claims[index].status;
  db.claims[index].status = status;
  if (status === 'APPROVED' && oldStatus !== 'APPROVED') {
    const claim = db.claims[index];
    db.notifications = db.notifications || [];
    db.notifications.push({ id: `NOTIF-${Date.now()}`, userId: claim.userId, title: 'Claim Approved', titleAr: 'تمت الموافقة على المطالبة', message: `Your claim for item "${claim.itemName}" has been approved.`, messageAr: `تمت الموافقة على مطالبتك للعنصر "${claim.itemName}".`, type: 'CLAIM_APPROVED', createdAt: new Date().toISOString(), read: false });
  }
  writeDB(db);
  res.json(db.claims[index]);
});

// Lost items
app.get('/api/lost-items', authenticateToken, (req, res) => {
  const db = readDB();
  res.json(db.lostItems || []);
});

app.post('/api/lost-items', authenticateToken, (req: any, res) => {
  const db = readDB();
  if (!db.lostItems) db.lostItems = [];
  const newItem = {
    id: `LI-${Date.now()}`,
    name: sanitize(req.body.name, 200),
    description: sanitize(req.body.description, 2000),
    city: sanitize(req.body.city, 50),
    location: sanitize(req.body.location, 200),
    date: sanitize(req.body.date, 20),
    imageUrl: req.body.imageUrl,
    userId: req.user.username, // Always from token
    createdAt: new Date().toISOString(),
    status: 'PENDING'
  };
  db.lostItems.push(newItem);
  db.notifications = db.notifications || [];
  db.notifications.push({ id: `NOTIF-${Date.now()}-TYL`, userId: req.user.username, title: 'Thank You for Reporting', titleAr: 'شكراً لك على الإبلاغ', message: `Thank you for reporting your lost item "${newItem.name}".`, messageAr: `شكراً لك على الإبلاغ عن عنصرك المفقود "${newItem.name}".`, type: 'REPORT_THANK_YOU', createdAt: new Date().toISOString(), read: false });
  writeDB(db);
  res.status(201).json(newItem);
});

app.put('/api/lost-items/:id', authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const db = readDB();
  if (!db.lostItems) db.lostItems = [];
  const index = db.lostItems.findIndex((i: any) => i.id === id);
  if (index === -1) return res.status(404).json({ message: 'Lost item not found' });
  if (db.lostItems[index].userId !== req.user.username && req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  db.lostItems[index] = { ...db.lostItems[index], ...req.body };
  writeDB(db);
  res.json(db.lostItems[index]);
});

app.delete('/api/lost-items/:id', authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const db = readDB();
  if (!db.lostItems) db.lostItems = [];
  const index = db.lostItems.findIndex((i: any) => i.id === id);
  if (index === -1) return res.status(404).json({ message: 'Lost item not found' });
  if (db.lostItems[index].userId !== req.user.username && req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  db.lostItems.splice(index, 1);
  writeDB(db);
  res.json({ message: 'Lost item deleted successfully' });
});

// Notifications - userId always from token
app.get('/api/notifications', authenticateToken, (req: any, res) => {
  const db = readDB();
  res.json((db.notifications || []).filter((n: any) => n.userId === req.user.username));
});

app.put('/api/notifications/:id/read', authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const db = readDB();
  if (!db.notifications) db.notifications = [];
  const notification = db.notifications.find((n: any) => n.id === id && n.userId === req.user.username);
  if (notification) { notification.read = true; writeDB(db); res.json(notification); }
  else res.status(404).json({ message: 'Notification not found' });
});

app.post('/api/notifications', authenticateToken, (req: any, res) => {
  const db = readDB();
  if (!db.notifications) db.notifications = [];
  const newNotification = {
    id: `NOTIF-${Date.now()}`,
    userId: req.body.userId, // allowed here for system notifications from frontend
    title: sanitize(req.body.title, 200),
    titleAr: sanitize(req.body.titleAr, 200),
    message: sanitize(req.body.message, 500),
    messageAr: sanitize(req.body.messageAr, 500),
    type: sanitize(req.body.type, 50),
    lostItemId: req.body.lostItemId,
    foundItemId: req.body.foundItemId,
    createdAt: new Date().toISOString(),
    read: false
  };
  db.notifications.push(newNotification);
  writeDB(db);
  res.status(201).json(newNotification);
});

// Items
app.post('/api/items', authenticateToken, (req: any, res) => {
  const db = readDB();
  const newItem = {
    id: `ITEM-${Date.now()}`,
    name: sanitize(req.body.name, 200),
    description: sanitize(req.body.description, 2000),
    city: sanitize(req.body.city, 50),
    foundLocation: sanitize(req.body.foundLocation, 200),
    foundLocationEn: sanitize(req.body.foundLocationEn, 200),
    category: sanitize(req.body.category, 50),
    imageUrl: req.body.imageUrl,
    imageUrls: req.body.imageUrls,
    nameEn: sanitize(req.body.nameEn, 200),
    descriptionEn: sanitize(req.body.descriptionEn, 2000),
    submittedBy: req.user.username, // Always from token
    createdAt: new Date().toISOString(),
    status: (req.user.role === 'ADMIN' || req.user.role === 'MANAGER') ? 'APPROVED' : 'PENDING'
  };
  db.items.push(newItem);
  db.notifications = db.notifications || [];
  db.notifications.push({ id: `NOTIF-${Date.now()}-TY`, userId: req.user.username, title: 'Thank You for Reporting', titleAr: 'شكراً لك على الإبلاغ', message: `Thank you for reporting the found item "${newItem.name}".`, messageAr: `شكراً لك على الإبلاغ عن العنصر "${newItem.name}".`, type: 'REPORT_THANK_YOU', createdAt: new Date().toISOString(), read: false });
  writeDB(db);
  res.status(201).json(newItem);
});

app.put('/api/items/:id', authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const db = readDB();
  const index = db.items.findIndex((i: any) => i.id === id);
  if (index === -1) return res.status(404).json({ message: 'Item not found' });
  const item = db.items[index];
  const oldStatus = item.status;
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER' && item.submittedBy !== req.user.username) return res.status(403).json({ message: 'Not authorized' });
  const updatedItem = { ...item, ...req.body, id: item.id, submittedBy: item.submittedBy };
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') updatedItem.status = 'PENDING';
  if (updatedItem.status === 'APPROVED' && oldStatus !== 'APPROVED') {
    db.notifications = db.notifications || [];
    db.notifications.push({ id: `NOTIF-${Date.now()}-APP`, userId: item.submittedBy, title: 'Item Report Approved', titleAr: 'تمت الموافقة على بلاغ العنصر', message: `Your report for "${item.name}" has been approved.`, messageAr: `تمت الموافقة على بلاغك عن "${item.name}".`, type: 'REPORT_APPROVED', createdAt: new Date().toISOString(), read: false });
  }
  db.items[index] = updatedItem;
  writeDB(db);
  res.json(updatedItem);
});

app.delete('/api/items/:id', authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const db = readDB();
  const index = db.items.findIndex((i: any) => i.id === id);
  if (index === -1) return res.status(404).json({ message: 'Item not found' });
  const item = db.items[index];
  if (req.user.role === 'ADMIN' || req.user.role === 'MANAGER') {
    db.items.splice(index, 1); writeDB(db); res.json({ message: 'Item deleted successfully' });
  } else if (item.submittedBy === req.user.username) {
    db.items[index].status = 'PENDING_DELETION'; writeDB(db); res.json({ message: 'Deletion request sent' });
  } else { res.status(403).json({ message: 'Not authorized' }); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
