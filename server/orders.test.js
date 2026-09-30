process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { app, initializeDatabase } from './index.js';

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

  const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const { token } = await loginResponse.json();

  const payload = {
    customer: {
      fullName: 'Jane Doe',
      address: '123 Main Street',
      contactNumber: '09123456789',
      email: 'jane@example.com',
    },
    paymentMethod: 'GCash',
    items: [{ productId: product.id, quantity: product.stock_quantity + 5 }],
  };

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 400);
  const data = await response.json();
  assert.match(data.message, /stock|available|insufficient/i);
});
