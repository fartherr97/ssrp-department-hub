/*
 * MariaDB/MySQL data access. Two tables, mirroring the localStorage mock the
 * front-end ships with:
 *
 *   department_config  — one JSON document per department (the whole config)
 *   audit_log          — append-only history; kept FOREVER (no delete, no cap).
 *                        The mock's 500-entry limit existed only for browser
 *                        quota and intentionally does NOT carry over here.
 *
 * Sessions get their own table too (managed by express-mysql-session).
 *
 * Everything is parameterized (mysql2 placeholders) so there's no SQL injection
 * surface, and config is stored as a JSON column validated before write.
 */
import mysql from "mysql2/promise";
import mysqlCallback from "mysql2"; // callback API, required by express-mysql-session
import { env } from "./env.js";

function poolOptions() {
  return {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    connectionLimit: 8,
    waitForConnections: true,
    // Keep BIGINT ids (Discord snowflakes) as strings, never lose precision.
    supportBigNumbers: true,
    bigNumberStrings: true,
  };
}

let pool;

export function getPool() {
  if (pool) return pool;
  pool = env.db.url ? mysql.createPool(env.db.url) : mysql.createPool(poolOptions());
  return pool;
}

// A SEPARATE callback-style pool for express-mysql-session, which does not work
// with mysql2's promise pool (it calls connection.query(sql, params, cb)).
let sessionPool;

export function getSessionPool() {
  if (sessionPool) return sessionPool;
  sessionPool = env.db.url
    ? mysqlCallback.createPool(env.db.url)
    : mysqlCallback.createPool(poolOptions());
  return sessionPool;
}

// Create tables if they don't exist. Safe to run on every boot.
export async function migrate() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS department_config (
      department_id VARCHAR(64) NOT NULL PRIMARY KEY,
      config        JSON        NOT NULL,
      updated_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      department_id VARCHAR(64) NOT NULL,
      entry         JSON        NOT NULL,
      actor_id      VARCHAR(32) NULL,
      created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dept_created (department_id, created_at)
    )
  `);
}

// ─── Config ──────────────────────────────────────────────────────────────────

export async function loadConfig(departmentId) {
  const db = getPool();
  const [rows] = await db.query(
    "SELECT config FROM department_config WHERE department_id = ? LIMIT 1",
    [departmentId]
  );
  if (!rows.length) return null;
  const value = rows[0].config;
  // mysql2 returns JSON columns already parsed; tolerate string just in case.
  return typeof value === "string" ? JSON.parse(value) : value;
}

export async function saveConfig(departmentId, config) {
  const db = getPool();
  const json = JSON.stringify(config);
  await db.query(
    `INSERT INTO department_config (department_id, config) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE config = VALUES(config)`,
    [departmentId, json]
  );
  return config;
}

// ─── Audit log (append-only, never pruned) ───────────────────────────────────

export async function loadAudit(departmentId, limit = 1000) {
  const db = getPool();
  const [rows] = await db.query(
    `SELECT entry FROM audit_log WHERE department_id = ?
     ORDER BY id DESC LIMIT ?`,
    [departmentId, limit]
  );
  return rows.map((r) => (typeof r.entry === "string" ? JSON.parse(r.entry) : r.entry));
}

export async function appendAudit(departmentId, entry) {
  const db = getPool();
  await db.query(
    "INSERT INTO audit_log (department_id, entry, actor_id) VALUES (?, ?, ?)",
    [departmentId, JSON.stringify(entry), entry?.actor?.discordId || entry?.discordId || null]
  );
  return entry;
}
