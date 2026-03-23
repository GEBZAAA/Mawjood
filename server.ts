import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set!');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://GEBALY:Omar%40123@gebaly.h42f6t1.mongodb.net/mawjood?appName=GEBALY';

let db: any;

async function connectDB() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db('mawjood');
  console.log('Connected to MongoDB');
  const users = db.collection('users');
  const defaultUsers = [
    { username: 'Omar12', password: bcrypt.hashSync('1234', 10), role: 'MANAGER' },
    { username: 'Ahmed11', password: bcrypt.hashSync('1234', 10), role: 'MANAGER' }
  ];
  for (const u of defaultUsers) {
    const exists = await users.findOne({ username: u.username });
    if (!exists) await users.insertOne(u);
  }
}

const sanitize = (str: any, maxLength = 500): string => {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
};

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://mawjood.vercel.app',
    'https://mawjood-git-main-gebzaaas-projects.vercel.app'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use((req, res, next) => { console.log(`[REQUEST] ${req.method} ${req.path}`); next(); });

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { message: 'Too many login attempts. Try again in 15 minutes.' } });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { message: 'Too many accounts created. Try again later.' } });
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, message: { message: 'Too many requests. Please slow down.' } });
const searchLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { message: 'Too many search requests.' } });

app.use(generalLimiter);

const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user; next();
  });
};

const checkBan = async (email: string, phoneNumber: string) => {
  const ban = await db.collection('banned').findOne({ $or: [{ email }, { phoneNumber }] });
  if (!ban) return null;
  const isExpired = ban.banExpires !== 'PERMANENT' && new Date(ban.banExpires) < new Date();
  return isExpired ? null : ban;
};

const toId = (doc: any) => doc ? { ...doc, id: doc._id?.toString(), _id: undefined } : null;

app.get('/api/health', (req, res) => res.json({ status: 'ok', mode: process.env.NODE_ENV || 'development' }));

// Login
app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const username = sanitize(req.body.username, 100);
    const password = sanitize(req.body.password, 200);
    const { isAdmin } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
    const user = await db.collection('users').findOne({ $or: [{ username }, { email: username }, { phoneNumber: username }] });
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ message: 'Invalid credentials' });
    const ban = await checkBan(user.email, user.phoneNumber);
    if (ban) return res.status(403).json({ message: 'Your account has been banned.', reason: ban.reason, expires: ban.banExpires });
    const isUserAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
    if (isAdmin && !isUserAdmin) return res.status(401).json({ message: 'Invalid credentials' });
    if (!isAdmin && isUserAdmin) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { username: user.username, role: user.role, fullName: user.fullName, email: user.email, passportNumber: user.passportNumber, phoneNumber: user.phoneNumber, gender: user.gender, nationality: user.nationality, dob: user.dob } });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

