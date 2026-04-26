import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'haramain-secret-key-2026';
const DB_FILE = path.join(__dirname, 'db.json');

// --- Database Helper Functions ---
const initDB = () => {
  let data: any = { users: [], items: [], feedbacks: [], claims: [], banned: [], lostItems: [], notifications: [], bannedUsers: [] };
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
  if (!data.banned) { data.banned = []; changed = true; }
  if (changed) fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

const readDB = () => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      initDB();
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    if (!data || data.trim() === '') {
      console.warn('Database file is empty, initializing...');
      initDB();
      return readDB(); // Retry after initialization
    }
    const db = JSON.parse(data);
    // Ensure all required keys exist
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
    console.error('Error reading database, attempting repair:', error);
    initDB(); // Attempt to repair by overwriting with defaults
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return { users: [], items: [], feedbacks: [], claims: [], lostItems: [], notifications: [], bannedUsers: [] };
    }
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
    // Atomic write: write to temp file then rename
    fs.writeFileSync(TEMP_FILE, JSON.stringify(dbToWrite, null, 2));
    fs.renameSync(TEMP_FILE, DB_FILE);
  } catch (error) {
    console.error('Error writing to database:', error);
    if (fs.existsSync(TEMP_FILE)) {
      try { fs.unlinkSync(TEMP_FILE); } catch (e) {}
    }
  }
};

// Initialize DB on startup
initDB();

// --- Middleware ---
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Add a simple request logger
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log(`[AUTH ERROR] No token provided for ${req.method} ${req.path}`);
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.log(`[AUTH ERROR] Invalid token for ${req.method} ${req.path}: ${err.message}`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(403).json({ message: 'Invalid or expired token', error: err.message });
    }
    console.log(`[AUTH SUCCESS] User: ${user.username} for ${req.method} ${req.path}`);
    req.user = user;
    next();
  });
};

// --- API Routes ---
console.log(`[SERVER] Starting in ${process.env.NODE_ENV || 'development'} mode`);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: process.env.NODE_ENV || 'development' });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password, isAdmin } = req.body;
  const db = readDB();
  
  // Find user by username, email, or phone number
  const user = db.users.find((u: any) => 
    u.username === username || 
    (u.email && u.email === username) || 
    (u.phoneNumber && u.phoneNumber === username)
  );

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isPasswordMatch = bcrypt.compareSync(password, user.password);

  if (isPasswordMatch) {
    // Check if banned
    const ban = (db.bannedUsers || []).find((b: any) => 
      (user.email && b.email === user.email) || 
      (user.phoneNumber && b.phoneNumber === user.phoneNumber)
    );
    
    if (ban) {
      const isPermanent = ban.banExpires === 'PERMANENT';
      const isExpired = !isPermanent && new Date(ban.banExpires) < new Date();
      
      if (!isExpired) {
        return res.status(403).json({ 
          message: 'Your account has been banned.', 
          reason: ban.reason,
          expires: ban.banExpires
        });
      }
    }

    // Role validation based on portal
    const isUserAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
    
    if (isAdmin && !isUserAdmin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    if (!isAdmin && isUserAdmin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ 
      token, 
      user: { 
        username: user.username, 
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        passportNumber: user.passportNumber,
        phoneNumber: user.phoneNumber,
        gender: user.gender,
        nationality: user.nationality,
        dob: user.dob
      } 
    });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Signup
app.post('/api/signup', (req, res) => {
  const { username, password, fullName, email, passportNumber, phoneNumber, gender, nationality, dob } = req.body;
  const db = readDB();
  
  // Check if banned
  const ban = (db.bannedUsers || []).find((b: any) => 
    (email && b.email === email) || 
    (phoneNumber && b.phoneNumber === phoneNumber)
  );
  
  if (ban) {
    const isPermanent = ban.banExpires === 'PERMANENT';
    const isExpired = !isPermanent && new Date(ban.banExpires) < new Date();
    
    if (!isExpired) {
      return res.status(403).json({ 
        message: 'This email or phone number is banned.', 
        reason: ban.reason,
        expires: ban.banExpires
      });
    }
  }

  if (db.users.find((u: any) => u.username === username || (passportNumber && u.passportNumber === passportNumber))) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const newUser = {
    username: username || passportNumber,
    password: bcrypt.hashSync(password, 10),
    role: 'USER',
    fullName,
    email,
    passportNumber,
    phoneNumber,
    gender,
    nationality,
    dob
  };

  db.users.push(newUser);
  writeDB(db);

  const token = jwt.sign({ username: newUser.username, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });
  res.status(201).json({ 
    token, 
    user: { 
      username: newUser.username, 
      role: newUser.role,
      fullName,
      email,
      passportNumber,
      phoneNumber,
      gender,
      nationality,
      dob
    } 
  });
});

// Create new user (Manager or Admin)
app.post('/api/mgmt/accounts', authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only managers and admins can create accounts' });
    }

    const { username, password, role } = req.body;
    
    if (req.user.role === 'ADMIN' && role !== 'USER') {
      return res.status(403).json({ message: 'Admins can only create user accounts' });
    }

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const db = readDB();
    if (db.users.find((u: any) => u.username === username)) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    db.users.push({
      username,
      password: bcrypt.hashSync(password, 10),
      role: role || 'MANAGER'
    });

    writeDB(db);
    res.status(201).json({ message: 'User created successfully' });
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Get all users (Manager only)
app.get('/api/mgmt/accounts', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied' });
  }
  const db = readDB();
  const users = db.users.map(({ password, ...u }: any) => u);
  res.json(users);
});

