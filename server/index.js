import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { z } from 'zod';
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from './middleware/rateLimiter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFilePath = path.join(__dirname, 'database.sqlite');
const app = express();
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

let resolvedDbPath = dbFilePath;
if (process.env.VERCEL) {
  resolvedDbPath = path.join('/tmp', 'database.sqlite');
  try {
    if (fs.existsSync(dbFilePath) && !fs.existsSync(resolvedDbPath)) {
      fs.copyFileSync(dbFilePath, resolvedDbPath);
      const shm = `${dbFilePath}-shm`;
      const wal = `${dbFilePath}-wal`;
      if (fs.existsSync(shm)) fs.copyFileSync(shm, `${resolvedDbPath}-shm`);
      if (fs.existsSync(wal)) fs.copyFileSync(wal, `${resolvedDbPath}-wal`);
    }
  } catch (err) {
    console.warn('Could not copy sqlite to /tmp:', err.message);
  }
}

const db = new Database(resolvedDbPath);
try {
  db.pragma('journal_mode = WAL');
} catch (e) {
  try { db.pragma('journal_mode = MEMORY'); } catch (_ignore) {}
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      image TEXT,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      availability INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_contact TEXT NOT NULL,
      customer_email TEXT,
      total_amount REAL NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'Pending Verification',
      order_status TEXT NOT NULL DEFAULT 'Pending Payment',
      pickup_date TEXT,
      pickup_time TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      payment_reference TEXT,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending Verification',
      paid_at TEXT,
      verified_at TEXT,
      admin_notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      contact_number TEXT NOT NULL,
      address TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      points INTEGER NOT NULL DEFAULT 0,
      last_attempt TEXT NOT NULL,
      locked_until TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      change_amount INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      reason TEXT NOT NULL,
      adjusted_by_admin_id INTEGER,
      order_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      changed_by_admin_id INTEGER,
      note TEXT,
      stock_restored INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.exec("ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'owner'");
  } catch (_e) {}
  try {
    db.exec('ALTER TABLE orders ADD COLUMN idempotency_key TEXT');
  } catch (_e) {}

  const gracePass = process.env.ADMIN_PASSWORD || 'grace123';
  const graceHash = bcrypt.hashSync(gracePass, 10);
  const graceAdmin = db.prepare('SELECT * FROM admins WHERE email = ? OR username = ? OR username = ?').get('grace@glazydays.com', 'grace@glazydays.com', 'grace');
  if (!graceAdmin) {
    db.prepare(
      'INSERT INTO admins (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run('grace', 'grace@glazydays.com', graceHash, 'owner');
  } else {
    db.prepare('UPDATE admins SET username = ?, email = ?, password_hash = ?, role = ? WHERE id = ?').run('grace', 'grace@glazydays.com', graceHash, 'owner', graceAdmin.id);
  }

  const adminHash = bcrypt.hashSync('admin123', 10);
  const adminAccount = db.prepare('SELECT * FROM admins WHERE username = ? OR email = ?').get('admin', 'admin@glazydays.com');
  if (!adminAccount) {
    db.prepare(
      'INSERT INTO admins (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run('admin', 'admin@glazydays.com', adminHash, 'owner');
  } else {
    db.prepare('UPDATE admins SET username = ?, email = ?, password_hash = ?, role = ? WHERE id = ?').run('admin', 'admin@glazydays.com', adminHash, 'owner', adminAccount.id);
  }

  try {
    db.exec('ALTER TABLE orders ADD COLUMN customer_address TEXT');
  } catch (_e) {
    // Column may already exist
  }
  try {
    db.exec('ALTER TABLE orders ADD COLUMN customer_id INTEGER');
  } catch (_e) {
    // Column may already exist
  }
  try {
    db.exec("ALTER TABLE payments ADD COLUMN verified_at TEXT");
  } catch (_e) {
    // Column may already exist
  }
  try {
    db.exec("ALTER TABLE payments ADD COLUMN admin_notes TEXT");
  } catch (_e) {
    // Column may already exist
  }
  // Migrate existing orders: if order_status is 'Pending' set to 'Pending Payment'
  try {
    db.exec("UPDATE orders SET order_status = 'Pending Payment' WHERE order_status = 'Pending'");
  } catch (_e) { /* ignore */ }
  // Migrate existing payments: if status is 'Paid' keep as-is for legacy data, but update 'Pending' → 'Pending Verification'
  try {
    db.exec("UPDATE payments SET status = 'Pending Verification' WHERE status = 'Pending'");
  } catch (_e) { /* ignore */ }
  // Migrate existing orders payment_status: 'Pending' → 'Pending Verification'
  try {
    db.exec("UPDATE orders SET payment_status = 'Pending Verification' WHERE payment_status = 'Pending'");
  } catch (_e) { /* ignore */ }

  // Ready to Claim notification tables & columns (Migration 002)
  try { db.exec('ALTER TABLE orders ADD COLUMN queue_number TEXT'); } catch (_e) {}
  try { db.exec('ALTER TABLE orders ADD COLUMN tracking_token TEXT'); } catch (_e) {}
  try { db.exec('ALTER TABLE orders ADD COLUMN ready_notified_at TEXT'); } catch (_e) {}
  try { db.exec('ALTER TABLE orders ADD COLUMN claimed_at TEXT'); } catch (_e) {}
  try { db.exec('ALTER TABLE orders ADD COLUMN claimed_by TEXT'); } catch (_e) {}
  try { db.exec('ALTER TABLE orders ADD COLUMN reminder_count INTEGER NOT NULL DEFAULT 0'); } catch (_e) {}
  try { db.exec('ALTER TABLE orders ADD COLUMN last_called_at TEXT'); } catch (_e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      UNIQUE (order_id, type, channel)
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Backfill queue numbers and tracking tokens for any orders missing them
  try {
    const unassigned = db.prepare('SELECT id FROM orders WHERE queue_number IS NULL OR tracking_token IS NULL').all();
    for (const o of unassigned) {
      const letterIndex = Math.floor((o.id - 1) / 999) % 26;
      const prefix = String.fromCharCode(65 + letterIndex);
      const num = ((o.id - 1) % 999) + 1;
      const qNum = `${prefix}-${String(num).padStart(3, '0')}`;
      const token = uuidv4().replace(/-/g, '');
      db.prepare('UPDATE orders SET queue_number = COALESCE(queue_number, ?), tracking_token = COALESCE(tracking_token, ?) WHERE id = ?')
        .run(qNum, token, o.id);
    }
  } catch (_e) {}

  // Backfill ready_notified_at for existing orders that are already Ready for Pickup
  try {
    db.prepare(`
      UPDATE orders 
      SET ready_notified_at = updated_at 
      WHERE order_status = 'Ready for Pickup' AND ready_notified_at IS NULL
    `).run();
  } catch (_e) {}

  // Initialize default notification settings if empty
  try {
    const existingRules = db.prepare('SELECT key FROM notification_settings WHERE key = ?').get('unclaimed_rules');
    if (!existingRules) {
      db.prepare('INSERT INTO notification_settings (key, value) VALUES (?, ?)').run(
        'unclaimed_rules',
        JSON.stringify({ orangeThresholdMinutes: 10, redThresholdMinutes: 20, autoRemindMinutes: 15, noShowHours: 24 })
      );
    }
  } catch (_e) {}

  const seededProducts = [
    { name: 'Choco Star Delight', description: 'Rich chocolate glaze with golden sprinkles.', price: 49, stock_quantity: 15, image: '/assets/donuts/donut-1.png' },
    { name: 'Classic Glaze', description: 'Simple, sweet, and timeless.', price: 39, stock_quantity: 20, image: '/assets/donuts/donut-2.png' },
    { name: 'Nutty Crunch', description: 'Chocolate donut with roasted nuts.', price: 55, stock_quantity: 12, image: '/assets/donuts/donut-3.png' },
    { name: 'Mocha Swirl', description: 'Coffee-choco swirl perfection.', price: 52, stock_quantity: 10, image: '/assets/donuts/donut-4.png' },
    { name: 'Cookie Crumble', description: 'Topped with cookie bits and dark glaze.', price: 58, stock_quantity: 9, image: '/assets/donuts/donut-5.png' },
    { name: 'Caramel Cloud', description: 'Soft donut with caramel drizzle.', price: 45, stock_quantity: 16, image: '/assets/donuts/donut-6.png' },
    { name: 'Orange Drizzle', description: 'Zesty orange glaze with choco lines.', price: 48, stock_quantity: 8, image: '/assets/donuts/donut-7.png' },
    { name: 'Vanilla Fudge Stripe', description: 'Vanilla glaze with chocolate drizzle.', price: 47, stock_quantity: 6, image: '/assets/donuts/donut-8.png' },
    { name: 'Sugar Puff', description: 'Soft donut dusted with sugar.', price: 35, stock_quantity: 18, image: '/assets/donuts/donut-9.png' },
    { name: 'Choco Lines', description: 'White glaze with bold choco stripes.', price: 42, stock_quantity: 14, image: '/assets/donuts/donut-10.png' },
    { name: 'Honey Loop', description: 'Sweet donut with honey drizzle.', price: 44, stock_quantity: 13, image: '/assets/donuts/donut-11.png' },
    { name: 'Strawberry Dream', description: 'Pink glaze with sugar pearls.', price: 50, stock_quantity: 17, image: '/assets/donuts/donut-12.png' },
    { name: 'Pink Paradise', description: 'Strawberry glaze with sprinkles.', price: 48, stock_quantity: 11, image: '/assets/donuts/donut-13.png' },
    { name: 'Orange Sprinkle Joy', description: 'Citrus glaze with rainbow sprinkles.', price: 46, stock_quantity: 7, image: '/assets/donuts/donut-14.png' },
    { name: 'Candy Dot Fun', description: 'Covered in candy-coated chocolates.', price: 55, stock_quantity: 5, image: '/assets/donuts/donut-15.png' },
    { name: 'Pistachio Pop', description: 'Green glaze with crushed pistachios.', price: 60, stock_quantity: 9, image: '/assets/donuts/donut-16.png' },
    { name: 'Tropical Wave', description: 'Blue glaze with a coconut twist.', price: 52, stock_quantity: 10, image: '/assets/donuts/donut-17.png' },
    { name: 'Moston Treme', description: "Competitor's Best Seller", price: 1, stock_quantity: 4, image: '/assets/donuts/donut-18.png' }
  ];

  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (productCount === 0) {
    const insertProduct = db.prepare(
      'INSERT INTO products (name, description, price, image, stock_quantity, availability) VALUES (?, ?, ?, ?, ?, ?)' 
    );
    for (const product of seededProducts) {
      insertProduct.run(
        product.name,
        product.description,
        product.price,
        product.image,
        product.stock_quantity,
        1
      );
    }
  }
}

initializeDatabase();

function formatOrderNumber(value) {
  return `ORD-${String(value).padStart(6, '0')}`;
}

function generateQueueNumber(orderId) {
  const numId = Number(orderId) || 1;
  const letterIndex = Math.floor((numId - 1) / 999) % 26;
  const prefix = String.fromCharCode(65 + letterIndex);
  const numInBatch = ((numId - 1) % 999) + 1;
  return `${prefix}-${String(numInBatch).padStart(3, '0')}`;
}

function getNotificationSettings() {
  try {
    const row = db.prepare('SELECT value FROM notification_settings WHERE key = ?').get('unclaimed_rules');
    if (row && row.value) {
      return JSON.parse(row.value);
    }
  } catch (_e) {}
  return { orangeThresholdMinutes: 10, redThresholdMinutes: 20, autoRemindMinutes: 15, noShowHours: 24 };
}

function evaluateUnclaimedRulesLazily() {
  try {
    const settings = getNotificationSettings();
    const autoRemindMinutes = Number(settings.autoRemindMinutes || 15);
    const readyOrders = db.prepare(`
      SELECT id, order_number, queue_number, ready_notified_at, reminder_count 
      FROM orders 
      WHERE order_status = 'Ready for Pickup'
    `).all();

    const now = Date.now();
    for (const o of readyOrders) {
      if (!o.ready_notified_at) continue;
      const notifiedTime = new Date(o.ready_notified_at).getTime();
      const diffMinutes = (now - notifiedTime) / 60000;

      // Lazy auto-remind rule: remind once after configured minutes
      if (diffMinutes >= autoRemindMinutes && Number(o.reminder_count || 0) === 0) {
        db.prepare('UPDATE orders SET reminder_count = 1 WHERE id = ?').run(o.id);
        try {
          db.prepare(`
            INSERT OR IGNORE INTO notifications (order_id, type, channel, status, sent_at)
            VALUES (?, 'reminder', 'in_app', 'sent', CURRENT_TIMESTAMP)
          `).run(o.id);
        } catch (_ignore) {}
      }
    }
  } catch (err) {
    console.warn('Error during evaluateUnclaimedRulesLazily:', err.message);
  }
}

function logAudit({ adminId = null, action, entityType = null, entityId = null, details = null, ipAddress = null }) {
  try {
    db.prepare(
      'INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      adminId,
      action,
      entityType,
      entityId ? String(entityId) : null,
      details ? JSON.stringify(details) : null,
      ipAddress
    );
  } catch (err) {
    console.warn('Audit log write error:', err.message);
  }
}

function tokenForAdmin(admin) {
  const role = admin.role === 'admin' ? 'owner' : (admin.role || 'staff');
  return jwt.sign(
    { sub: String(admin.id), username: admin.username, email: admin.email, role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function extractAdminToken(req) {
  if (req.cookies && req.cookies.glazy_admin_token) {
    return req.cookies.glazy_admin_token;
  }
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

function requireAuth(req, res, next) {
  const token = extractAdminToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!['owner', 'staff', 'admin'].includes(decoded.role)) {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const admin = db.prepare('SELECT id, username, email, role FROM admins WHERE id = ?').get(Number(decoded.sub));
    if (!admin) {
      return res.status(401).json({ message: 'Admin account not found or has been disabled.' });
    }

    req.admin = {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role === 'admin' ? 'owner' : (admin.role || 'staff'),
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session. Please log in again.' });
  }
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const currentRole = req.admin.role === 'admin' ? 'owner' : req.admin.role;
    if (!allowedRoles.includes(currentRole)) {
      return res.status(403).json({
        message: `Forbidden: This action requires [${allowedRoles.join(', ')}] permission. Your role is '${req.admin.role}'.`,
      });
    }
    next();
  };
}

function sanitizeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    image: product.image,
    stock_quantity: Number(product.stock_quantity),
    availability: Boolean(product.availability),
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Ecommerce API is running.' });
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();
  const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const rateKey = `admin_login:${clientIp}:${cleanUser}`;

  if (!cleanUser || !cleanPass) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  // 1. Check rate limit
  const limitStatus = await checkRateLimit(rateKey, db);
  if (!limitStatus.allowed) {
    logAudit({ action: 'ADMIN_LOGIN_LOCKED', entityType: 'admin', details: { user: cleanUser }, ipAddress: clientIp });
    return res.status(429).json({ message: limitStatus.message });
  }

  const isGrace = cleanUser === 'grace' || cleanUser === 'grace@glazydays.com';
  const isAdminUser = cleanUser === 'admin' || cleanUser === 'admin@glazydays.com';

  // 2. Query admin from database
  let admin = db.prepare(`
    SELECT * FROM admins 
    WHERE LOWER(username) = ? 
       OR LOWER(email) = ? 
       OR (LOWER(email) = 'grace@glazydays.com' AND ? = 'grace')
       OR (LOWER(username) = 'grace' AND ? = 'grace@glazydays.com')
  `).get(cleanUser, cleanUser, cleanUser, cleanUser);

  // Auto-seed if running on fresh serverless cold-start or empty database
  if (!admin) {
    if (isGrace) {
      const graceHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'grace123', 10);
      const res = db.prepare(
        'INSERT INTO admins (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
      ).run('grace', 'grace@glazydays.com', graceHash, 'owner');
      admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(res.lastInsertRowid);
    } else if (isAdminUser) {
      const adminHash = bcrypt.hashSync('admin123', 10);
      const res = db.prepare(
        'INSERT INTO admins (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
      ).run('admin', 'admin@glazydays.com', adminHash, 'owner');
      admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(res.lastInsertRowid);
    }
  }

  const expectedGracePass = process.env.ADMIN_PASSWORD || 'grace123';
  const matchesBcrypt = Boolean(admin && bcrypt.compareSync(cleanPass, admin.password_hash));
  const matchesGraceFallback = isGrace && cleanPass === expectedGracePass;
  const matchesAdminFallback = isAdminUser && cleanPass === 'admin123';

  if (!matchesBcrypt && !matchesGraceFallback && !matchesAdminFallback) {
    const record = await recordFailedAttempt(rateKey, db);
    logAudit({ action: 'ADMIN_LOGIN_FAILED', entityType: 'admin', details: { user: cleanUser, attempt: record.points }, ipAddress: clientIp });

    if (record.locked) {
      return res.status(429).json({
        message: 'Too many failed login attempts. Your account is temporarily locked for 15 minutes.',
      });
    }
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  // Auto-heal hash in database if login succeeded via fallback
  if (admin && !matchesBcrypt && (matchesGraceFallback || matchesAdminFallback)) {
    try {
      db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(cleanPass, 10), admin.id);
    } catch (_e) {}
  }

  // 3. Reset rate limit on success
  await resetRateLimit(rateKey, db);

  const token = tokenForAdmin(admin);
  const role = admin.role === 'admin' ? 'owner' : (admin.role || 'staff');

  // 4. Set httpOnly Secure Cookie
  res.cookie('glazy_admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 3600 * 1000,
  });

  logAudit({
    adminId: admin.id,
    action: 'ADMIN_LOGIN_SUCCESS',
    entityType: 'admin',
    entityId: admin.id,
    ipAddress: clientIp,
  });

  return res.json({
    ok: true,
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role,
    },
  });
});

