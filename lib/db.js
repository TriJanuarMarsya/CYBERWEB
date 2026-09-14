const { Pool } = require('@neondatabase/serverless');

let pool = null;

function getPool() {
  if (pool) return pool;
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const connectionString = raw.split('?')[0];
  pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }
  });
  return pool;
}

const TABLES = {
  users: { table: 'users', cols: ['id', 'name', 'username', 'email', 'password', 'role', 'phone', 'google_id', 'avatar', 'created'] },
  videos: { table: 'videos', cols: ['id', 'title', 'desc', 'cat', 'tags', 'file', 'size', 'duration', 'thumb', 'upload_by', 'date', 'status', 'review_status', 'review_comment'] },
  skrips: { table: 'skrips', cols: ['id', 'title', 'desc', 'cat', 'ver', 'file', 'size', 'upload_by', 'date', 'status', 'review_status', 'review_comment', 'drive_id', 'drive_link', 'drive_name'] },
  comments: { table: 'comments', cols: ['id', 'target_type', 'target_id', 'user_id', 'text', 'date', 'likes'] },
  absensi: { table: 'absensi', cols: ['id', 'user_id', 'user_name', 'date', 'check_in', 'check_out', 'device', 'ip'] },
  activities: { table: 'activities', cols: ['id', 'user_id', 'user_name', 'activity', 'date'] },
  notifications: { table: 'notifications', cols: ['id', 'user_id', 'type', 'msg', 'date'] },
  backups: { table: 'backups', cols: ['date', 'size'] }
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT DEFAULT '',
  "username" TEXT DEFAULT '',
  "email" TEXT DEFAULT '',
  "password" TEXT DEFAULT '',
  "role" TEXT DEFAULT 'user',
  "phone" TEXT DEFAULT '',
  "google_id" TEXT DEFAULT '',
  "avatar" TEXT DEFAULT '',
  "created" BIGINT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "videos" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT DEFAULT '',
  "desc" TEXT DEFAULT '',
  "cat" TEXT DEFAULT '',
  "tags" JSONB DEFAULT '[]',
  "file" TEXT DEFAULT '',
  "size" BIGINT DEFAULT 0,
  "duration" TEXT DEFAULT '',
  "thumb" TEXT DEFAULT '',
  "upload_by" TEXT DEFAULT '',
  "date" BIGINT DEFAULT 0,
  "status" TEXT DEFAULT 'active',
  "review_status" TEXT DEFAULT 'pending',
  "review_comment" TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS "skrips" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT DEFAULT '',
  "desc" TEXT DEFAULT '',
  "cat" TEXT DEFAULT '',
  "ver" TEXT DEFAULT '',
  "file" TEXT DEFAULT '',
  "size" BIGINT DEFAULT 0,
  "upload_by" TEXT DEFAULT '',
  "date" BIGINT DEFAULT 0,
  "status" TEXT DEFAULT 'active',
  "review_status" TEXT DEFAULT 'pending',
  "review_comment" TEXT DEFAULT '',
  "drive_id" TEXT DEFAULT '',
  "drive_link" TEXT DEFAULT '',
  "drive_name" TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS "comments" (
  "id" TEXT PRIMARY KEY,
  "target_type" TEXT DEFAULT '',
  "target_id" TEXT DEFAULT '',
  "user_id" TEXT DEFAULT '',
  "text" TEXT DEFAULT '',
  "date" BIGINT DEFAULT 0,
  "likes" INT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "absensi" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT DEFAULT '',
  "user_name" TEXT DEFAULT '',
  "date" BIGINT DEFAULT 0,
  "check_in" TEXT DEFAULT '',
  "check_out" TEXT DEFAULT '',
  "device" TEXT DEFAULT '',
  "ip" TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS "activities" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT DEFAULT '',
  "user_name" TEXT DEFAULT '',
  "activity" TEXT DEFAULT '',
  "date" BIGINT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT DEFAULT '',
  "type" TEXT DEFAULT '',
  "msg" TEXT DEFAULT '',
  "date" BIGINT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "backups" (
  "id" BIGSERIAL PRIMARY KEY,
  "date" BIGINT DEFAULT 0,
  "size" BIGINT DEFAULT 0
);
`;

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

const NUMERIC_COLS = new Set(['created', 'date', 'size', 'likes']);

function toDBValue(v) {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v) || typeof v === 'object') return JSON.stringify(v);
  return v;
}

function buildInsert(table, items) {
  const rows = items.map((it) =>
    table.cols.map((c) => toDBValue(it[snakeToCamel(c)]))
  );
  if (!rows.length) return null;
  const placeholders = rows
    .map((_, i) =>
      '(' + table.cols.map((_, j) => '$' + (i * table.cols.length + j + 1)).join(',') + ')'
    )
    .join(',');
  const quoted = table.cols.map((c) => '"' + c + '"').join(',');
  const sql = `INSERT INTO "${table.table}" (${quoted}) VALUES ${placeholders}`;
  return { sql, params: rows.flat() };
}

async function initSchema() {
  const p = getPool();
  await p.query(SCHEMA);
  await p.query(`ALTER TABLE "skrips" ADD COLUMN IF NOT EXISTS "drive_id" TEXT DEFAULT ''`);
  await p.query(`ALTER TABLE "skrips" ADD COLUMN IF NOT EXISTS "drive_link" TEXT DEFAULT ''`);
  await p.query(`ALTER TABLE "skrips" ADD COLUMN IF NOT EXISTS "drive_name" TEXT DEFAULT ''`);
  await p.query(`ALTER TABLE "skrips" ADD COLUMN IF NOT EXISTS "review_status" TEXT DEFAULT 'pending'`);
  await p.query(`ALTER TABLE "skrips" ADD COLUMN IF NOT EXISTS "review_comment" TEXT DEFAULT ''`);
  await p.query(`ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "review_status" TEXT DEFAULT 'pending'`);
  await p.query(`ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "review_comment" TEXT DEFAULT ''`);
  await p.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT ''`);
  await p.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" TEXT DEFAULT ''`);
  await p.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar" TEXT DEFAULT ''`);
}

async function loadAll() {
  const p = getPool();
  const store = {};
  for (const [name, t] of Object.entries(TABLES)) {
    const quoted = t.cols.map((c) => '"' + c + '"').join(',');
    const { rows } = await p.query(`SELECT ${quoted} FROM "${t.table}"`);
    store[name] = rows.map((r) => {
      const item = {};
      for (const c of t.cols) {
        let v = r[c];
        if (NUMERIC_COLS.has(c) && v !== null && v !== undefined) v = Number(v);
        item[snakeToCamel(c)] = v;
      }
      return item;
    });
  }
  return store;
}

async function replaceAll(store) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (const [name, t] of Object.entries(TABLES)) {
      await client.query(`DELETE FROM "${t.table}"`);
      const items = Array.isArray(store[name]) ? store[name] : [];
      const ins = buildInsert(t, items);
      if (ins) await client.query(ins.sql, ins.params);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { initSchema, loadAll, replaceAll, getPool, TABLES };