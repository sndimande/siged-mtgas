import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { documents, movements } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const seed = [
  { reference:"MTGAS/ENT/2026/0842", subject:"Proposta de Plano de Formação do SIMA", origin:"Direcção de Planificação e Cooperação", destination:"Gabinete da Ministra", documentType:"Nota", flowType:"Documento interno", priority:"Alta", status:"Em despacho", deadline:"2026-07-22", progress:72 },
  { reference:"MTGAS/ENT/2026/0839", subject:"Balanço do PESOE — I Semestre 2026", origin:"Direcção Nacional de Acção Social", destination:"Direcção de Planificação e Cooperação", documentType:"Relatório", flowType:"Documento recebido", priority:"Normal", status:"Em análise", deadline:"2026-07-24", progress:55 },
  { reference:"MTGAS/SAI/2026/0617", subject:"Pedido de actualização dos indicadores provinciais", origin:"Direcção de Planificação e Cooperação", destination:"Delegações Provinciais", documentType:"Ofício", flowType:"Documento de saída", priority:"Alta", status:"Enviado", deadline:"2026-07-19", progress:100 },
];

export async function GET(request: Request) {
  try {
    const db = getDb();
    let rows = await db.select().from(documents).orderBy(desc(documents.createdAt)).limit(200);
    if (!rows.length) {
      await db.insert(documents).values(seed);
      rows = await db.select().from(documents).orderBy(desc(documents.createdAt)).limit(200);
    }
    const q = new URL(request.url).searchParams.get("q")?.toLowerCase().trim();
    const filtered = q ? rows.filter(r => `${r.reference} ${r.subject} ${r.origin} ${r.destination}`.toLowerCase().includes(q)) : rows;
    return Response.json({ documents: filtered });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao consultar expedientes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, string>;
    const required = ["subject","origin","destination","documentType","flowType"];
    if (required.some(k => !payload[k]?.trim())) return Response.json({ error:"Preencha todos os campos obrigatórios" }, { status:400 });
    const db = getDb();
    const year = new Date().getFullYear();
    const prefix = payload.flowType === "Documento de saída" ? "SAI" : payload.flowType === "Documento interno" ? "INT" : "ENT";
    const reference = `MTGAS/${prefix}/${year}/${String(Date.now()).slice(-6)}`;
    const user = await getChatGPTUser();
    const [created] = await db.insert(documents).values({
      reference, subject:payload.subject.trim(), origin:payload.origin.trim(), destination:payload.destination.trim(),
      documentType:payload.documentType, flowType:payload.flowType, priority:payload.priority || "Normal",
      deadline:payload.deadline || null, notes:payload.notes || "", status:"Registado", progress:10,
      createdBy:user?.email || "utilizador-demo",
    }).returning();
    await db.insert(movements).values({ documentId:created.id, action:"Expediente registado", fromUnit:created.origin, toUnit:created.destination, actor:user?.displayName || "Utilizador demonstrativo" });
    return Response.json({ document:created }, { status:201 });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "Erro ao registar expediente" }, { status:500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as { id?:number; status?:string; destination?:string; comment?:string };
    if (!payload.id) return Response.json({ error:"Identificador obrigatório" }, { status:400 });
    const db = getDb();
    const [current] = await db.select().from(documents).where(eq(documents.id,payload.id)).limit(1);
    if (!current) return Response.json({ error:"Expediente não encontrado" }, { status:404 });
    const status = payload.status || "Em tramitação";
    const progress = status === "Concluído" ? 100 : status === "Em despacho" ? 72 : 40;
    const [updated] = await db.update(documents).set({ status, destination:payload.destination || current.destination, progress, updatedAt:new Date().toISOString() }).where(eq(documents.id,payload.id)).returning();
    const user = await getChatGPTUser();
    await db.insert(movements).values({ documentId:current.id, action:status, fromUnit:current.destination, toUnit:updated.destination, actor:user?.displayName || "Utilizador demonstrativo", comment:payload.comment || "" });
    return Response.json({ document:updated });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "Erro ao actualizar expediente" }, { status:500 });
  }
}