app.post('/api/admin/logout', requireAuth, (req, res) => {
  res.clearCookie('glazy_admin_token');
  logAudit({
    adminId: req.admin?.id,
    action: 'ADMIN_LOGOUT',
    entityType: 'admin',
    entityId: req.admin?.id,
    ipAddress: req.ip,
  });
  return res.json({ ok: true, message: 'Logged out successfully.' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({ ok: true, admin: req.admin });
});

app.get('/api/admin/verify', requireAuth, (req, res) => {
  return res.json({ ok: true, admin: req.admin });
});

app.post('/api/admin/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required.' });
  }

  if (String(newPassword).length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash)) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE admins SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, admin.id);

  logAudit({
    adminId: admin.id,
    action: 'ADMIN_PASSWORD_CHANGED',
    entityType: 'admin',
    entityId: admin.id,
    ipAddress: req.ip,
  });

  return res.json({ ok: true, message: 'Password changed successfully.' });
});

// ── Customer Auth ─────────────────────────────────────────────────────────────
app.post('/api/customers/register', (req, res) => {
  const { fullName, email, contactNumber, address, password } = req.body || {};
  if (!fullName || !email || !contactNumber || !address || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }
  const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ message: 'Email is already registered. Please log in.' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO customers (full_name, email, contact_number, address, password_hash) VALUES (?, ?, ?, ?, ?)'
  ).run(fullName, email, contactNumber, address, hash);
  const customer = db.prepare('SELECT id, full_name, email, contact_number, address, created_at FROM customers WHERE id = ?').get(result.lastInsertRowid);
  const token = jwt.sign({ sub: String(customer.id), email: customer.email, role: 'customer' }, JWT_SECRET, { expiresIn: '30d' });
  return res.status(201).json({ token, customer });
});

