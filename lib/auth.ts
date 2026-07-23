import { and, eq, gt } from "drizzle-orm";
import { ensureDatabaseSchema, getDb } from "../db";
import { auditLogs, sessions, users } from "../db/schema";

export type SigedUser = {
  id: number;
  username: string;
  name: string;
  role: string;
  unit: string;
  initials: string;
};

const COOKIE_NAME = "siged_session";
const SESSION_HOURS = 8;

const DEMO_USERS = [
  { username: "sergio.demo", name: "Sérgio Ndimande", password: "SIGED2026", role: "Administrador", unit: "Direcção de Planificação e Cooperação", initials: "SN" },
  { username: "secretaria.demo", name: "Maria Cossa", password: "SEC2026", role: "Gestora de Expediente", unit: "Secretaria Central", initials: "MC" },
  { username: "gabinete.demo", name: "Ana Mucavele", password: "GAB2026", role: "Despacho", unit: "Gabinete da Ministra", initials: "AM" },
  { username: "inas.demo", name: "João Nhantumbo", password: "INAS2026", role: "Utilizador Institucional", unit: "Instituto Nacional de Acção Social, IP", initials: "JN" },
];

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return toHex(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 120_000 },
    key,
    256,
  ));
}

export async function ensureDemoUsers() {
  await ensureDatabaseSchema();
  const db = getDb();
  for (const account of DEMO_USERS) {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, account.username)).limit(1);
    if (!existing) {
      const salt = crypto.randomUUID();
      await db.insert(users).values({
        username: account.username,
        name: account.name,
        passwordHash: await passwordHash(account.password, salt),
        passwordSalt: salt,
        role: account.role,
        unit: account.unit,
        initials: account.initials,
      });
    }
  }
}

export async function authenticate(username: string, password: string) {
  await ensureDemoUsers();
  const db = getDb();
  const [record] = await db.select().from(users).where(eq(users.username, username.toLowerCase().trim())).limit(1);
  if (!record || !record.active) return null;
  const attempted = await passwordHash(password, record.passwordSalt);
  if (attempted !== record.passwordHash) return null;
  return publicUser(record);
}

export async function createSession(user: SigedUser, request: Request) {
  const db = getDb();
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  await db.insert(sessions).values({ userId: user.id, tokenHash, expiresAt });
  await db.insert(auditLogs).values({ userId: user.id, action: "LOGIN", entity: "session", details: "Sessão iniciada" });
  return {
    token,
    cookie: `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax;${new URL(request.url).protocol === "https:" ? " Secure;" : ""} Max-Age=${SESSION_HOURS * 3600}`,
  };
}

function readCookie(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  return cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) ?? null;
}

export async function getSessionUser(request: Request): Promise<SigedUser | null> {
  const token = readCookie(request);
  if (!token) return null;
  const db = getDb();
  const tokenHash = await sha256(token);
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date().toISOString())))
    .limit(1);
  return row?.user.active ? publicUser(row.user) : null;
}

export async function removeSession(request: Request) {
  const token = readCookie(request);
  if (!token) return;
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, await sha256(token)));
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

export async function recordAudit(user: SigedUser, action: string, entity: string, entityId?: string, details = "") {
  await getDb().insert(auditLogs).values({ userId: user.id, action, entity, entityId, details });
}

function publicUser(record: typeof users.$inferSelect): SigedUser {
  return {
    id: record.id,
    username: record.username,
    name: record.name,
    role: record.role,
    unit: record.unit,
    initials: record.initials,
  };
}
