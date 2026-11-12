import pg from "pg";
const { Pool } = pg;

let pool = null;
if (process.env.USE_DATABASE === "true" && process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}
export const dbEnabled = Boolean(pool);
export async function query(text, params = []) {
  if (!pool) throw new Error("Database is not enabled");
  return pool.query(text, params);
}
