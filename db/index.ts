import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type SigedEnv = { DB?: D1Database; BUCKET?: R2Bucket };

export function getEnv(): SigedEnv {
  return (globalThis as typeof globalThis & { __SIGED_ENV?: SigedEnv }).__SIGED_ENV ?? {};
}

export function getDb() {
  const env = getEnv();
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

let schemaPromise: Promise<void> | null = null;

export function ensureDatabaseSchema() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = initializeDatabase().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

async function initializeDatabase() {
  const env = getEnv();
  if (!env.DB) throw new Error("Base de dados do SIGED indisponível");
  const db = env.DB;

  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      reference TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      document_type TEXT NOT NULL,
      flow_type TEXT NOT NULL DEFAULT 'Documento recebido',
      priority TEXT NOT NULL DEFAULT 'Normal',
      status TEXT NOT NULL DEFAULT 'Registado',
      deadline TEXT,
      notes TEXT NOT NULL DEFAULT '',
      progress INTEGER NOT NULL DEFAULT 10,
      created_by TEXT NOT NULL DEFAULT 'utilizador-demo',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      document_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      from_unit TEXT,
      to_unit TEXT,
      actor TEXT NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      document_id INTEGER NOT NULL,
      object_key TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL,
      unit TEXT NOT NULL,
      initials TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'Unidade orgânica',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`),
  ]);

  const columns = await db.prepare("PRAGMA table_info(documents)").all<{ name: string }>();
  const existing = new Set(columns.results.map((column) => column.name));
  const additions = [
    ["sender_reference", "ALTER TABLE documents ADD COLUMN sender_reference TEXT NOT NULL DEFAULT ''"],
    ["confidentiality", "ALTER TABLE documents ADD COLUMN confidentiality TEXT NOT NULL DEFAULT 'Interno'"],
    ["archived", "ALTER TABLE documents ADD COLUMN archived INTEGER NOT NULL DEFAULT 0"],
  ] as const;
  for (const [name, statement] of additions) {
    if (!existing.has(name)) await db.prepare(statement).run();
  }
}
