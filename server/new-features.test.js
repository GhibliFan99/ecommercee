process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { app, initializeDatabase, db } from './index.js';

const baseUrl = 'http://127.0.0.1:3457';

let server;
let adminToken = '';

test.before(async () => {
  initializeDatabase();
  server = app.listen(3457);

  // Authenticate admin
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const data = await loginRes.json();
  adminToken = data.token;
});

test.after(async () => {
  // Reset last call override to auto so state is preserved
  try {
    await fetch(`${baseUrl}/api/admin/last-call/toggle-override`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ mode: 'auto' }),
    });
  } catch (_ignore) {}

  await new Promise((resolve) => server.close(resolve));
});

test('Best Seller Chart API returns products with sales, revenue, stock, and honors period filters', async () => {
  // Test All-Time period
  const allRes = await fetch(`${baseUrl}/api/analytics/best-sellers?period=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(allRes.status, 200);
  const allData = await allRes.json();

  assert.ok(Array.isArray(allData.bestSellers));
  assert.ok(allData.bestSellers.length > 0);
  assert.ok(allData.summary.totalUnitsSold >= 0);

  // Verify required fields exist for each item
  const top = allData.bestSellers[0];
  assert.ok(top.productName, 'productName must exist');
  assert.equal(typeof top.unitsSold, 'number', 'unitsSold must be a number');
  assert.equal(typeof top.currentStock, 'number', 'currentStock must be a number');
  assert.equal(typeof top.salesRevenue, 'number', 'salesRevenue must be a number');

  // Test This Month filter
  const monthRes = await fetch(`${baseUrl}/api/analytics/best-sellers?period=month`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(monthRes.status, 200);
  const monthData = await monthRes.json();
  assert.equal(monthData.period, 'month');

  // Test Custom Date Range filter
  const customRes = await fetch(`${baseUrl}/api/analytics/best-sellers?period=custom&startDate=2026-10-01&endDate=2026-10-31`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(customRes.status, 200);
  const customData = await customRes.json();
  assert.equal(customData.period, 'custom');
  assert.ok(customData.summary.totalUnitsSold >= 0);
});

test('Last Call Deals admin settings and evaluation endpoints function correctly', async () => {
  // 1. Get settings
  const getRes = await fetch(`${baseUrl}/api/admin/last-call/settings`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(getRes.status, 200);
  const initial = await getRes.json();
  assert.ok(initial.settings);
  assert.equal(typeof initial.settings.minStock, 'number');
  assert.equal(typeof initial.settings.minDiscount, 'number');
  assert.equal(typeof initial.settings.maxDiscount, 'number');

  // 2. Update settings (change minDiscount to 20%, maxDiscount to 40%)
  const updateRes = await fetch(`${baseUrl}/api/admin/last-call/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      minStock: 5,
      minDiscount: 20,
      maxDiscount: 40,
      maxDailySales: 3,
      excludedProductIds: [18],
    }),
  });
  assert.equal(updateRes.status, 200);
  const updated = await updateRes.json();
  assert.equal(updated.settings.minDiscount, 20);
  assert.equal(updated.settings.maxDiscount, 40);

  // 3. Verify public endpoint returns deals
  const publicRes = await fetch(`${baseUrl}/api/last-call/deals`);
  assert.equal(publicRes.status, 200);
  const publicData = await publicRes.json();
  assert.ok(publicData.windowStatus);
});

test('Last Call Deals: force active override applies discount without creating duplicate inventory', async () => {
  const initialProductCount = db.prepare('SELECT count(*) as count FROM products').get().count;

  // Toggle override to force_on
  const toggleRes = await fetch(`${baseUrl}/api/admin/last-call/toggle-override`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ mode: 'force_on' }),
  });
  assert.equal(toggleRes.status, 200);
  const toggleData = await toggleRes.json();
  assert.equal(toggleData.windowStatus.active, true);
  assert.ok(toggleData.activeDeals.length > 0);

  // Fetch /api/products while deal is active
  const productsRes = await fetch(`${baseUrl}/api/products`);
  const products = await productsRes.json();

  const dealProduct = products.find((p) => p.is_last_call);
  assert.ok(dealProduct, 'At least one product should have is_last_call = true');
  assert.ok(dealProduct.original_price > dealProduct.price, 'Price should be discounted');
  assert.ok(dealProduct.discount_percentage >= 20, 'Discount percentage applied');

  // Verify inventory record count has NOT changed
  const postProductCount = db.prepare('SELECT count(*) as count FROM products').get().count;
  assert.equal(postProductCount, initialProductCount, 'Product count must remain unchanged');

  // Reset override
  await fetch(`${baseUrl}/api/admin/last-call/toggle-override`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ mode: 'auto' }),
  });
});
