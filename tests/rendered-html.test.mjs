import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("a aplicação expõe os módulos essenciais do SIGED", async () => {
  const page = await read("app/page.tsx");
  for (const feature of [
    "Gestão de expediente",
    "Repositório digital",
    "Relatórios e indicadores",
    "Actualizar e encaminhar",
    "Unidades orgânicas e instituições tuteladas",
  ]) {
    assert.match(page, new RegExp(feature));
  }
});

test("a base persiste autenticação, documentos, histórico e auditoria", async () => {
  const schema = await read("db/schema.ts");
  for (const table of ["documents", "movements", "attachments", "users", "sessions", "auditLogs"]) {
    assert.match(schema, new RegExp(`export const ${table}`));
  }
});

test("o artefacto de produção inclui o worker e o manifesto de alojamento", async () => {
  const worker = await read("dist/server/index.js");
  const manifest = JSON.parse(await read("dist/.openai/hosting.json"));
  assert.match(worker, /fetch/);
  assert.equal(manifest.d1, "DB");
  assert.equal(manifest.r2, "BUCKET");
});
