import { pool, query } from '../db.js';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const WINDOW_MINUTES = 15;

// In-memory fallback if database query fails or during cold start
const inMemoryCache = new Map();

export async function checkRateLimit(key, sqliteDb = null) {
  const now = new Date();

  try {
    if (pool) {
      const res = await query('SELECT points, last_attempt, locked_until FROM rate_limits WHERE key = $1', [key]);
      if (res.rows.length > 0) {
        const { points, last_attempt, locked_until } = res.rows[0];

        if (locked_until && new Date(locked_until) > now) {
          const remainingSec = Math.ceil((new Date(locked_until) - now) / 1000);
          return {
            allowed: false,
            remainingSeconds: remainingSec,
            message: `Account temporarily locked due to multiple failed attempts. Try again in ${Math.ceil(remainingSec / 60)} minutes.`,
          };
        }

        // Reset if window has elapsed
        if (new Date(last_attempt).getTime() + WINDOW_MINUTES * 60 * 1000 < now.getTime()) {
          await query('DELETE FROM rate_limits WHERE key = $1', [key]);
          return { allowed: true, points: 0 };
        }

        return { allowed: true, points: Number(points) };
      }
      return { allowed: true, points: 0 };
    }

    if (sqliteDb) {
      sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          key TEXT PRIMARY KEY,
          points INTEGER NOT NULL DEFAULT 0,
          last_attempt TEXT NOT NULL,
          locked_until TEXT
        );
      `);
      const row = sqliteDb.prepare('SELECT points, last_attempt, locked_until FROM rate_limits WHERE key = ?').get(key);
      if (row) {
        if (row.locked_until && new Date(row.locked_until) > now) {
          const remainingSec = Math.ceil((new Date(row.locked_until) - now) / 1000);
          return {
            allowed: false,
            remainingSeconds: remainingSec,
            message: `Account temporarily locked due to multiple failed attempts. Try again in ${Math.ceil(remainingSec / 60)} minutes.`,
          };
        }
        if (new Date(row.last_attempt).getTime() + WINDOW_MINUTES * 60 * 1000 < now.getTime()) {
          sqliteDb.prepare('DELETE FROM rate_limits WHERE key = ?').run(key);
          return { allowed: true, points: 0 };
        }
        return { allowed: true, points: row.points };
      }
      return { allowed: true, points: 0 };
    }
  } catch (err) {
    console.warn('Rate limit query warning:', err.message);
  }

  // Memory fallback
  const record = inMemoryCache.get(key);
  if (record && record.lockedUntil && record.lockedUntil > now) {
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingSeconds: remainingSec,
      message: `Account temporarily locked. Try again in ${Math.ceil(remainingSec / 60)} minutes.`,
    };
  }
  return { allowed: true, points: record?.points || 0 };
}

export async function recordFailedAttempt(key, sqliteDb = null) {
  const now = new Date();
  const lockoutTime = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);

  try {
    if (pool) {
      const current = await checkRateLimit(key);
      const nextPoints = (current.points || 0) + 1;
      const willLock = nextPoints >= MAX_ATTEMPTS;

      await query(
        `INSERT INTO rate_limits (key, points, last_attempt, locked_until)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (key) DO UPDATE
         SET points = $2,
             last_attempt = $3,
             locked_until = CASE WHEN $2 >= ${MAX_ATTEMPTS} THEN $4 ELSE NULL END`,
        [key, nextPoints, now.toISOString(), willLock ? lockoutTime.toISOString() : null]
      );
      return { points: nextPoints, locked: willLock };
    }

    if (sqliteDb) {
      const current = await checkRateLimit(key, sqliteDb);
      const nextPoints = (current.points || 0) + 1;
      const willLock = nextPoints >= MAX_ATTEMPTS;

      sqliteDb.prepare(`
        INSERT INTO rate_limits (key, points, last_attempt, locked_until)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          points = ?,
          last_attempt = ?,
          locked_until = ?
      `).run(
        key,
        nextPoints,
        now.toISOString(),
        willLock ? lockoutTime.toISOString() : null,
        nextPoints,
        now.toISOString(),
        willLock ? lockoutTime.toISOString() : null
      );
      return { points: nextPoints, locked: willLock };
    }
  } catch (err) {
    console.warn('Failed to record rate limit failure:', err.message);
  }

  const record = inMemoryCache.get(key) || { points: 0 };
  record.points += 1;
  record.lastAttempt = now;
  if (record.points >= MAX_ATTEMPTS) {
    record.lockedUntil = lockoutTime;
  }
  inMemoryCache.set(key, record);
  return { points: record.points, locked: record.points >= MAX_ATTEMPTS };
}

export async function resetRateLimit(key, sqliteDb = null) {
  try {
    if (pool) {
      await query('DELETE FROM rate_limits WHERE key = $1', [key]);
    } else if (sqliteDb) {
      sqliteDb.prepare('DELETE FROM rate_limits WHERE key = ?').run(key);
    }
  } catch (err) {
    console.warn('Failed to reset rate limit:', err.message);
  }
  inMemoryCache.delete(key);
}