app.post('/api/customers/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(email);
  if (!customer || !bcrypt.compareSync(password, customer.password_hash)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  const token = jwt.sign({ sub: String(customer.id), email: customer.email, role: 'customer' }, JWT_SECRET, { expiresIn: '30d' });
  const safe = { id: customer.id, full_name: customer.full_name, email: customer.email, contact_number: customer.contact_number, address: customer.address };
  return res.json({ token, customer: safe });
});

app.get('/api/customers/me', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authenticated.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'customer') return res.status(403).json({ message: 'Not a customer token.' });
    const customer = db.prepare('SELECT id, full_name, email, contact_number, address FROM customers WHERE id = ?').get(Number(decoded.sub));
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    return res.json(customer);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
});

app.put('/api/customers/me', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authenticated.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'customer') return res.status(403).json({ message: 'Not a customer token.' });
    const { fullName, contactNumber, address } = req.body || {};
    db.prepare('UPDATE customers SET full_name = ?, contact_number = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(fullName || '', contactNumber || '', address || '', Number(decoded.sub));
    const updated = db.prepare('SELECT id, full_name, email, contact_number, address FROM customers WHERE id = ?').get(Number(decoded.sub));
    return res.json(updated);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
});

app.get('/api/customers/orders', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authenticated.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'customer') return res.status(403).json({ message: 'Not a customer token.' });
    const customer = db.prepare('SELECT id, email FROM customers WHERE id = ?').get(Number(decoded.sub));
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });

    const orders = db.prepare(`
      SELECT * FROM orders 
      WHERE customer_id = ? OR customer_email = ? 
      ORDER BY created_at DESC
    `).all(customer.id, customer.email);

    const fullOrders = orders.map(order => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      const payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(order.id);
      return { ...order, items, payments };
    });

    return res.json(fullOrders);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
});

