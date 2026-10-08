import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { getClient, pool, pesosToCentavos } from './db.js';

dotenv.config();

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

export async function seedDatabase() {
  if (!pool) {
    console.warn('DATABASE_URL is not configured. Skipping database seeding.');
    return;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Seed ONE Admin Account (owner role)
    const adminEmail = process.env.ADMIN_EMAIL || 'grace@glazydays.com';
    const adminUsername = process.env.ADMIN_USERNAME || 'grace';
    const rawPassword = process.env.ADMIN_PASSWORD || 'grace123';
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    const existingAdmin = await client.query(
      'SELECT id FROM admins WHERE email = $1 OR username = $2',
      [adminEmail, adminUsername]
    );

    if (existingAdmin.rows.length === 0) {
      await client.query(
        `INSERT INTO admins (username, email, password_hash, role)
         VALUES ($1, $2, $3, 'owner')`,
        [adminUsername, adminEmail, passwordHash]
      );
      console.log(`✓ Seeded owner admin account: ${adminEmail}`);
    } else {
      // Update password hash from env to keep in sync
      await client.query(
        `UPDATE admins SET password_hash = $1, role = 'owner', updated_at = NOW() WHERE id = $2`,
        [passwordHash, existingAdmin.rows[0].id]
      );
      console.log(`✓ Updated owner admin account: ${adminEmail}`);
    }

    // 2. Seed Initial Products (if products table is empty)
    const { rows: countRows } = await client.query('SELECT COUNT(*) as count FROM products WHERE is_deleted = false');
    const productCount = parseInt(countRows[0].count, 10);

    if (productCount === 0) {
      for (const p of seededProducts) {
        await client.query(
          `INSERT INTO products (name, description, price_centavos, image_url, stock_quantity, is_active)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [p.name, p.description, pesosToCentavos(p.price), p.image, p.stock_quantity]
        );
      }
      console.log(`✓ Seeded ${seededProducts.length} initial products (stored in integer centavos).`);
    } else {
      console.log(`- Products table already contains ${productCount} products. Skipping product seeding.`);
    }

    await client.query('COMMIT');
    console.log('Database seeding finished successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => {
      console.log('Seed completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
