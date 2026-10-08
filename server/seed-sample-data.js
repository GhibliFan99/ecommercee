import { db } from './index.js';
import bcrypt from 'bcryptjs';

export function seedSampleData() {
  console.log('Seeding rich sample data for Glazy Days...');

  // 1. Ensure Grace admin exists
  const graceHash = bcrypt.hashSync('grace123', 10);
  const grace = db.prepare('SELECT id FROM admins WHERE username = ? OR email = ?').get('grace', 'grace@glazydays.com');
  if (!grace) {
    db.prepare('INSERT INTO admins (username, email, password_hash, role) VALUES (?, ?, ?, ?)').run('grace', 'grace@glazydays.com', graceHash, 'owner');
  } else {
    db.prepare('UPDATE admins SET password_hash = ?, role = ? WHERE id = ?').run(graceHash, 'owner', grace.id);
  }

  // 2. Sample Customers
  const sampleCustomers = [
    { name: 'Maria Clara Santos', email: 'maria.santos@gmail.com', phone: '0917-882-3491', address: 'Block 4 Lot 12, Camella Homes, Antipolo City' },
    { name: 'Juan Dela Cruz', email: 'juan.delacruz@yahoo.com', phone: '0928-554-1290', address: '145 Katipunan Ave, Quezon City' },
    { name: 'Bea Alonzo', email: 'bea.alonzo@gmail.com', phone: '0918-345-6789', address: '22 Acacia St., Valle Verde 3, Pasig City' },
    { name: 'Carlos Yulo', email: 'carlos.yulo@gmail.com', phone: '0998-123-9876', address: 'Malate, Manila' },
    { name: 'Angel Locsin', email: 'angel.locsin@gmail.com', phone: '0917-998-8776', address: 'BGC, Taguig City' }
  ];

  const custMap = {};
  for (const c of sampleCustomers) {
    let existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(c.email);
    if (!existing) {
      const dummyPass = bcrypt.hashSync('customer123', 10);
      const res = db.prepare(
        'INSERT INTO customers (full_name, email, contact_number, address, password_hash) VALUES (?, ?, ?, ?, ?)'
      ).run(c.name, c.email, c.phone, c.address, dummyPass);
      custMap[c.email] = Number(res.lastInsertRowid);
    } else {
      custMap[c.email] = existing.id;
    }
  }

  // 3. Products lookup
  const products = db.prepare('SELECT * FROM products').all();
  if (products.length === 0) {
    console.warn('No products found to attach to sample orders.');
    return;
  }

  // Ensure stock is healthy with 1 low stock
  db.prepare('UPDATE products SET stock_quantity = 25, availability = 1').run();
  db.prepare('UPDATE products SET stock_quantity = 3 WHERE name LIKE ?').run('%Pistachio%');

  // 4. Sample Orders to insert
  const sampleOrders = [
    {
      customer: sampleCustomers[0], // Maria
      paymentMethod: 'GCash',
      paymentReference: 'GCASH-982143098',
      pickupDate: '2026-10-09',
      pickupTime: '2:00 PM - 3:00 PM',
      orderStatus: 'Awaiting Payment Verification',
      paymentStatus: 'Pending Verification',
      createdAt: '2026-10-09 10:15:00',
      items: [
        { prodIndex: 0, qty: 3 }, // Choco Star
        { prodIndex: 1, qty: 3 }  // Classic Glaze
      ]
    },
    {
      customer: sampleCustomers[1], // Juan
      paymentMethod: 'Maya',
      paymentReference: 'MAYA-448190223',
      pickupDate: '2026-10-09',
      pickupTime: '4:00 PM - 5:00 PM',
      orderStatus: 'Awaiting Payment Verification',
      paymentStatus: 'Pending Verification',
      createdAt: '2026-10-09 11:30:00',
      items: [
        { prodIndex: 2, qty: 2 }, // Nutty Crunch
        { prodIndex: 4, qty: 2 }, // Cookie Crumble
        { prodIndex: 11, qty: 2 } // Strawberry Dream
      ]
    },
    {
      customer: sampleCustomers[2], // Bea
      paymentMethod: 'GCash',
      paymentReference: 'GCASH-119283741',
      pickupDate: '2026-10-09',
      pickupTime: '1:00 PM - 2:00 PM',
      orderStatus: 'Ready for Pickup',
      paymentStatus: 'Verified',
      verifiedAt: '2026-10-09 09:30:00',
      createdAt: '2026-10-09 08:45:00',
      items: [
        { prodIndex: 1, qty: 6 }, // Classic Glaze box
        { prodIndex: 5, qty: 6 }  // Caramel Cloud
      ]
    },
    {
      customer: sampleCustomers[3], // Carlos
      paymentMethod: 'GCash',
      paymentReference: 'GCASH-771239845',
      pickupDate: '2026-10-08',
      pickupTime: '11:00 AM - 12:00 PM',
      orderStatus: 'Completed',
      paymentStatus: 'Verified',
      verifiedAt: '2026-10-08 10:20:00',
      createdAt: '2026-10-08 09:15:00',
      items: [
        { prodIndex: 0, qty: 4 },
        { prodIndex: 2, qty: 4 },
        { prodIndex: 3, qty: 4 }
      ]
    },
    {
      customer: sampleCustomers[4], // Angel
      paymentMethod: 'Cash on Pickup',
      paymentReference: null,
      pickupDate: '2026-10-08',
      pickupTime: '3:00 PM - 4:00 PM',
      orderStatus: 'Completed',
      paymentStatus: 'Verified',
      verifiedAt: '2026-10-08 15:10:00',
      createdAt: '2026-10-08 14:00:00',
      items: [
        { prodIndex: 6, qty: 2 },
        { prodIndex: 7, qty: 2 }
      ]
    },
    {
      customer: sampleCustomers[0], // Maria (2nd order)
      paymentMethod: 'GCash',
      paymentReference: 'GCASH-552819034',
      pickupDate: '2026-10-09',
      pickupTime: '5:00 PM - 6:00 PM',
      orderStatus: 'Confirmed',
      paymentStatus: 'Verified',
      verifiedAt: '2026-10-09 12:10:00',
      createdAt: '2026-10-09 11:55:00',
      items: [
        { prodIndex: 1, qty: 4 },
        { prodIndex: 11, qty: 4 }
      ]
    }
  ];

  // Insert orders transactionally
  const insertAll = db.transaction(() => {
    for (const data of sampleOrders) {
      // Calculate order total
      let totalAmount = 0;
      const orderItems = [];

      for (const item of data.items) {
        const prod = products[item.prodIndex % products.length];
        const unitPrice = Number(prod.price);
        const subtotal = unitPrice * item.qty;
        totalAmount += subtotal;
        orderItems.push({ prod, unitPrice, qty: item.qty, subtotal });
      }

      // Next order number
      const nextNum = db.prepare('SELECT COUNT(*) as count FROM orders').get().count + 1;
      const orderNumber = `ORD-${String(nextNum).padStart(6, '0')}`;
      const custId = custMap[data.customer.email] || null;

      const orderResult = db.prepare(`
        INSERT INTO orders (
          order_number, customer_name, customer_contact, customer_email,
          customer_address, customer_id, total_amount, payment_status,
          order_status, pickup_date, pickup_time, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderNumber,
        data.customer.name,
        data.customer.phone,
        data.customer.email,
        data.customer.address,
        custId,
        totalAmount,
        data.paymentStatus,
        data.orderStatus,
        data.pickupDate,
        data.pickupTime,
        data.createdAt,
        data.createdAt
      );

      const orderId = Number(orderResult.lastInsertRowid);

      // Order items
      for (const oi of orderItems) {
        db.prepare(`
          INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(orderId, oi.prod.id, oi.prod.name, oi.qty, oi.unitPrice, oi.subtotal);
      }

      // Payment record
      db.prepare(`
        INSERT INTO payments (order_id, payment_method, payment_reference, amount, status, verified_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        data.paymentMethod,
        data.paymentReference,
        totalAmount,
        data.paymentStatus,
        data.verifiedAt || null,
        data.createdAt
      );

      // Order status history
      db.prepare(`
        INSERT INTO order_status_history (order_id, previous_status, new_status, note, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(orderId, null, data.orderStatus, `Initial state: ${data.orderStatus}`, data.createdAt);
    }
  });

  insertAll();
  console.log('Successfully inserted sample orders, payments, customers, and inventory!');
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('seed-sample-data.js')) {
  seedSampleData();
  process.exit(0);
}
