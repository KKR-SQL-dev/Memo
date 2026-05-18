import sql from "mssql";

const config: sql.config = {
  server: "KR-KURARAYSQL",
  database: "KURARAY",
  user: "sa",
  password: "p@ssw0rd",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }
  if (pool) {
    try { await pool.close(); } catch { /* ignore */ }
    pool = null;
  }
  pool = await new sql.ConnectionPool(config).connect();
  return pool;
}

export { sql };
