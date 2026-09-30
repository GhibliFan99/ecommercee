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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFilePath = path.join(__dirname, 'database.sqlite');
const app = express();
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const db = new Database(dbFilePath);
db.pragma('journal_mode = WAL');

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
  `);

  const adminExists = db.prepare('SELECT 1 FROM admins WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      'INSERT INTO admins (username, email, password_hash) VALUES (?, ?, ?)'
    ).run('admin', 'admin@glazydays.com', hash);
  }

  const graceExists = db.prepare('SELECT 1 FROM admins WHERE username = ?').get('grace123');
  if (!graceExists) {
    const graceHash = bcrypt.hashSync('grace123', 10);
    db.prepare(
      'INSERT INTO admins (username, email, password_hash) VALUES (?, ?, ?)'
    ).run('grace123', 'grace@glazydays.com', graceHash);
  } else {
    // Ensure password is grace123 in case it was created with another pass
    const graceHash = bcrypt.hashSync('grace123', 10);
    db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?').run(graceHash, 'grace123');
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

function tokenForAdmin(admin) {
  return jwt.sign({ sub: String(admin.id), username: admin.username, role: 'admin' }, JWT_SECRET, {
    expiresIn: '8h',
  });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
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

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE username = ? OR email = ?').get(username, username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ message: 'Invalid admin credentials.' });
  }

  const token = tokenForAdmin(admin);
  return res.json({ token, admin: { id: admin.id, username: admin.username, email: admin.email } });
});

app.post('/api/admin/logout', (_req, res) => {
  return res.json({ message: 'Logged out successfully.' });
});

app.get('/api/admin/verify', requireAuth, (req, res) => {
  return res.json({ ok: true, admin: req.admin });
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

app.delete('/api/products/:id', requireAuth, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(product.id);
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
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  return res.json(orders);
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
  const { order_status } = req.body || {};
  const allowed = ['Pending Payment', 'Awaiting Payment Verification', 'Confirmed', 'Processing', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled'];

  if (!allowed.includes(order_status)) {
    return res.status(400).json({ message: 'Invalid order status.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  db.prepare('UPDATE orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(order_status, order.id);
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  return res.json(updated);
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

  // Update payment record with reference number and set status to Pending Verification
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

  // Update order status to indicate payment was submitted
  db.prepare(
    'UPDATE orders SET order_status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run('Awaiting Payment Verification', 'Pending Verification', order.id);

  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  return res.json(updatedOrder);
});

app.post('/api/orders', (req, res) => {
  const { customer, paymentMethod, paymentReference, items, pickupDate, pickupTime } = req.body || {};

  if (!customer || !customer.fullName || !customer.address || !customer.contactNumber) {
    return res.status(400).json({ message: 'Customer details are required.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'At least one item is required.' });
  }

  if (!paymentMethod) {
    return res.status(400).json({ message: 'Payment method is required.' });
  }

  const tx = db.transaction(() => {
    const normalizedItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(item.productId));
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for product ${product.name}`);
      }
      if (quantity > product.stock_quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      const unitPrice = Number(product.price);
      const subtotal = unitPrice * quantity;
      normalizedItems.push({
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice,
        subtotal,
      });
      totalAmount += subtotal;
    }

    const orderNumber = db.prepare('SELECT COUNT(*) as count FROM orders').get().count + 1;

    // Determine initial order & payment status based on whether a reference was submitted
    const initialOrderStatus = paymentReference && paymentReference.trim()
      ? 'Awaiting Payment Verification'
      : 'Pending Payment';
    const initialPaymentStatus = paymentReference && paymentReference.trim()
      ? 'Pending Verification'
      : 'Pending Verification';

    const orderResult = db.prepare(
      'INSERT INTO orders (order_number, customer_name, customer_contact, customer_email, customer_address, customer_id, total_amount, payment_status, order_status, pickup_date, pickup_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      formatOrderNumber(orderNumber),
      customer.fullName,
      customer.contactNumber || '',
      customer.email || '',
      customer.address || '',
      customer.id || req.body.customerId || null,
      totalAmount,
      initialPaymentStatus,
      initialOrderStatus,
      pickupDate || '',
      pickupTime || ''
    );

    const orderId = Number(orderResult.lastInsertRowid);

    for (const item of normalizedItems) {
      db.prepare(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(orderId, item.productId, item.productName, item.quantity, item.unitPrice, item.subtotal);

      db.prepare(
        'UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(item.quantity, item.productId);
    }

    // Create payment record — reference number is stored as supporting info only,
    // NOT as proof of payment. Status stays 'Pending Verification' until admin verifies.
    db.prepare(
      'INSERT INTO payments (order_id, payment_method, payment_reference, amount, status) VALUES (?, ?, ?, ?, ?)'
    ).run(
      orderId,
      paymentMethod,
      paymentReference ? paymentReference.trim() : null,
      totalAmount,
      'Pending Verification'
    );

    return {
      orderId,
      orderNumber: formatOrderNumber(orderNumber),
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
  if (process.env.NODE_ENV === 'test' || process.argv.includes('--test')) {
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

export { app, initializeDatabase, db };