// Update user (Manager or Admin)
app.put('/api/mgmt/accounts/:username', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Only managers and admins can update accounts' });
  }

  const { username } = req.params;
  const { newUsername, newPassword, role, fullName, email, passportNumber, phoneNumber } = req.body;
  const db = readDB();
  
  const userIndex = db.users.findIndex((u: any) => u.username === username);
  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Admins can only update USER accounts
  if (req.user.role === 'ADMIN' && db.users[userIndex].role !== 'USER') {
    return res.status(403).json({ message: 'Admins can only update user accounts' });
  }

  // Admins cannot change role to anything other than USER
  if (req.user.role === 'ADMIN' && role && role !== 'USER') {
    return res.status(403).json({ message: 'Admins cannot change roles to admin or manager' });
  }

  // Prevent updating other managers
  if (db.users[userIndex].role === 'MANAGER' && username !== req.user.username) {
    return res.status(403).json({ message: 'Cannot update other managers' });
  }

  // If changing username, check if new one exists
  if (newUsername && newUsername !== username) {
    if (db.users.find((u: any) => u.username === newUsername)) {
      return res.status(400).json({ message: 'New username already exists' });
    }
    db.users[userIndex].username = newUsername;
  }

  if (newPassword) {
    db.users[userIndex].password = bcrypt.hashSync(newPassword, 10);
  }

  if (role) {
    db.users[userIndex].role = role;
  }

  if (fullName !== undefined) db.users[userIndex].fullName = fullName;
  if (email !== undefined) db.users[userIndex].email = email;
  if (passportNumber !== undefined) db.users[userIndex].passportNumber = passportNumber;
  if (phoneNumber !== undefined) db.users[userIndex].phoneNumber = phoneNumber;

  writeDB(db);
  res.json({ message: 'User updated successfully' });
});

