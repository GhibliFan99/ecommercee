import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

const poolConfig = {
  connectionString,
  max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

if (connectionString && (connectionString.includes('sslmode=require') || process.env.NODE_ENV === 'production')) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

export const pool = connectionString ? new Pool(poolConfig) : null;

pool?.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export async function query(text, params) {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured. Please set DATABASE_URL in environment variables.');
  }
  return pool.query(text, params);
}

export async function getClient() {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured. Please set DATABASE_URL in environment variables.');
  }
  return pool.connect();
}

/**
 * Currency utilities: Store all currency as integer centavos (PHP 1.00 = 100 centavos)
 */
export function pesosToCentavos(amount) {
  if (amount === null || amount === undefined) return 0;
  return Math.round(Number(amount) * 100);
}

export function centavosToPesos(centavos) {
  if (centavos === null || centavos === undefined) return 0;
  return Number((Number(centavos) / 100).toFixed(2));
}

export function formatPesos(centavos) {
  const pesos = centavosToPesos(centavos);
  return `₱${pesos.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatOrderNumber(seq) {
  return `ORD-${String(seq).padStart(6, '0')}`;
}
