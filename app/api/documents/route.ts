import { desc, eq } from "drizzle-orm";
import { ensureDatabaseSchema, getDb } from "../../../db";
import { attachments, documents, movements } from "../../../db/schema";
import { getSessionUser, recordAudit } from "../../../lib/auth";

const seed = [
  { reference:"DEMO/ENT/2026/0001", subject:"Documento demonstrativo para validação do fluxo", origin:"Unidade de Demonstração A", destination:"Unidade de Demonstração B", documentType:"Nota", flowType:"Documento interno", priority:"Alta", status:"Em despacho", deadline:"2026-12-15", progress:72, confidentiality:"Interno" },
  { reference:"DEMO/ENT/2026/0002", subject:"Relatório fictício para teste do sistema", origin:"Unidade de Demonstração C", destination:"Unidade de Demonstração A", documentType:"Relatório", flowType:"Documento recebido", priority:"Normal", status:"Em análise", deadline:"2026-12-18", progress:55, confidentiality:"Interno" },
  { reference:"DEMO/SAI/2026/0003", subject:"Pedido demonstrativo de actualização de dados", origin:"Unidade de Demonstração A", destination:"Unidade de Demonstração Provincial", documentType:"Ofício", flowType:"Documento de saída", priority:"Alta", status:"Enviado", deadline:"2026-12-20", progress:100, confidentiality:"Público" },
  { reference:"DEMO/INT/2026/0004", subject:"Requisição fictícia para ensaio do encaminhamento", origin:"Unidade de Demonstração B", destination:"Unidade de Demonstração C", documentType:"Informação", flowType:"Documento interno", priority:"Normal", status:"Em tramitação", deadline:"2026-12-22", progress:40, confidentiality:"Interno" },
  { reference:"DEMO/ENT/2026/0005", subject:"Relatório demonstrativo concluído", origin:"Instituição Tutelada de Demonstração", destination:"Unidade de Demonstração A", documentType:"Relatório", flowType:"Documento recebido", priority:"Normal", status:"Concluído", deadline:"2026-12-10", progress:100, confidentiality:"Interno", archived:true },
];

const progressByStatus: Record<string, number> = {
  "Registado": 10,
  "Distribuído": 25,
  "Em tramitação": 40,
  "Em análise": 55,
  "Em despacho": 75,
  "Devolvido": 45,
  "Enviado": 100,
  "Concluído": 100,
  "Arquivado": 100,
};

async function documentDetail(id: number) {
  const db = getDb();
  const [document] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!document) return null;
  const [history, files] = await Promise.all([
    db.select().from(movements).where(eq(movements.documentId, id)).orderBy(desc(movements.createdAt)),
    db.select().from(attachments).where(eq(attachments.documentId, id)).orderBy(desc(attachments.createdAt)),
  ]);
  return { ...document, movements: history, attachments: files };
}

export async function GET(request: Request) {
  try {
    await ensureDatabaseSchema();
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "Sessão necessária" }, { status: 401 });
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (id) {
      const document = await documentDetail(id);
      return document ? Response.json({ document }) : Response.json({ error: "Expediente não encontrado" }, { status: 404 });
    }

    const db = getDb();
    let rows = await db.select().from(documents).orderBy(desc(documents.createdAt)).limit(500);
    if (!rows.length) {
      await db.insert(documents).values(seed);
      rows = await db.select().from(documents).orderBy(desc(documents.createdAt)).limit(500);
    }
    const q = url.searchParams.get("q")?.toLowerCase().trim();
    const status = url.searchParams.get("status");
    const flowType = url.searchParams.get("flowType");
    const destination = url.searchParams.get("destination");
    const filtered = rows.filter((row) => {
      const matchesQuery = !q || `${row.reference} ${row.subject} ${row.origin} ${row.destination} ${row.documentType}`.toLowerCase().includes(q);
      return matchesQuery
        && (!status || row.status === status)
        && (!flowType || row.flowType === flowType)
        && (!destination || row.destination === destination);
    });
    return Response.json({ documents: filtered, total: filtered.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao consultar expedientes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseSchema();
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "Sessão necessária" }, { status: 401 });
    const payload = await request.json() as Record<string, string>;
    const required = ["subject", "origin", "destination", "documentType", "flowType"];
    if (required.some((key) => !payload[key]?.trim())) return Response.json({ error: "Preencha todos os campos obrigatórios" }, { status: 400 });

    const db = getDb();
    const year = new Date().getFullYear();
    const prefix = payload.flowType === "Documento de saída" ? "SAI" : payload.flowType === "Documento interno" ? "INT" : "ENT";
    const suffix = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 10)}`;
    const reference = `MTGAS/${prefix}/${year}/${suffix}`;
    const [created] = await db.insert(documents).values({
      reference,
      subject: payload.subject.trim(),
      origin: payload.origin.trim(),
      destination: payload.destination.trim(),
      documentType: payload.documentType,
      flowType: payload.flowType,
      priority: payload.priority || "Normal",
      deadline: payload.deadline || null,
      notes: payload.notes?.trim() || "",
      senderReference: payload.senderReference?.trim() || "",
      confidentiality: payload.confidentiality || "Interno",
      status: "Registado",
      progress: 10,
      createdBy: user.username,
    }).returning();
    await db.insert(movements).values({
      documentId: created.id,
      action: "Expediente registado",
      fromUnit: created.origin,
      toUnit: created.destination,
      actor: user.name,
      comment: created.notes,
    });
    await recordAudit(user, "CREATE", "document", String(created.id), reference);
    return Response.json({ document: await documentDetail(created.id) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao registar expediente" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureDatabaseSchema();
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "Sessão necessária" }, { status: 401 });
    const payload = await request.json() as {
      id?: number;
      status?: string;
      destination?: string;
      comment?: string;
      priority?: string;
      deadline?: string;
      archived?: boolean;
    };
    if (!payload.id) return Response.json({ error: "Identificador obrigatório" }, { status: 400 });
    const db = getDb();
    const [current] = await db.select().from(documents).where(eq(documents.id, payload.id)).limit(1);
    if (!current) return Response.json({ error: "Expediente não encontrado" }, { status: 404 });

    const status = payload.archived ? "Arquivado" : payload.status || current.status;
    const destination = payload.destination?.trim() || current.destination;
    const [updated] = await db.update(documents).set({
      status,
      destination,
      priority: payload.priority || current.priority,
      deadline: payload.deadline || current.deadline,
      archived: payload.archived ?? current.archived,
      progress: progressByStatus[status] ?? current.progress,
      updatedAt: new Date().toISOString(),
    }).where(eq(documents.id, payload.id)).returning();
    await db.insert(movements).values({
      documentId: current.id,
      action: status === current.status && destination !== current.destination ? "Encaminhado" : status,
      fromUnit: current.destination,
      toUnit: destination,
      actor: user.name,
      comment: payload.comment?.trim() || "",
    });
    await recordAudit(user, "UPDATE", "document", String(current.id), `${current.status} → ${status}; ${current.destination} → ${destination}`);
    return Response.json({ document: await documentDetail(updated.id) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao actualizar expediente" }, { status: 500 });
  }
}