// Update current user profile (Self-update)
app.put('/api/user/profile', authenticateToken, (req: any, res) => {
  const { fullName, email, phoneNumber, gender, nationality, dob, currentPassword, newPassword } = req.body;
  const db = readDB();
  
  const userIndex = db.users.findIndex((u: any) => u.username === req.user.username);
  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found' });
  }

  const user = db.users[userIndex];

  // If changing password, verify current password
  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required to set a new password' });
    }
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }
    db.users[userIndex].password = bcrypt.hashSync(newPassword, 10);
  }

  // Update other fields if provided
  if (fullName !== undefined) db.users[userIndex].fullName = fullName;
  if (email !== undefined) db.users[userIndex].email = email;
  if (phoneNumber !== undefined) db.users[userIndex].phoneNumber = phoneNumber;
  if (gender !== undefined) db.users[userIndex].gender = gender;
  if (nationality !== undefined) db.users[userIndex].nationality = nationality;
  if (dob !== undefined) db.users[userIndex].dob = dob;

  writeDB(db);

  const { password, ...updatedUser } = db.users[userIndex];
  res.json({ 
    message: 'Profile updated successfully',
    user: updatedUser
  });
});

// Delete user (Manager or Admin)
app.delete('/api/mgmt/accounts/:username', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Only managers and admins can delete accounts' });
  }

  const { username } = req.params;
  const db = readDB();
  
  const userToDelete = db.users.find((u: any) => u.username === username);
  if (!userToDelete) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Admins can only delete USER accounts
  if (req.user.role === 'ADMIN' && userToDelete.role !== 'USER') {
    return res.status(403).json({ message: 'Admins can only delete user accounts' });
  }

  // Prevent deleting other managers
  if (userToDelete.role === 'MANAGER' && username !== req.user.username) {
    return res.status(403).json({ message: 'Cannot delete other managers' });
  }

  // Prevent deleting yourself via this endpoint (managers use delete-self)
  if (username === req.user.username) {
    return res.status(400).json({ message: 'Use delete-self endpoint to delete your own account' });
  }

  const index = db.users.findIndex((u: any) => u.username === username);
  if (index !== -1) {
    db.users.splice(index, 1);
    writeDB(db);
    res.json({ message: 'User deleted successfully' });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// Delete self (Manager only)
app.post('/api/mgmt/delete-self', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER') {
    return res.status(403).json({ message: 'Only managers can use this endpoint' });
  }

  const { password, confirmPassword } = req.body;
  
  if (!password || !confirmPassword) {
    return res.status(400).json({ message: 'Both passwords are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  const db = readDB();
  const user = db.users.find((u: any) => u.username === req.user.username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Incorrect password' });
  }

  const index = db.users.findIndex((u: any) => u.username === req.user.username);
  db.users.splice(index, 1);
  writeDB(db);
  
  res.json({ message: 'Account deleted successfully' });
});

// Ban user (Manager or Admin)
app.post('/api/mgmt/ban', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Only managers and admins can ban users' });
  }

  const { email, phoneNumber, duration, reason } = req.body;
  const db = readDB();
  db.bannedUsers = db.bannedUsers || [];
  
  let banExpires = 'PERMANENT';
  if (duration !== 'PERMANENT') {
    // duration is in milliseconds
    banExpires = new Date(Date.now() + duration).toISOString();
  }
  
  db.bannedUsers.push({
    id: `BAN-${Date.now()}`,
    email,
    phoneNumber,
    banExpires,
    reason,
    bannedAt: new Date().toISOString(),
    bannedBy: req.user.username
  });
  
  writeDB(db);
  res.json({ message: 'User banned successfully' });
});

// Get all banned users
app.get('/api/mgmt/banned', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied' });
  }
  const db = readDB();
  res.json(db.bannedUsers || []);
});

// Unban user
app.delete('/api/mgmt/ban/:id', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied' });
  }
  const { id } = req.params;
  const db = readDB();
  const index = db.bannedUsers.findIndex((b: any) => b.id === id);
  if (index !== -1) {
    db.bannedUsers.splice(index, 1);
    writeDB(db);
    res.json({ message: 'User unbanned successfully' });
  } else {
    res.status(404).json({ message: 'Ban record not found' });
  }
});

