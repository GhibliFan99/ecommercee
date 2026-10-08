process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { app, initializeDatabase, db } from './index.js';

const baseUrl = 'http://127.0.0.1:3456';

let server;

test.before(async () => {
  initializeDatabase();
  server = app.listen(3456);
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('admin login succeeds with seeded credentials', async () => {
  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.token);
});

test('guest checkout rejects order when quantity exceeds stock', async () => {
  const productResponse = await fetch(`${baseUrl}/api/products`);
  const products = await productResponse.json();
  const product = products[0];

  const payload = {
    customer: {
      fullName: 'Jane Doe',
      address: '123 Main Street',
      contactNumber: '09123456789',
      email: 'jane@example.com',
    },
    paymentMethod: 'GCash',
    items: [{ productId: product.id, quantity: product.stock_quantity + 500 }],
  };

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 400);
  const data = await response.json();
  assert.match(data.message, /stock|available|insufficient/i);
});

test('guest checkout assigns queue_number, tracking_token and creates payment', async () => {
  const productResponse = await fetch(`${baseUrl}/api/products`);
  const products = await productResponse.json();
  const product = products[0];

  const payload = {
    customer: {
      fullName: 'Test Customer',
      address: '456 Acacia Ave, QC',
      contactNumber: '09181234567',
      email: 'test@glazy.com',
    },
    paymentMethod: 'GCash',
    paymentReference: 'GCASH-TEST-999',
    items: [{ productId: product.id, quantity: 2 }],
  };

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.ok(data.order.order_number);
  assert.ok(data.order.queue_number, 'Queue number must be generated (e.g. A-001)');
  assert.ok(data.order.tracking_token, 'Tracking token must be generated');
  assert.match(data.order.queue_number, /^[A-Z]-\d{3}$/);
});

test('ready to claim notification trigger is idempotent and call number is rate limited', async () => {
  // 1. Login as admin
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const { token } = await loginRes.json();
  const authHeader = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 2. Create order
  const productResponse = await fetch(`${baseUrl}/api/products`);
  const products = await productResponse.json();
  const prod = products[0];

  const orderRes = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: { fullName: 'Idempotency Tester', address: 'BGC Taguig', contactNumber: '09170001122' },
      paymentMethod: 'GCash',
      paymentReference: 'GCASH-IDEM-01',
      items: [{ productId: prod.id, quantity: 1 }],
    }),
  });
  const { order } = await orderRes.json();

  // 3. Mark Ready for Pickup
  const readyRes1 = await fetch(`${baseUrl}/api/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: authHeader,
    body: JSON.stringify({ order_status: 'Ready for Pickup' }),
  });
  assert.equal(readyRes1.status, 200);

  // Check notification was logged in database
  const notif1 = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE order_id = ? AND type = ?').get(order.id, 'ready');
  assert.equal(notif1.c, 1, 'Should create exactly 1 ready notification');

  // 4. Mark Ready for Pickup again (simulate double-click / retry)
  const readyRes2 = await fetch(`${baseUrl}/api/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: authHeader,
    body: JSON.stringify({ order_status: 'Ready for Pickup' }),
  });
  assert.equal(readyRes2.status, 200);

  const notif2 = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE order_id = ? AND type = ?').get(order.id, 'ready');
  assert.equal(notif2.c, 1, 'Must NOT duplicate ready notifications (Idempotent)');

  // 5. Test "Call number" endpoint rate limit (cooldown 30s)
  const callRes1 = await fetch(`${baseUrl}/api/orders/${order.id}/call`, {
    method: 'POST',
    headers: authHeader,
  });
  assert.equal(callRes1.status, 200);
  const callData1 = await callRes1.json();
  assert.ok(callData1.ok);

  // Calling again immediately should return 429
  const callRes2 = await fetch(`${baseUrl}/api/orders/${order.id}/call`, {
    method: 'POST',
    headers: authHeader,
  });
  assert.equal(callRes2.status, 429);
  const callData2 = await callRes2.json();
  assert.match(callData2.message, /wait \d+s/i);

  // 6. Test Claim Verification with QR payload
  const qrData = `GLAZY_CLAIM:${order.order_number}:${order.tracking_token}`;
  const claimRes = await fetch(`${baseUrl}/api/orders/claim-verify`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ qrData }),
  });
  assert.equal(claimRes.status, 200);
  const claimData = await claimRes.json();
  assert.ok(claimData.ok);
  assert.equal(claimData.order.order_status, 'Completed');

  // Claiming again should be rejected as already claimed
  const reClaimRes = await fetch(`${baseUrl}/api/orders/claim-verify`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ qrData }),
  });
  assert.equal(reClaimRes.status, 400);
  const reClaimData = await reClaimRes.json();
  assert.ok(reClaimData.alreadyClaimed);
});

test('public /api/queue board and /api/track endpoints protect customer privacy', async () => {
  // Test queue board
  const queueRes = await fetch(`${baseUrl}/api/queue`);
  assert.equal(queueRes.status, 200);
  const queueData = await queueRes.json();
  assert.ok(Array.isArray(queueData.ready));
  assert.ok(Array.isArray(queueData.preparing));

  if (queueData.ready.length > 0) {
    const item = queueData.ready[0];
    assert.ok(item.queue_number);
    assert.equal(item.customer_name, undefined, 'Must NOT leak customer name');
    assert.equal(item.customer_contact, undefined, 'Must NOT leak customer phone');
    assert.equal(item.customer_email, undefined, 'Must NOT leak customer email');
  }

  // Test tracking endpoint
  const trackRes = await fetch(`${baseUrl}/api/track/ORD-100246`);
  // If order exists, ensure minimal sanitized data
  if (trackRes.status === 200) {
    const trackData = await trackRes.json();
    assert.ok(trackData.orderNumber);
    assert.ok(trackData.qrData);
    assert.equal(trackData.password_hash, undefined);
  }
});