// ── Admin Customers List ───────────────────────────────────────────────────────
app.get('/api/admin/customers', requireAuth, (_req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.full_name, c.email, c.contact_number, c.address, c.created_at,
           COUNT(o.id) as order_count,
           COALESCE(SUM(o.total_amount), 0) as total_spent
    FROM customers c
    LEFT JOIN orders o ON (o.customer_id = c.id OR o.customer_email = c.email)
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();
  return res.json(rows);
});
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/products', (_req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
  return res.json(rows.map(sanitizeProduct));
});


app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }
  return res.json(sanitizeProduct(product));
});

app.post('/api/products', requireAuth, (req, res) => {
  const { name, description, price, image, stock_quantity, availability } = req.body || {};

  if (!name || Number(price) <= 0 || Number(stock_quantity) < 0) {
    return res.status(400).json({ message: 'Invalid product input.' });
  }

  const result = db.prepare(
    'INSERT INTO products (name, description, price, image, stock_quantity, availability) VALUES (?, ?, ?, ?, ?, ?)' 
  ).run(
    name,
    description || '',
    Number(price),
    image || '',
    Number(stock_quantity),
    availability === false ? 0 : 1
  );

  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(sanitizeProduct(created));
});

app.put('/api/products/:id', requireAuth, (req, res) => {
  const { name, description, price, image, stock_quantity, availability } = req.body || {};
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  const nextName = name || product.name;
  const nextDescription = description ?? product.description;
  const nextPrice = Number(price ?? product.price);
  const nextImage = image ?? product.image;
  const nextStock = Number(stock_quantity ?? product.stock_quantity);
  const nextAvailability = availability === undefined ? product.availability : (availability === false ? 0 : 1);

  if (nextPrice <= 0 || nextStock < 0) {
    return res.status(400).json({ message: 'Invalid product data.' });
  }

  db.prepare(
    'UPDATE products SET name = ?, description = ?, price = ?, image = ?, stock_quantity = ?, availability = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(nextName, nextDescription, nextPrice, nextImage, nextStock, nextAvailability, product.id);

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(product.id);
  return res.json(sanitizeProduct(updated));
});

app.delete('/api/products/:id', requireAuth, requireRole(['owner']), (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  // Check if product has orders in order_items
  const hasOrders = db.prepare('SELECT id FROM order_items WHERE product_id = ? LIMIT 1').get(product.id);
  if (hasOrders) {
    // Soft-delete if product has order history
    try {
      db.prepare('UPDATE products SET availability = 0, is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(product.id);
    } catch (_e) {
      db.prepare('UPDATE products SET availability = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(product.id);
    }

    logAudit({
      adminId: req.admin.id,
      action: 'PRODUCT_ARCHIVED_SOFT_DELETED',
      entityType: 'product',
      entityId: product.id,
      details: { name: product.name },
      ipAddress: req.ip,
    });

    return res.json({ message: 'Product has order history and was safely archived.' });
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(product.id);

  logAudit({
    adminId: req.admin.id,
    action: 'PRODUCT_HARD_DELETED',
    entityType: 'product',
    entityId: product.id,
    details: { name: product.name },
    ipAddress: req.ip,
  });

  return res.json({ message: 'Product deleted successfully.' });
});

app.get('/api/inventory', requireAuth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
  return res.json(rows.map(sanitizeProduct));
});

app.put('/api/inventory/:id', requireAuth, (req, res) => {
  const { stock_quantity } = req.body || {};
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  const nextStock = Number(stock_quantity);
  if (!Number.isInteger(nextStock) || nextStock < 0) {
    return res.status(400).json({ message: 'Stock quantity must be a non-negative integer.' });
  }

  db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextStock, product.id);
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(product.id);
  return res.json(sanitizeProduct(updated));
});

app.get('/api/orders', requireAuth, (_req, res) => {
  cancelExpiredOrders();
  evaluateUnclaimedRulesLazily();
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();

  const itemsStmt = db.prepare('SELECT product_id, product_name as name, quantity, unit_price as unitPrice, subtotal FROM order_items WHERE order_id = ?');
  const paymentStmt = db.prepare('SELECT payment_method, payment_reference, status as payment_status, amount, verified_at, admin_notes FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1');

  const now = Date.now();
  const enriched = orders.map((o) => {
    const items = itemsStmt.all(o.id);
    const p = paymentStmt.get(o.id);
    let waitSeconds = null;
    if (o.order_status === 'Ready for Pickup' && o.ready_notified_at) {
      const start = new Date(o.ready_notified_at).getTime();
      waitSeconds = Math.max(0, Math.floor((now - start) / 1000));
    }
    return {
      ...o,
      payment_method: p?.payment_method || 'GCash',
      payment_reference: p?.payment_reference || null,
      items,
      waitSeconds,
    };
  });

  return res.json(enriched);
});

app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(order.id);
  return res.json({ ...order, items, payments });
});

