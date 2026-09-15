import "server-only";
import { Pool, type PoolClient } from "pg";

// Server-only Postgres access (Neon or any other Postgres host - nothing
// here is Neon-specific). The connection string is a private secret that
// only ever lives in server environment variables; unlike the old
// Supabase setup there is no separate anon/public key at all, because
// nothing but our own Next.js API routes ever talks to the database - the
// browser never gets a database credential of any kind. That's a simpler
// security story than RLS: there is no public entry point to lock down.

let pool: Pool | null = null;

function isLocalHost(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL env var.");
  }
  pool = new Pool({
    connectionString,
    // Neon (and most hosted Postgres) requires TLS. `rejectUnauthorized:
    // false` skips CA verification, which is the standard, documented way
    // to connect from serverless hosts like Vercel without bundling extra
    // CA certs - the connection is still encrypted, just not verifying the
    // certificate chain. A plain local Postgres (e.g. for `npm run dev`
    // against a Docker container) usually has no TLS configured at all, so
    // skip it there rather than failing the handshake.
    ssl: isLocalHost(connectionString) ? false : { rejectUnauthorized: false },
    max: 5, // a family app never needs many concurrent connections
  });
  return pool;
}

export interface QueryResultLike<T> {
  rows: T[];
}

type Executor = { query: (text: string, params?: unknown[]) => Promise<QueryResultLike<any>> };

/** Runs one query, returns all rows. */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

/** Runs one query, returns the first row or null. */
export async function queryOne<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs `fn` inside a BEGIN/COMMIT transaction, rolling back on any thrown
 * error. Use this for any operation that writes to more than one table and
 * needs both writes to succeed or neither to (e.g. debiting points AND
 * creating a redemption request together). */
export async function withTransaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
  const client: PoolClient = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
