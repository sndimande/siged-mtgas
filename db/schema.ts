import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reference: text("reference").notNull().unique(),
  subject: text("subject").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  documentType: text("document_type").notNull(),
  flowType: text("flow_type").notNull().default("Documento recebido"),
  priority: text("priority").notNull().default("Normal"),
  status: text("status").notNull().default("Registado"),
  deadline: text("deadline"),
  notes: text("notes").notNull().default(""),
  progress: integer("progress").notNull().default(10),
  createdBy: text("created_by").notNull().default("utilizador-demo"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const movements = sqliteTable("movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("document_id").notNull().references(() => documents.id),
  action: text("action").notNull(),
  fromUnit: text("from_unit"),
  toUnit: text("to_unit"),
  actor: text("actor").notNull(),
  comment: text("comment").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("document_id").notNull().references(() => documents.id),
  objectKey: text("object_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
