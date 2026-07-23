import { eq } from "drizzle-orm";
import { ensureDatabaseSchema, getDb, getEnv } from "../../../db";
import { attachments, documents } from "../../../db/schema";
import { getSessionUser, recordAudit } from "../../../lib/auth";

const allowedTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);

export async function GET(request: Request) {
  try {
    await ensureDatabaseSchema();
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "Sessão necessária" }, { status: 401 });
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "Identificador obrigatório" }, { status: 400 });
    const db = getDb();
    const [attachment] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
    if (!attachment) return Response.json({ error: "Ficheiro não encontrado" }, { status: 404 });
    const object = await getEnv().BUCKET?.get(attachment.objectKey);
    if (!object) return Response.json({ error: "Ficheiro indisponível no arquivo" }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao descarregar ficheiro" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseSchema();
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "Sessão necessária" }, { status: 401 });
    const form = await request.formData();
    const file = form.get("file");
    const documentId = Number(form.get("documentId"));
    if (!(file instanceof File) || !documentId) return Response.json({ error: "Ficheiro e expediente são obrigatórios" }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return Response.json({ error: "O ficheiro excede 20 MB" }, { status: 413 });
    if (file.type && !allowedTypes.has(file.type)) return Response.json({ error: "Formato não permitido. Use PDF, DOCX, XLSX, PNG ou JPG." }, { status: 415 });
    const db = getDb();
    const [document] = await db.select({ id: documents.id }).from(documents).where(eq(documents.id, documentId)).limit(1);
    if (!document) return Response.json({ error: "Expediente não encontrado" }, { status: 404 });

    const key = `expedientes/${documentId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const env = getEnv();
    if (!env.BUCKET) throw new Error("Armazenamento documental indisponível");
    await env.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
    const [saved] = await db.insert(attachments).values({
      documentId,
      objectKey: key,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      uploadedBy: user.username,
    }).returning();
    await recordAudit(user, "UPLOAD", "attachment", String(saved.id), saved.fileName);
    return Response.json({ attachment: saved }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao carregar ficheiro" }, { status: 500 });
  }
}