// Search items API
app.get('/api/search', (req, res) => {
  const { q, city } = req.query;
  const db = readDB();
  let items = db.items.filter(item => item.status === 'APPROVED');
  
  if (city) {
    items = items.filter(item => item.city === city);
  }
  
  if (q) {
    const queryWords = (q as string).toLowerCase().split(/\s+/).filter(w => w.length > 1);
    items = items.filter(item => {
      const searchFields = [
        item.name,
        item.description,
        item.nameEn || '',
        item.descriptionEn || '',
        item.foundLocation,
        item.foundLocationEn || ''
      ].map(f => f.toLowerCase());

      return queryWords.some(word => 
        searchFields.some(field => field.includes(word))
      );
    });
  }
  
  res.json(items);
});

// Get all items
app.get('/api/items', (req, res) => {
  const db = readDB();
  res.json(db.items);
});

// Feedback API
app.post('/api/feedback', (req, res) => {
  const { feedback, type, lang, timestamp, submittedBy } = req.body;
  const db = readDB();
  
  // Try to get user from token if not provided in body
  let userFromToken = null;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      userFromToken = decoded.username;
    } catch (e) {}
  }

  const newFeedback = {
    id: `FB-${Date.now()}`,
    content: feedback,
    type: type || 'GENERAL',
    lang,
    timestamp,
    read: false,
    submittedBy: submittedBy || userFromToken || 'Anonymous'
  };
  
  db.feedbacks.push(newFeedback);
  writeDB(db);
  
  console.log(`[FEEDBACK SAVED TO DB] Type: ${type}, Lang: ${lang}, By: ${newFeedback.submittedBy}`);
  res.status(201).json({ message: 'Feedback received and saved' });
});

// Get user info (Admin only)
app.get('/api/mgmt/users/:username', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
    return res.status(403).json({ message: 'Only admins can view user details' });
  }
  const { username } = req.params;
  const db = readDB();
  const user = db.users.find((u: any) => u.username === username);
  
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  const { password, ...userInfo } = user;
  res.json(userInfo);
});

