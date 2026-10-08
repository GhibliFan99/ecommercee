import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getClient, pool } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, 'migrations');

export async function runMigrations() {
  if (!pool) {
    console.warn('DATABASE_URL is not set. Skipping PostgreSQL migrations.');
    return;
  }

  const client = await getClient();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const { rows } = await client.query('SELECT name FROM _migrations');
    const applied = new Set(rows.map((r) => r.name));

    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (!applied.has(file)) {
        console.log(`Applying migration: ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`✓ Migration applied: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`✗ Error applying migration ${file}:`, err);
          throw err;
        }
      } else {
        console.log(`- Migration already applied: ${file}`);
      }
    }
    console.log('All migrations applied successfully.');
  } finally {
    client.release();
  }
}

// Allow standalone execution via `node server/migrate.js`
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(() => {
      console.log('Migration process completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
