import { getDb, getEnv } from "../../../db";
import { attachments } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const documentId = Number(form.get("documentId"));
    if (!(file instanceof File) || !documentId) return Response.json({ error:"Ficheiro e expediente são obrigatórios" }, { status:400 });
    if (file.size > 20 * 1024 * 1024) return Response.json({ error:"O ficheiro excede 20 MB" }, { status:413 });
    const key = `expedientes/${documentId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const env = getEnv();
    if (!env.BUCKET) throw new Error("Armazenamento documental indisponível");
    await env.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata:{ contentType:file.type || "application/octet-stream" } });
    const user = await getChatGPTUser();
    const db = getDb();
    const [saved] = await db.insert(attachments).values({ documentId, objectKey:key, fileName:file.name, contentType:file.type || "application/octet-stream", size:file.size, uploadedBy:user?.email || "utilizador-demo" }).returning();
    return Response.json({ attachment:saved }, { status:201 });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "Erro ao carregar ficheiro" }, { status:500 });
  }
}
