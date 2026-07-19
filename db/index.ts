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