// Get all feedbacks (Admin/Manager only)
app.get('/api/feedback', authenticateToken, (req, res) => {
  const db = readDB();
  const sortedFeedbacks = [...db.feedbacks].sort((a: any, b: any) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  res.json(sortedFeedbacks);
});

// Mark feedback as read
app.post('/api/feedback/mark-read', authenticateToken, (req, res) => {
  try {
    const { ids } = req.body;
    const db = readDB();
    
    if (Array.isArray(ids)) {
      db.feedbacks.forEach((fb: any) => {
        if (ids.includes(fb.id)) fb.read = true;
      });
    } else {
      db.feedbacks.forEach((fb: any) => fb.read = true);
    }
    
    writeDB(db);
    res.json({ message: 'Marked as read' });
  } catch (error: any) {
    console.error('Error marking feedback as read:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// --- Claim API ---

// Create a claim request
app.post('/api/claims', authenticateToken, (req: any, res) => {
  const { itemId, description, lostDate, lostTime, userFullName, userPassport, userPhone, userEmail, itemName, itemImage } = req.body;
  const db = readDB();
  
  // 1. Restrict claims per item: User can only claim each item once
  const existingClaim = db.claims?.find((c: any) => c.itemId === itemId && c.userId === req.user.username);
  if (existingClaim) {
    return res.status(400).json({ message: 'You have already submitted a claim for this item.' });
  }

  const newClaim = {
    id: `CLAIM-${Date.now()}`,
    itemId,
    userId: req.user.username,
    userName: userFullName,
    userPassport,
    userPhone,
    userEmail,
    itemName,
    itemImage,
    description,
    lostDate,
    lostTime,
    status: 'PENDING',
    timestamp: new Date().toISOString()
  };
  
  db.claims = db.claims || [];
  db.claims.push(newClaim);
  writeDB(db);
  
  res.status(201).json(newClaim);
});

// Get all claims (Admin only)
app.get('/api/claims', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
    return res.status(403).json({ message: 'Only admins can view claims' });
  }
  const db = readDB();
  res.json(db.claims || []);
});

// Update claim status (Admin only)
app.put('/api/claims/:id', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
    return res.status(403).json({ message: 'Only admins can update claims' });
  }
  const { id } = req.params;
  const { status } = req.body;
  const db = readDB();
  
  const index = db.claims.findIndex((c: any) => c.id === id);
  if (index === -1) {
    return res.status(404).json({ message: 'Claim not found' });
  }
  
  const oldStatus = db.claims[index].status;
  db.claims[index].status = status;

  // Notification for approval
  if (status === 'APPROVED' && oldStatus !== 'APPROVED') {
    const claim = db.claims[index];
    const newNotification = {
      id: `NOTIF-${Date.now()}`,
      userId: claim.userId,
      title: 'Claim Approved',
      titleAr: 'تمت الموافقة على المطالبة',
      message: `Your claim for item "${claim.itemName}" has been approved. Please follow the pickup instructions.`,
      messageAr: `تمت الموافقة على مطالبتك للعنصر "${claim.itemName}". يرجى اتباع تعليمات الاستلام.`,
      type: 'CLAIM_APPROVED',
      createdAt: new Date().toISOString(),
      read: false
    };
    db.notifications = db.notifications || [];
    db.notifications.push(newNotification);
  }
  
  writeDB(db);
  res.json(db.claims[index]);
});

// Get all lost items
app.get('/api/lost-items', (req, res) => {
  const db = readDB();
  res.json(db.lostItems || []);
});

// Add new lost item
app.post('/api/lost-items', authenticateToken, (req: any, res) => {
  const db = readDB();
  if (!db.lostItems) db.lostItems = [];
  
  const newItem = {
    id: `LI-${Date.now()}`,
    ...req.body,
    userId: req.user.username,
    createdAt: new Date().toISOString(),
    status: 'PENDING'
  };
  
  db.lostItems.push(newItem);

  // Thank you notification
  const thankYouNotif = {
    id: `NOTIF-${Date.now()}-TYL`,
    userId: req.user.username,
    title: 'Thank You for Reporting',
    titleAr: 'شكراً لك على الإبلاغ',
    message: `Thank you for reporting your lost item "${newItem.name}". We will notify you if a match is found.`,
    messageAr: `شكراً لك على الإبلاغ عن عنصرك المفقود "${newItem.name}". سنقوم بإخطارك في حال العثور على تطابق.`,
    type: 'REPORT_THANK_YOU',
    createdAt: new Date().toISOString(),
    read: false
  };
  db.notifications = db.notifications || [];
  db.notifications.push(thankYouNotif);

  writeDB(db);
  res.status(201).json(newItem);
});

// Delete lost item
app.delete('/api/lost-items/:id', authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const db = readDB();
  if (!db.lostItems) db.lostItems = [];
  
  const index = db.lostItems.findIndex((i: any) => i.id === id);
  
  if (index === -1) {
    return res.status(404).json({ message: 'Lost item not found' });
  }

  db.lostItems.splice(index, 1);
  writeDB(db);
  res.json({ message: 'Lost item deleted successfully' });
});

// Update lost item
app.put('/api/lost-items/:id', authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const db = readDB();
  if (!db.lostItems) db.lostItems = [];
  
  const index = db.lostItems.findIndex((i: any) => i.id === id);
  
  if (index === -1) {
    return res.status(404).json({ message: 'Lost item not found' });
  }

  db.lostItems[index] = { ...db.lostItems[index], ...req.body };
  writeDB(db);
  res.json(db.lostItems[index]);
});

// Get user notifications
app.get('/api/notifications', authenticateToken, (req: any, res) => {
  const db = readDB();
  const userNotifications = (db.notifications || []).filter((n: any) => n.userId === req.user.username);
  res.json(userNotifications);
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const db = readDB();
  if (!db.notifications) db.notifications = [];
  
  const notification = db.notifications.find((n: any) => n.id === id && n.userId === req.user.username);
  if (notification) {
    notification.read = true;
    writeDB(db);
    res.json(notification);
  } else {
    res.status(404).json({ message: 'Notification not found' });
  }
});