app.patch('/api/orders/:id/status', requireAuth, (req, res) => {
  const { order_status, note } = req.body || {};
  const allowed = [
    'Pending Payment',
    'Awaiting Payment Verification',
    'Confirmed',
    'Processing',
    'Preparing',
    'Ready for Pickup',
    'Completed',
    'Cancelled'
  ];

  if (!allowed.includes(order_status)) {
    return res.status(400).json({ message: 'Invalid order status.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  if (order.order_status === order_status) {
    return res.json(order);
  }

  if (order.order_status === 'Completed' && order_status !== 'Completed') {
    return res.status(400).json({ message: 'Completed orders cannot change status.' });
  }

  if (order.order_status === 'Cancelled') {
    return res.status(400).json({ message: 'Cancelled orders cannot be reopened.' });
  }

  const tx = db.transaction(() => {
    let stockRestored = 0;

    // If transitioning to Cancelled, restore stock (guarded so it only happens once)
    if (order_status === 'Cancelled') {
      const alreadyRestored = db.prepare(
        'SELECT id FROM order_status_history WHERE order_id = ? AND stock_restored = 1'
      ).get(order.id);

      if (!alreadyRestored) {
        const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(order.id);
        for (const item of items) {
          const prod = db.prepare('SELECT id, name, stock_quantity FROM products WHERE id = ?').get(item.product_id);
          if (prod) {
            db.prepare(
              'UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).run(item.quantity, prod.id);

            db.prepare(
              'INSERT INTO stock_adjustments (product_id, change_amount, previous_stock, new_stock, reason, adjusted_by_admin_id, order_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(
              prod.id,
              item.quantity,
              prod.stock_quantity,
              prod.stock_quantity + item.quantity,
              `Order cancelled: ${order.order_number}`,
              req.admin?.id || null,
              order.id
            );
          }
        }
        stockRestored = 1;
      }
    }

    // Status update & timestamp records
    const nowIso = new Date().toISOString();
    let readyNotifiedAt = order.ready_notified_at;
    let claimedAt = order.claimed_at;
    let claimedBy = order.claimed_by;

    if (order_status === 'Ready for Pickup') {
      if (!readyNotifiedAt) {
        readyNotifiedAt = nowIso;
      }
      try {
        db.prepare(`
          INSERT OR IGNORE INTO notifications (order_id, type, channel, status, sent_at)
          VALUES (?, 'ready', 'in_app', 'sent', CURRENT_TIMESTAMP)
        `).run(order.id);
      } catch (_e) {}
    } else if (order_status === 'Completed') {
      if (!claimedAt) {
        claimedAt = nowIso;
      }
      claimedBy = claimedBy || req.admin?.username || 'staff';
      try {
        db.prepare(`
          INSERT OR IGNORE INTO notifications (order_id, type, channel, status, sent_at)
          VALUES (?, 'claimed', 'in_app', 'sent', CURRENT_TIMESTAMP)
        `).run(order.id);
      } catch (_e) {}
    }

    db.prepare(`
      UPDATE orders 
      SET order_status = ?, ready_notified_at = ?, claimed_at = ?, claimed_by = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(order_status, readyNotifiedAt, claimedAt, claimedBy, order.id);

    db.prepare(
      'INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by_admin_id, note, stock_restored) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      order.id,
      order.order_status,
      order_status,
      req.admin?.id || null,
      note || `Status changed from ${order.order_status} to ${order_status}`,
      stockRestored
    );

    logAudit({
      adminId: req.admin?.id,
      action: 'ORDER_STATUS_UPDATED',
      entityType: 'order',
      entityId: order.id,
      details: { orderNumber: order.order_number, from: order.order_status, to: order_status, stockRestored: Boolean(stockRestored) },
      ipAddress: req.ip,
    });

    return db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  });

  try {
    const updated = tx();
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to update order status.' });
  }
});

// ── Call Queue Number (Admin, Rate-limited to once per 30s) ──────────────────
app.post('/api/orders/:id/call', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  if (order.order_status !== 'Ready for Pickup') {
    return res.status(400).json({ message: 'Only orders that are Ready for Pickup can be called.' });
  }

  const now = Date.now();
  if (order.last_called_at) {
    const lastCalled = new Date(order.last_called_at).getTime();
    const elapsedSeconds = Math.floor((now - lastCalled) / 1000);
    const cooldown = 30;
    if (elapsedSeconds < cooldown) {
      const wait = cooldown - elapsedSeconds;
      return res.status(429).json({
        message: `Rate limit: Please wait ${wait}s before calling this number again.`,
        retryAfterSeconds: wait,
      });
    }
  }

  const nowIso = new Date().toISOString();
  db.prepare(`
    UPDATE orders 
    SET last_called_at = ?, reminder_count = reminder_count + 1, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(nowIso, order.id);

  try {
    db.prepare(`
      INSERT INTO notifications (order_id, type, channel, status, sent_at)
      VALUES (?, 'reminder', 'in_app', 'sent', CURRENT_TIMESTAMP)
    `).run(order.id);
  } catch (_e) {}

  logAudit({
    adminId: req.admin?.id,
    action: 'QUEUE_NUMBER_CALLED',
    entityType: 'order',
    entityId: order.id,
    details: { orderNumber: order.order_number, queueNumber: order.queue_number },
    ipAddress: req.ip,
  });

  return res.json({
    ok: true,
    message: `Queue number ${order.queue_number} called!`,
    queue_number: order.queue_number,
    last_called_at: nowIso,
  });
});

// ── Claim Verification & QR Scanning (Admin) ─────────────────────────────────
const claimSchema = z.object({
  orderNumber: z.string().optional(),
  trackingToken: z.string().optional(),
  qrData: z.string().optional(),
});

app.post('/api/orders/claim-verify', requireAuth, (req, res) => {
  const parseResult = claimSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: 'Invalid claim request format.' });
  }

  let { orderNumber, trackingToken, qrData } = parseResult.data;

  // Support parsing scanned QR code payload: either JSON or "GLAZY_CLAIM:<ord>:<token>" or direct string
  if (qrData) {
    try {
      const parsed = JSON.parse(qrData);
      if (parsed.orderNumber) orderNumber = parsed.orderNumber;
      if (parsed.token || parsed.trackingToken) trackingToken = parsed.token || parsed.trackingToken;
    } catch (_e) {
      if (qrData.startsWith('GLAZY_CLAIM:')) {
        const parts = qrData.split(':');
        orderNumber = parts[1];
        trackingToken = parts[2];
      } else {
        // Assume raw format "orderNumber:token"
        const parts = qrData.split(':');
        if (parts.length === 2) {
          orderNumber = parts[0];
          trackingToken = parts[1];
        }
      }
    }
  }

  if (!orderNumber) {
    return res.status(400).json({ message: 'Order number is required to verify claim.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber.trim());
  if (!order) {
    return res.status(404).json({ message: `Order ${orderNumber} not found.` });
  }

  if (order.order_status === 'Completed') {
    return res.status(400).json({
      message: `Order ${order.order_number} (Queue ${order.queue_number}) was already claimed on ${order.claimed_at ? new Date(order.claimed_at).toLocaleString() : 'an earlier session'}.`,
      alreadyClaimed: true,
    });
  }

  if (trackingToken && order.tracking_token && order.tracking_token !== trackingToken.trim()) {
    return res.status(400).json({ message: 'Invalid claim token. QR code verification failed.' });
  }

  const nowIso = new Date().toISOString();
  const staffName = req.admin?.username || 'staff';

  db.prepare(`
    UPDATE orders 
    SET order_status = 'Completed', claimed_at = ?, claimed_by = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(nowIso, staffName, order.id);

  db.prepare(
    'INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by_admin_id, note) VALUES (?, ?, ?, ?, ?)'
  ).run(order.id, order.order_status, 'Completed', req.admin?.id || null, `Claim confirmed and verified by ${staffName}`);

  try {
    db.prepare(`
      INSERT OR IGNORE INTO notifications (order_id, type, channel, status, sent_at)
      VALUES (?, 'claimed', 'in_app', 'sent', CURRENT_TIMESTAMP)
    `).run(order.id);
  } catch (_e) {}

  logAudit({
    adminId: req.admin?.id,
    action: 'ORDER_CLAIM_VERIFIED',
    entityType: 'order',
    entityId: order.id,
    details: { orderNumber: order.order_number, queueNumber: order.queue_number, claimedBy: staffName },
    ipAddress: req.ip,
  });

  return res.json({
    ok: true,
    message: `Order ${order.order_number} (Queue ${order.queue_number}) successfully verified and claimed!`,
    order: {
      ...order,
      order_status: 'Completed',
      claimed_at: nowIso,
      claimed_by: staffName,
    },
  });
});

// ── Unclaimed Orders Summary (Admin) ─────────────────────────────────────────
app.get('/api/admin/unclaimed-summary', requireAuth, (_req, res) => {
  evaluateUnclaimedRulesLazily();
  const settings = getNotificationSettings();
  const orangeMin = Number(settings.orangeThresholdMinutes || 10);
  const redMin = Number(settings.redThresholdMinutes || 20);

  const readyOrders = db.prepare(`
    SELECT id, order_number, queue_number, customer_name, total_amount, 
           ready_notified_at, last_called_at, reminder_count, pickup_time
    FROM orders 
    WHERE order_status = 'Ready for Pickup'
    ORDER BY ready_notified_at ASC
  `).all();

  const now = Date.now();
  const processed = readyOrders.map((o) => {
    let elapsedSeconds = 0;
    if (o.ready_notified_at) {
      elapsedSeconds = Math.max(0, Math.floor((now - new Date(o.ready_notified_at).getTime()) / 1000));
    }
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    let severity = 'normal';
    if (elapsedMinutes >= redMin) severity = 'red';
    else if (elapsedMinutes >= orangeMin) severity = 'orange';

    return {
      ...o,
      elapsedSeconds,
      elapsedMinutes,
      severity,
    };
  });

  return res.json({
    count: processed.length,
    orangeThresholdMinutes: orangeMin,
    redThresholdMinutes: redMin,
    orders: processed,
  });
});

// ── Notification Settings (Admin / Owner Only) ───────────────────────────────
app.get('/api/admin/notification-settings', requireAuth, (_req, res) => {
  const settings = getNotificationSettings();
  return res.json(settings);
});

const settingsSchema = z.object({
  orangeThresholdMinutes: z.number().int().min(1).max(180),
  redThresholdMinutes: z.number().int().min(2).max(360),
  autoRemindMinutes: z.number().int().min(1).max(180),
  noShowHours: z.number().int().min(1).max(72),
});

app.put('/api/admin/notification-settings', requireAuth, requireRole(['owner']), (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid notification settings parameters.' });
  }

  db.prepare(`
    INSERT INTO notification_settings (key, value, updated_at) 
    VALUES ('unclaimed_rules', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(JSON.stringify(parsed.data));

  logAudit({
    adminId: req.admin?.id,
    action: 'NOTIFICATION_SETTINGS_UPDATED',
    details: parsed.data,
    ipAddress: req.ip,
  });

  return res.json({ ok: true, message: 'Settings saved.', settings: parsed.data });
});

// ── Public "Now Serving" Board Endpoint (/queue) ─────────────────────────────
app.get('/api/queue', (_req, res) => {
  evaluateUnclaimedRulesLazily();
  // Privacy safe: Strictly return queue numbers, statuses, and timestamps. NO names or phones!
  const ready = db.prepare(`
    SELECT id, queue_number, ready_notified_at, last_called_at 
    FROM orders 
    WHERE order_status = 'Ready for Pickup'
    ORDER BY ready_notified_at DESC
    LIMIT 30
  `).all();

  const preparing = db.prepare(`
    SELECT id, queue_number, updated_at 
    FROM orders 
    WHERE order_status IN ('Preparing', 'Processing')
    ORDER BY id ASC
    LIMIT 30
  `).all();

  return res.json({
    ready,
    preparing,
    lastUpdated: new Date().toISOString(),
  });
});

// ── Public Order Tracking Endpoint (/track) ──────────────────────────────────
app.get('/api/track/:tokenOrNumber', (req, res) => {
  evaluateUnclaimedRulesLazily();
  const param = (req.params.tokenOrNumber || '').trim();
  if (!param) {
    return res.status(400).json({ message: 'Tracking reference required.' });
  }

  // Lookup order by tracking_token OR order_number
  let order = db.prepare('SELECT * FROM orders WHERE tracking_token = ?').get(param);
  if (!order) {
    order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(param);
  }

  if (!order) {
    return res.status(404).json({ message: 'Order not found for the provided reference.' });
  }

  const items = db.prepare(`
    SELECT product_name as name, quantity, unit_price, subtotal 
    FROM order_items 
    WHERE order_id = ?
  `).all(order.id);

  const qrData = `GLAZY_CLAIM:${order.order_number}:${order.tracking_token}`;

  // Return non-sensitive, customer-friendly payload
  return res.json({
    orderNumber: order.order_number,
    queueNumber: order.queue_number,
    trackingToken: order.tracking_token,
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    pickupDate: order.pickup_date,
    pickupTime: order.pickup_time,
    totalAmount: order.total_amount,
    readyNotifiedAt: order.ready_notified_at,
    lastCalledAt: order.last_called_at,
    claimedAt: order.claimed_at,
    createdAt: order.created_at,
    items,
    qrData,
  });
});

// ── Web Push Subscription (Optional free VAPID) ──────────────────────────────
app.post('/api/push/subscribe', (req, res) => {
  const { orderNumber, trackingToken, subscription } = req.body || {};
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ message: 'Invalid subscription payload.' });
  }

  let orderId = null;
  if (trackingToken || orderNumber) {
    const o = db.prepare('SELECT id FROM orders WHERE tracking_token = ? OR order_number = ?').get(trackingToken || '', orderNumber || '');
    if (o) orderId = o.id;
  }

  try {
    db.prepare(`
      INSERT INTO push_subscriptions (order_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET order_id = excluded.order_id
    `).run(orderId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
    return res.json({ ok: true, message: 'Push subscription stored successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Could not save push subscription.' });
  }
});

// ── Auto-Cancel Unpaid Orders (Lazy & Cron) ──────────────────────────────────
/**
 * Cancels orders in 'Pending Payment' older than 24 hours.
 * Restores product inventory idempotently (exactly once per cancelled order).
 */
function cancelExpiredOrders() {
  try {
    const staleOrders = db.prepare(`
      SELECT * FROM orders
      WHERE order_status = 'Pending Payment'
        AND datetime(created_at) <= datetime('now', '-24 hours')
    `).all();

    if (!staleOrders || staleOrders.length === 0) {
      return { ok: true, cancelledCount: 0 };
    }

    let cancelledCount = 0;

    const cancelTx = db.transaction(() => {
      for (const order of staleOrders) {
        // Re-check order status inside transaction for idempotency
        const current = db.prepare('SELECT id, order_status FROM orders WHERE id = ?').get(order.id);
        if (!current || current.order_status !== 'Pending Payment') {
          continue;
        }

        // Check if stock was already restored for this order
        const alreadyRestored = db.prepare(
          'SELECT id FROM order_status_history WHERE order_id = ? AND stock_restored = 1'
        ).get(order.id);

        if (!alreadyRestored) {
          const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(order.id);
          for (const item of items) {
            const prod = db.prepare('SELECT id, name, stock_quantity FROM products WHERE id = ?').get(item.product_id);
            if (prod) {
              db.prepare(
                'UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
              ).run(item.quantity, prod.id);

              db.prepare(
                'INSERT INTO stock_adjustments (product_id, change_amount, previous_stock, new_stock, reason, order_id) VALUES (?, ?, ?, ?, ?, ?)'
              ).run(
                prod.id,
                item.quantity,
                prod.stock_quantity,
                prod.stock_quantity + item.quantity,
                `Auto-cancel 24h unpaid: ${order.order_number}`,
                order.id
              );
            }
          }
        }

        db.prepare("UPDATE orders SET order_status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
        db.prepare(
          'INSERT INTO order_status_history (order_id, previous_status, new_status, note, stock_restored) VALUES (?, ?, ?, ?, 1)'
        ).run(order.id, 'Pending Payment', 'Cancelled', 'Auto-cancelled: unpaid for 24 hours');

        cancelledCount++;
      }
    });

    cancelTx();
    return { ok: true, cancelledCount };
  } catch (err) {
    console.error('Error in cancelExpiredOrders:', err);
    return { ok: false, error: err.message, cancelledCount: 0 };
  }
}

// ── Auto-Cancel Unpaid Orders Cron Endpoint ──────────────────────────────────
// Protected with CRON_SECRET (Authorization: Bearer <CRON_SECRET>)
// Idempotent: safe to run multiple times without duplicate stock restorations
app.all('/api/cron/auto-cancel-unpaid', (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ message: 'Unauthorized cron request: invalid or missing CRON_SECRET token.' });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return res.status(401).json({ message: 'CRON_SECRET must be configured in production.' });
  }

  const result = cancelExpiredOrders();
  if (!result.ok) {
    return res.status(500).json({ message: result.error || 'Failed to auto-cancel orders.' });
  }

  return res.json({
    ok: true,
    cancelledCount: result.cancelledCount,
    message: `Auto-cancelled ${result.cancelledCount} unpaid order(s).`,
  });
});

// ── Payment Verification (Admin) ──────────────────────────────────────────────
app.patch('/api/payments/:id/verify', requireAuth, (req, res) => {
  const { action, admin_notes } = req.body || {}; // action: 'verify' | 'reject'
  if (!['verify', 'reject'].includes(action)) {
    return res.status(400).json({ message: "Action must be 'verify' or 'reject'." });
  }

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(Number(req.params.id));
  if (!payment) {
    return res.status(404).json({ message: 'Payment not found.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(payment.order_id);
  if (!order) {
    return res.status(404).json({ message: 'Associated order not found.' });
  }

  const now = new Date().toISOString();

  if (action === 'verify') {
    db.prepare(
      'UPDATE payments SET status = ?, verified_at = ?, admin_notes = ?, paid_at = ? WHERE id = ?'
    ).run('Verified', now, admin_notes || null, now, payment.id);
    db.prepare(
      'UPDATE orders SET payment_status = ?, order_status = ?, updated_at = ? WHERE id = ?'
    ).run('Verified', 'Confirmed', now, order.id);
  } else {
    db.prepare(
      'UPDATE payments SET status = ?, admin_notes = ? WHERE id = ?'
    ).run('Rejected', admin_notes || null, payment.id);
    db.prepare(
      'UPDATE orders SET payment_status = ?, order_status = ?, updated_at = ? WHERE id = ?'
    ).run('Rejected', 'Pending Payment', now, order.id);
  }

  logAudit({
    adminId: req.admin?.id,
    action: action === 'verify' ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
    entityType: 'payment',
    entityId: payment.id,
    details: { orderNumber: order.order_number, amount: payment.amount, reason: admin_notes },
    ipAddress: req.ip,
  });

  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  const updatedPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id);
  return res.json({ order: updatedOrder, payment: updatedPayment });
});

// ── Submit payment reference (Customer) ──────────────────────────────────────
app.patch('/api/orders/:id/payment-reference', (req, res) => {
  const { payment_reference, payment_method } = req.body || {};
  if (!payment_reference || !payment_reference.trim()) {
    return res.status(400).json({ message: 'Payment reference is required.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  const existingPayment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(order.id);
  if (existingPayment) {
    db.prepare(
      'UPDATE payments SET payment_reference = ?, status = ? WHERE id = ?'
    ).run(payment_reference.trim(), 'Pending Verification', existingPayment.id);
  } else {
    db.prepare(
      'INSERT INTO payments (order_id, payment_method, payment_reference, amount, status) VALUES (?, ?, ?, ?, ?)'
    ).run(order.id, payment_method || 'Unknown', payment_reference.trim(), order.total_amount, 'Pending Verification');
  }

  db.prepare(
    'UPDATE orders SET order_status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run('Awaiting Payment Verification', 'Pending Verification', order.id);

  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  return res.json(updatedOrder);
});

// ── Storefront Checkout: Create Order ────────────────────────────────────────
app.post('/api/orders', (req, res) => {
  // Lazily expire overdue unpaid orders to restore inventory prior to checkout
  cancelExpiredOrders();

  const {
    customer,
    paymentMethod,
    paymentReference,
    items,
    pickupDate,
    pickupTime,
    idempotencyKey: bodyKey,
  } = req.body || {};

  const idempotencyKey = bodyKey || req.headers['idempotency-key'] || null;

  if (!customer || !customer.fullName || !customer.address || !customer.contactNumber) {
    return res.status(400).json({ message: 'Customer details (Full Name, Address, Contact Number) are required.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'At least one item is required in the cart.' });
  }

  if (!paymentMethod) {
    return res.status(400).json({ message: 'Payment method is required.' });
  }

  // Idempotency check: if key already exists, return the existing order safely
  if (idempotencyKey) {
    try {
      const existing = db.prepare('SELECT * FROM orders WHERE idempotency_key = ?').get(idempotencyKey);
      if (existing) {
        return res.status(200).json({
          message: 'Order already processed.',
          order: existing,
          idempotent: true,
        });
      }
    } catch (_e) {}
  }

  const tx = db.transaction(() => {
    const normalizedItems = [];
    let totalAmount = 0;

    // 1. Verify items & calculate prices strictly from the server database
    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(item.productId));
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for product ${product.name}`);
      }

      // Check stock
      if (quantity > product.stock_quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Only ${product.stock_quantity} available.`);
      }

      const unitPrice = Number(product.price);
      const subtotal = unitPrice * quantity;

      normalizedItems.push({
        product,
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice,
        subtotal,
      });
      totalAmount += subtotal;
    }

    // 2. Atomic stock deduction preventing overselling
    for (const item of normalizedItems) {
      const deductResult = db.prepare(
        'UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock_quantity >= ?'
      ).run(item.quantity, item.productId, item.quantity);

      if (deductResult.changes === 0) {
        throw new Error(`Insufficient stock for ${item.productName}. Could not reserve inventory.`);
      }
    }

    // 3. Safe sequential order number generation
    const maxOrder = db.prepare('SELECT MAX(id) as max_id FROM orders').get();
    const nextId = (maxOrder?.max_id ? Number(maxOrder.max_id) : 0) + 1;
    const nextSeq = 100246 + nextId;
    const orderNumber = `ORD-${nextSeq}`;
    const queueNumber = generateQueueNumber(nextId);
    const trackingToken = uuidv4().replace(/-/g, '');

    const initialOrderStatus = paymentReference && paymentReference.trim()
      ? 'Awaiting Payment Verification'
      : 'Pending Payment';
    const initialPaymentStatus = 'Pending Verification';

    // 4. Create Order Record
    const orderResult = db.prepare(`
      INSERT INTO orders (
        order_number, queue_number, tracking_token, customer_name, customer_contact, customer_email,
        customer_address, customer_id, total_amount, payment_status,
        order_status, pickup_date, pickup_time, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderNumber,
      queueNumber,
      trackingToken,
      customer.fullName,
      customer.contactNumber || '',
      customer.email || '',
      customer.address || '',
      customer.id || req.body.customerId || null,
      totalAmount,
      initialPaymentStatus,
      initialOrderStatus,
      pickupDate || '',
      pickupTime || '',
      idempotencyKey || null
    );

    const orderId = Number(orderResult.lastInsertRowid);

    // 5. Create Order Items (snapshotting product name and price at purchase)
    for (const item of normalizedItems) {
      db.prepare(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(orderId, item.productId, item.productName, item.quantity, item.unitPrice, item.subtotal);

      // Log stock adjustment
      db.prepare(
        'INSERT INTO stock_adjustments (product_id, change_amount, previous_stock, new_stock, reason, order_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        item.productId,
        -item.quantity,
        item.product.stock_quantity,
        item.product.stock_quantity - item.quantity,
        `Order placed: ${orderNumber}`,
        orderId
      );
    }

    // 6. Create Initial Payment Record
    db.prepare(
      'INSERT INTO payments (order_id, payment_method, payment_reference, amount, status) VALUES (?, ?, ?, ?, ?)'
    ).run(
      orderId,
      paymentMethod,
      paymentReference ? paymentReference.trim() : null,
      totalAmount,
      'Pending Verification'
    );

    // 7. Record in order status history
    db.prepare(
      'INSERT INTO order_status_history (order_id, previous_status, new_status, note) VALUES (?, ?, ?, ?)'
    ).run(orderId, null, initialOrderStatus, 'Order placed by customer');

    return {
      orderId,
      orderNumber,
      queueNumber,
      trackingToken,
      totalAmount,
      orderStatus: initialOrderStatus,
      paymentStatus: initialPaymentStatus,
    };
  });

  try {
    const result = tx();
    return res.status(201).json({
      message: 'Order placed successfully. Payment is pending verification by our team.',
      order: {
        id: result.orderId,
        order_number: result.orderNumber,
        queue_number: result.queueNumber,
        tracking_token: result.trackingToken,
        total_amount: result.totalAmount,
        order_status: result.orderStatus,
        payment_status: result.paymentStatus,
      },
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Order creation failed.' });
  }
});

app.get('/api/payments', requireAuth, (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*, o.order_number, o.customer_name, o.customer_email, o.customer_contact,
           o.order_status, o.total_amount as order_total
    FROM payments p
    LEFT JOIN orders o ON p.order_id = o.id
    ORDER BY p.created_at DESC
  `).all();
  return res.json(rows);
});

app.get('/api/sales', requireAuth, (_req, res) => {
  cancelExpiredOrders();
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_orders,
      SUM(CASE WHEN payment_status = 'Verified' THEN 1 ELSE 0 END) AS paid_orders,
      SUM(CASE WHEN order_status = 'Completed' THEN 1 ELSE 0 END) AS completed_orders,
      SUM(CASE WHEN order_status IN ('Pending Payment','Awaiting Payment Verification') THEN 1 ELSE 0 END) AS pending_orders,
      SUM(CASE WHEN order_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
      SUM(CASE WHEN payment_status = 'Pending Verification' THEN 1 ELSE 0 END) AS pending_verification_orders,
      COALESCE(SUM(CASE WHEN payment_status = 'Verified' THEN total_amount ELSE 0 END), 0) AS total_sales
    FROM orders
  `).get();

  const history = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  return res.json({ stats, history });
});

app.get('/api/receipts/:orderNumber', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber);
  if (!order) {
    return res.status(404).json({ message: 'Receipt not found.' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(order.id);
  const receipt = {
    storeName: 'Glazy Day Donuts',
    orderNumber: order.order_number,
    orderDate: order.created_at,
    orderTime: order.created_at,
    items: items.map((item) => ({
      name: item.product_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      subtotal: Number(item.subtotal),
    })),
    totalAmount: Number(order.total_amount),
    queueNumber: order.queue_number,
    trackingToken: order.tracking_token,
    readyNotifiedAt: order.ready_notified_at,
    paymentMethod: payments[0]?.payment_method || 'N/A',
    paymentReference: payments[0]?.payment_reference || null,
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    pickupDate: order.pickup_date,
    pickupTime: order.pickup_time,
    pickupInstructions: 'Please arrive during your selected pickup window.',
  };

  return res.json(receipt);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error.' });
});

function startServer() {
  if (
    process.env.NODE_ENV === 'test' ||
    process.argv.includes('--test') ||
    process.execArgv.includes('--test') ||
    process.env.VERCEL
  ) {
    return;
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`Port ${PORT} is already in use. Skipping backend startup.`);
      return;
    }

    throw error;
  });
}

startServer();

export { app, initializeDatabase, db, cancelExpiredOrders };