// Signup
app.post('/api/signup', signupLimiter, async (req, res) => {
  try {
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
    const ban = await checkBan(email, phoneNumber);
    if (ban) return res.status(403).json({ message: 'This email or phone number is banned.', reason: ban.reason });
    const existing = await db.collection('users').findOne({ $or: [{ username }, ...(passportNumber ? [{ passportNumber }] : [])] });
    if (existing) return res.status(400).json({ message: 'User already exists' });
    const newUser = { username: username || passportNumber, password: bcrypt.hashSync(password, 10), role: 'USER', fullName, email, passportNumber, phoneNumber, gender, nationality, dob };
    await db.collection('users').insertOne(newUser);
    const token = jwt.sign({ username: newUser.username, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ token, user: { username: newUser.username, role: newUser.role, fullName, email, passportNumber, phoneNumber, gender, nationality, dob } });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

// Admin accounts
app.post('/api/mgmt/accounts', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
    const username = sanitize(req.body.username, 50);
    const password = sanitize(req.body.password, 200);
    const { role } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
    if (await db.collection('users').findOne({ username })) return res.status(400).json({ message: 'Username already exists' });
    await db.collection('users').insertOne({ username, password: bcrypt.hashSync(password, 10), role: role || 'MANAGER' });
    res.status(201).json({ message: 'User created successfully' });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.get('/api/mgmt/accounts', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
    const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
    res.json(users.map(toId));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.put('/api/mgmt/accounts/:username', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
    const { username } = req.params;
    const user = await db.collection('users').findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'MANAGER' && username !== req.user.username) return res.status(403).json({ message: 'Cannot update other managers' });
    const { newUsername, newPassword, role, fullName, email, passportNumber, phoneNumber } = req.body;
    const update: any = {};
    if (newUsername && newUsername !== username) {
      if (await db.collection('users').findOne({ username: newUsername })) return res.status(400).json({ message: 'Username already exists' });
      update.username = sanitize(newUsername, 50);
    }
    if (newPassword) update.password = bcrypt.hashSync(sanitize(newPassword, 200), 10);
    if (role) update.role = role;
    if (fullName !== undefined) update.fullName = sanitize(fullName, 100);
    if (email !== undefined) update.email = sanitize(email, 100);
    if (passportNumber !== undefined) update.passportNumber = sanitize(passportNumber, 50);
    if (phoneNumber !== undefined) update.phoneNumber = sanitize(phoneNumber, 20);
    await db.collection('users').updateOne({ username }, { $set: update });
    res.json({ message: 'User updated successfully' });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.delete('/api/mgmt/accounts/:username', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
    const { username } = req.params;
    if (username === req.user.username) return res.status(400).json({ message: 'Cannot delete yourself' });
    const user = await db.collection('users').findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'MANAGER' && username !== req.user.username) return res.status(403).json({ message: 'Cannot delete other managers' });
    await db.collection('users').deleteOne({ username });
    res.json({ message: 'User deleted successfully' });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.post('/api/mgmt/delete-self', authenticateToken, async (req: any, res) => {
  try {
    const { password, confirmPassword } = req.body;
    if (!password || password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' });
    const user = await db.collection('users').findOne({ username: req.user.username });
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ message: 'Incorrect password' });
    await db.collection('users').deleteOne({ username: req.user.username });
    res.json({ message: 'Account deleted successfully' });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.put('/api/user/profile', authenticateToken, async (req: any, res) => {
  try {
    const { fullName, email, phoneNumber, gender, nationality, dob, currentPassword, newPassword } = req.body;
    const user = await db.collection('users').findOne({ username: req.user.username });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const update: any = {};
    if (newPassword) {
      if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password)) return res.status(401).json({ message: 'Incorrect current password' });
      if (newPassword.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
      update.password = bcrypt.hashSync(sanitize(newPassword, 200), 10);
    }
    if (fullName !== undefined) update.fullName = sanitize(fullName, 100);
    if (email !== undefined) update.email = sanitize(email, 100);
    if (phoneNumber !== undefined) update.phoneNumber = sanitize(phoneNumber, 20);
    if (gender !== undefined) update.gender = sanitize(gender, 20);
    if (nationality !== undefined) update.nationality = sanitize(nationality, 50);
    if (dob !== undefined) update.dob = sanitize(dob, 20);
    await db.collection('users').updateOne({ username: req.user.username }, { $set: update });
    const updated = await db.collection('users').findOne({ username: req.user.username }, { projection: { password: 0 } });
    res.json({ message: 'Profile updated successfully', user: toId(updated) });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.get('/api/mgmt/users/:username', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
    const user = await db.collection('users').findOne({ username: req.params.username }, { projection: { password: 0 } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(toId(user));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.post('/api/mgmt/ban', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
    const email = sanitize(req.body.email, 100);
    const phoneNumber = sanitize(req.body.phoneNumber, 20);
    const reason = sanitize(req.body.reason, 500);
    const { duration } = req.body;
    const banExpires = duration === 'PERMANENT' ? 'PERMANENT' : new Date(Date.now() + duration).toISOString();
    await db.collection('banned').insertOne({ email, phoneNumber, banExpires, reason, bannedAt: new Date().toISOString(), bannedBy: req.user.username });
    res.json({ message: 'User banned successfully' });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.get('/api/mgmt/banned', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
    const banned = await db.collection('banned').find({}).toArray();
    res.json(banned.map(toId));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.delete('/api/mgmt/ban/:id', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
    await db.collection('banned').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: 'User unbanned successfully' });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.get('/api/search', authenticateToken, searchLimiter, async (req, res) => {
  try {
    const { q, city } = req.query;
    let query: any = { status: 'APPROVED' };
    if (city) query.city = city;
    let items = await db.collection('items').find(query).toArray();
    if (q) {
      const queryWords = (q as string).toLowerCase().split(/\s+/).filter((w: string) => w.length > 1);
      items = items.filter((item: any) => {
        const fields = [item.name, item.description, item.nameEn || '', item.descriptionEn || '', item.foundLocation || '', item.foundLocationEn || ''].map((f: string) => (f || '').toLowerCase());
        return queryWords.some((word: string) => fields.some((field: string) => field.includes(word)));
      });
    }
    res.json(items.map(toId));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.get('/api/items', authenticateToken, async (req, res) => {
  try {
    const items = await db.collection('items').find({}).toArray();
    res.json(items.map(toId));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.post('/api/items', authenticateToken, async (req: any, res) => {
  try {
    const newItem = {
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
      submittedBy: req.user.username,
      createdAt: new Date().toISOString(),
      status: (req.user.role === 'ADMIN' || req.user.role === 'MANAGER') ? 'APPROVED' : 'PENDING'
    };
    const result = await db.collection('items').insertOne(newItem);
    await db.collection('notifications').insertOne({ userId: req.user.username, title: 'Thank You for Reporting', titleAr: 'شكراً لك على الإبلاغ', message: `Thank you for reporting the found item "${newItem.name}".`, messageAr: `شكراً لك على الإبلاغ عن العنصر "${newItem.name}".`, type: 'REPORT_THANK_YOU', createdAt: new Date().toISOString(), read: false });
    res.status(201).json(toId({ ...newItem, _id: result.insertedId }));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.put('/api/items/:id', authenticateToken, async (req: any, res) => {
  try {
    const item = await db.collection('items').findOne({ _id: new ObjectId(req.params.id) });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER' && item.submittedBy !== req.user.username) return res.status(403).json({ message: 'Not authorized' });
    const update = { ...req.body };
    delete update._id;
    delete update.submittedBy;
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') update.status = 'PENDING';
    if (update.status === 'APPROVED' && item.status !== 'APPROVED') {
      await db.collection('notifications').insertOne({ userId: item.submittedBy, title: 'Item Report Approved', titleAr: 'تمت الموافقة على بلاغ العنصر', message: `Your report for "${item.name}" has been approved.`, messageAr: `تمت الموافقة على بلاغك عن "${item.name}".`, type: 'REPORT_APPROVED', createdAt: new Date().toISOString(), read: false });
    }
    await db.collection('items').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
    const updated = await db.collection('items').findOne({ _id: new ObjectId(req.params.id) });
    res.json(toId(updated));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.delete('/api/items/:id', authenticateToken, async (req: any, res) => {
  try {
    const item = await db.collection('items').findOne({ _id: new ObjectId(req.params.id) });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (req.user.role === 'ADMIN' || req.user.role === 'MANAGER') {
      await db.collection('items').deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ message: 'Item deleted successfully' });
    } else if (item.submittedBy === req.user.username) {
      await db.collection('items').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status: 'PENDING_DELETION' } });
      res.json({ message: 'Deletion request sent' });
    } else { res.status(403).json({ message: 'Not authorized' }); }
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.get('/api/lost-items', authenticateToken, async (req, res) => {
  try {
    const items = await db.collection('lostItems').find({}).toArray();
    res.json(items.map(toId));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.post('/api/lost-items', authenticateToken, async (req: any, res) => {
  try {
    const newItem = {
      name: sanitize(req.body.name, 200),
      description: sanitize(req.body.description, 2000),
      city: sanitize(req.body.city, 50),
      location: sanitize(req.body.location, 200),
      date: sanitize(req.body.date, 20),
      imageUrl: req.body.imageUrl,
      userId: req.user.username,
      createdAt: new Date().toISOString(),
      status: 'PENDING'
    };
    const result = await db.collection('lostItems').insertOne(newItem);
    await db.collection('notifications').insertOne({ userId: req.user.username, title: 'Thank You for Reporting', titleAr: 'شكراً لك على الإبلاغ', message: `Thank you for reporting your lost item "${newItem.name}".`, messageAr: `شكراً لك على الإبلاغ عن عنصرك المفقود "${newItem.name}".`, type: 'REPORT_THANK_YOU', createdAt: new Date().toISOString(), read: false });
    res.status(201).json(toId({ ...newItem, _id: result.insertedId }));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.put('/api/lost-items/:id', authenticateToken, async (req: any, res) => {
  try {
    const item = await db.collection('lostItems').findOne({ _id: new ObjectId(req.params.id) });
    if (!item) return res.status(404).json({ message: 'Lost item not found' });
    if (item.userId !== req.user.username && req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Not authorized' });
    const update = { ...req.body }; delete update._id;
    await db.collection('lostItems').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
    const updated = await db.collection('lostItems').findOne({ _id: new ObjectId(req.params.id) });
    res.json(toId(updated));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.delete('/api/lost-items/:id', authenticateToken, async (req: any, res) => {
  try {
    const item = await db.collection('lostItems').findOne({ _id: new ObjectId(req.params.id) });
    if (!item) return res.status(404).json({ message: 'Lost item not found' });
    if (item.userId !== req.user.username && req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Not authorized' });
    await db.collection('lostItems').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: 'Lost item deleted successfully' });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const feedback = sanitize(req.body.feedback, 2000);
    const type = sanitize(req.body.type, 50);
    const lang = sanitize(req.body.lang, 10);
    const { timestamp } = req.body;
    let userFromToken = null;
    const token = req.headers['authorization']?.split(' ')[1];
    if (token) { try { const d: any = jwt.verify(token, JWT_SECRET); userFromToken = d.username; } catch (e) {} }
    await db.collection('feedbacks').insertOne({ content: feedback, type: type || 'GENERAL', lang, timestamp, read: false, submittedBy: sanitize(req.body.submittedBy || userFromToken || 'Anonymous', 50) });
    res.status(201).json({ message: 'Feedback received' });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.get('/api/feedback', authenticateToken, async (req, res) => {
  try {
    const feedbacks = await db.collection('feedbacks').find({}).sort({ timestamp: -1 }).toArray();
    res.json(feedbacks.map(toId));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.post('/api/feedback/mark-read', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (Array.isArray(ids) && ids.length > 0) {
      const objectIds = ids.map((id: string) => { try { return new ObjectId(id); } catch (e) { return null; } }).filter(Boolean);
      if (objectIds.length) await db.collection('feedbacks').updateMany({ _id: { $in: objectIds } }, { $set: { read: true } });
    } else {
      await db.collection('feedbacks').updateMany({}, { $set: { read: true } });
    }
    res.json({ message: 'Marked as read' });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.post('/api/claims', authenticateToken, async (req: any, res) => {
  try {
    const { itemId } = req.body;
    const existing = await db.collection('claims').findOne({ itemId, userId: req.user.username });
    if (existing) return res.status(400).json({ message: 'You have already submitted a claim for this item.' });
    const newClaim = {
      itemId: sanitize(itemId, 50),
      userId: req.user.username,
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
    const result = await db.collection('claims').insertOne(newClaim);
    res.status(201).json(toId({ ...newClaim, _id: result.insertedId }));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.get('/api/claims', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
    const claims = await db.collection('claims').find({}).toArray();
    res.json(claims.map(toId));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.put('/api/claims/:id', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Access denied' });
    const claim = await db.collection('claims').findOne({ _id: new ObjectId(req.params.id) });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
    const { status } = req.body;
    await db.collection('claims').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status } });
    if (status === 'APPROVED' && claim.status !== 'APPROVED') {
      await db.collection('notifications').insertOne({ userId: claim.userId, title: 'Claim Approved', titleAr: 'تمت الموافقة على المطالبة', message: `Your claim for item "${claim.itemName}" has been approved.`, messageAr: `تمت الموافقة على مطالبتك للعنصر "${claim.itemName}".`, type: 'CLAIM_APPROVED', createdAt: new Date().toISOString(), read: false });
    }
    const updated = await db.collection('claims').findOne({ _id: new ObjectId(req.params.id) });
    res.json(toId(updated));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.get('/api/notifications', authenticateToken, async (req: any, res) => {
  try {
    const notifs = await db.collection('notifications').find({ userId: req.user.username }).toArray();
    res.json(notifs.map(toId));
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req: any, res) => {
  try {
    await db.collection('notifications').updateOne({ _id: new ObjectId(req.params.id), userId: req.user.username }, { $set: { read: true } });
    res.json({ message: 'Marked as read' });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

app.post('/api/notifications', authenticateToken, async (req: any, res) => {
  try {
    const result = await db.collection('notifications').insertOne({
      userId: req.body.userId,
      title: sanitize(req.body.title, 200),
      titleAr: sanitize(req.body.titleAr, 200),
      message: sanitize(req.body.message, 500),
      messageAr: sanitize(req.body.messageAr, 500),
      type: sanitize(req.body.type, 50),
      lostItemId: req.body.lostItemId,
      foundItemId: req.body.foundItemId,
      createdAt: new Date().toISOString(),
      read: false
    });
    res.status(201).json({ id: result.insertedId.toString() });
  } catch (e: any) { res.status(500).json({ message: 'Internal server error' }); }
});

connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});