// Add new notification
app.post('/api/notifications', authenticateToken, (req: any, res) => {
  const db = readDB();
  if (!db.notifications) db.notifications = [];
  
  const newNotification = {
    id: `NOTIF-${Date.now()}`,
    ...req.body,
    createdAt: new Date().toISOString(),
    read: false
  };
  
  db.notifications.push(newNotification);
  writeDB(db);
  res.status(201).json(newNotification);
});

// Add new item
app.post('/api/items', authenticateToken, (req: any, res) => {
  const db = readDB();
  const newItem = {
    id: `ITEM-${Date.now()}`,
    ...req.body,
    submittedBy: req.user.username,
    createdAt: new Date().toISOString(),
    status: (req.user.role === 'ADMIN' || req.user.role === 'MANAGER') ? 'APPROVED' : 'PENDING'
  };
  
  db.items.push(newItem);

  // Thank you notification
  const thankYouNotif = {
    id: `NOTIF-${Date.now()}-TY`,
    userId: req.user.username,
    title: 'Thank You for Reporting',
    titleAr: 'شكراً لك على الإبلاغ',
    message: `Thank you for reporting the found item "${newItem.name}". Our team will review it shortly.`,
    messageAr: `شكراً لك على الإبلاغ عن العنصر المعثور عليه "${newItem.name}". سيقوم فريقنا بمراجعته قريباً.`,
    type: 'REPORT_THANK_YOU',
    createdAt: new Date().toISOString(),
    read: false
  };
  db.notifications = db.notifications || [];
  db.notifications.push(thankYouNotif);

  writeDB(db);
  res.status(201).json(newItem);
});

// Update item
app.put('/api/items/:id', authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const db = readDB();
  const index = db.items.findIndex((i: any) => i.id === id);
  
  if (index === -1) {
    return res.status(404).json({ message: 'Item not found' });
  }

  const item = db.items[index];
  const oldStatus = item.status;

  // Authorization check: Admin/Manager or the person who submitted it
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER' && item.submittedBy !== req.user.username) {
    return res.status(403).json({ message: 'Not authorized to update this item' });
  }

  // Update fields
  const updatedItem = {
    ...item,
    ...req.body,
    id: item.id, // Keep original ID
    submittedBy: item.submittedBy, // Keep original author
  };

  // If a regular user updates, it must be re-approved
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
    updatedItem.status = 'PENDING';
  }

  // Notification for approval
  if (updatedItem.status === 'APPROVED' && oldStatus !== 'APPROVED') {
    const approvalNotif = {
      id: `NOTIF-${Date.now()}-APP`,
      userId: item.submittedBy,
      title: 'Item Report Approved',
      titleAr: 'تمت الموافقة على بلاغ العنصر',
      message: `Your report for the found item "${item.name}" has been approved.`,
      messageAr: `تمت الموافقة على بلاغك عن العنصر المعثور عليه "${item.name}".`,
      type: 'REPORT_APPROVED',
      createdAt: new Date().toISOString(),
      read: false
    };
    db.notifications = db.notifications || [];
    db.notifications.push(approvalNotif);
  }

  db.items[index] = updatedItem;
  writeDB(db);
  res.json(updatedItem);
});

// Delete item
app.delete('/api/items/:id', authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const db = readDB();
  const index = db.items.findIndex((i: any) => i.id === id);
  
  if (index === -1) {
    return res.status(404).json({ message: 'Item not found' });
  }

  const item = db.items[index];

  if (req.user.role === 'ADMIN' || req.user.role === 'MANAGER') {
    // Admin/Manager can delete directly
    db.items.splice(index, 1);
    writeDB(db);
    res.json({ message: 'Item deleted successfully' });
  } else if (item.submittedBy === req.user.username) {
    // User requests deletion - needs admin approval
    db.items[index].status = 'PENDING_DELETION';
    writeDB(db);
    res.json({ message: 'Deletion request sent for approval' });
  } else {
    res.status(403).json({ message: 'Not authorized to delete this item' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
