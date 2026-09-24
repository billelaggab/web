/**
 * طبقة الاتصال + بوابة المخطط الذاتية (Self-healing schema gate).
 *
 * المشكلة التي تعالجها: إذا بدأ التطبيق أمام قاعدة بيانات فارغة (بيئة جديدة أو حجم مُعاد
 * تهيئته) فإن أول عملية كتابة تفشل بـ `relation "persons" does not exist`.
 * الحل: قبل تنفيذ أي استعلام، تُنفَّذ عبارات DDL غير ضارة (`IF NOT EXISTS`) مرة واحدة
 * لكل عملية، مع إعادة محاولة عند عدم جاهزية قاعدة البيانات.
 */
import { Pool, type QueryResult, type QueryResultRow } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

type PoolCache = typeof globalThis & {
  __icimsPool?: Pool;
  __icimsSchema?: Promise<void>;
};

const cache = globalThis as PoolCache;

export const pool =
  cache.__icimsPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 20_000,
  });

if (process.env.NODE_ENV !== "production") {
  cache.__icimsPool = pool;
}

/* ------------------------- المخطط (مطابق تماماً لـ src/db/schema.ts) ------------------------- */

const SCHEMA_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "persons" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "full_name" text NOT NULL,
      "aliases" text DEFAULT '' NOT NULL,
      "avatar_path" text,
      "date_of_birth" date,
      "nationality" text DEFAULT '' NOT NULL,
      "occupation" text DEFAULT '' NOT NULL,
      "address" text DEFAULT '' NOT NULL,
      "summary" text DEFAULT '' NOT NULL,
      "reliability" integer DEFAULT 3 NOT NULL,
      "sensitivity" text DEFAULT 'confidential' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS "phones" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
      "number" text NOT NULL,
      "label" text DEFAULT 'personal' NOT NULL,
      "whatsapp" boolean DEFAULT false NOT NULL,
      "signal" boolean DEFAULT false NOT NULL,
      "telegram" boolean DEFAULT false NOT NULL,
      "carrier_notes" text DEFAULT '' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS "emails" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
      "address" text NOT NULL,
      "type" text DEFAULT 'primary' NOT NULL,
      "pgp_public_key" text DEFAULT '' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS "socials" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
      "platform" text NOT NULL,
      "handle" text NOT NULL,
      "profile_url" text DEFAULT '' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS "notes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
      "title" text NOT NULL,
      "content" text DEFAULT '' NOT NULL,
      "category" text DEFAULT 'meeting' NOT NULL,
      "event_date" date,
      "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
      "is_confidential" boolean DEFAULT false NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS "relationships" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "source_person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
      "target_person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
      "type" text DEFAULT 'associate' NOT NULL,
      "confidence" text DEFAULT 'suspected' NOT NULL,
      "context_notes" text DEFAULT '' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS "documents" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "entity_type" text DEFAULT 'person' NOT NULL,
      "entity_id" uuid NOT NULL,
      "person_id" uuid REFERENCES "persons"("id") ON DELETE CASCADE,
      "stored_name" text NOT NULL,
      "original_name" text NOT NULL,
      "mime_type" text NOT NULL,
      "size_bytes" integer NOT NULL,
      "sha256" text NOT NULL,
      "description" text DEFAULT '' NOT NULL,
      "is_avatar" boolean DEFAULT false NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS "search_docs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "entity_type" text NOT NULL,
      "entity_id" uuid NOT NULL,
      "person_id" uuid,
      "title" text NOT NULL,
      "subtitle" text DEFAULT '' NOT NULL,
      "body" text DEFAULT '' NOT NULL,
      "normalized" text NOT NULL,
      "weight" integer DEFAULT 1 NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS "audit_log" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "action" text NOT NULL,
      "entity" text NOT NULL,
      "entity_id" uuid,
      "summary" text DEFAULT '' NOT NULL,
      "actor" text DEFAULT 'local-analyst' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
   )`,

  `CREATE INDEX IF NOT EXISTS "persons_full_name_idx" ON "persons" ("full_name")`,
  `CREATE INDEX IF NOT EXISTS "persons_sensitivity_idx" ON "persons" ("sensitivity")`,
  `CREATE INDEX IF NOT EXISTS "persons_created_at_idx" ON "persons" ("created_at")`,
  `CREATE INDEX IF NOT EXISTS "phones_person_idx" ON "phones" ("person_id")`,
  `CREATE INDEX IF NOT EXISTS "phones_number_idx" ON "phones" ("number")`,
  `CREATE INDEX IF NOT EXISTS "emails_person_idx" ON "emails" ("person_id")`,
  `CREATE INDEX IF NOT EXISTS "emails_address_idx" ON "emails" ("address")`,
  `CREATE INDEX IF NOT EXISTS "socials_person_idx" ON "socials" ("person_id")`,
  `CREATE INDEX IF NOT EXISTS "socials_handle_idx" ON "socials" ("handle")`,
  `CREATE INDEX IF NOT EXISTS "notes_person_idx" ON "notes" ("person_id")`,
  `CREATE INDEX IF NOT EXISTS "notes_category_idx" ON "notes" ("category")`,
  `CREATE INDEX IF NOT EXISTS "notes_event_date_idx" ON "notes" ("event_date")`,
  `CREATE INDEX IF NOT EXISTS "relationships_source_idx" ON "relationships" ("source_person_id")`,
  `CREATE INDEX IF NOT EXISTS "relationships_target_idx" ON "relationships" ("target_person_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "relationships_unique_triple"
       ON "relationships" ("source_person_id", "target_person_id", "type")`,
  `CREATE INDEX IF NOT EXISTS "documents_person_idx" ON "documents" ("person_id")`,
  `CREATE INDEX IF NOT EXISTS "documents_entity_idx" ON "documents" ("entity_type", "entity_id")`,
  `CREATE INDEX IF NOT EXISTS "documents_sha256_idx" ON "documents" ("sha256")`,
  `CREATE INDEX IF NOT EXISTS "search_docs_person_idx" ON "search_docs" ("person_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "search_docs_entity_unique" ON "search_docs" ("entity_type", "entity_id")`,
  `CREATE INDEX IF NOT EXISTS "audit_log_created_at_idx" ON "audit_log" ("created_at")`,
];

const MAX_ATTEMPTS = 5;

async function applySchema(attempt = 0): Promise<void> {
  const client = await pool.connect();
  try {
    for (const statement of SCHEMA_DDL) {
      await client.query(statement);
    }
  } catch (error) {
    client.release();
    if (attempt < MAX_ATTEMPTS - 1) {
      const isTransient =
        /ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|Connection terminated|terminating connection|does not exist/i.test(
          (error as Error).message,
        );
      if (isTransient) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
        return applySchema(attempt + 1);
      }
    }
    // اسمح بمحاولة جديدة عند الطلب التالي بدلاً من تعطيل التطبيق نهائياً.
    cache.__icimsSchema = undefined;
    throw error;
  }
  client.release();
}

/** تضمن وجود المخطط قبل أي استعلام — مُخزَّنة كوعد واحد لكل عملية تشغيل. */
export function ensureSchemaReady(): Promise<void> {
  if (!cache.__icimsSchema) {
    cache.__icimsSchema = applySchema().catch((error) => {
      throw error;
    });
  }
  return cache.__icimsSchema;
}

/**
 * بوابة كل استعلامات Drizzle: يُطبَّق المخطط أولاً إن لم يكن مطبَّقاً.
 * ملاحظة: applySchema تستخدم pool.connect() مباشرة، فلا يحدث أي recursion.
 */
type PoolQuery = typeof pool.query;
const originalQuery = pool.query.bind(pool) as unknown as (
  ...args: unknown[]
) => Promise<QueryResult<QueryResultRow>>;

const gatedQuery = (async (...args: unknown[]) => {
  await ensureSchemaReady();
  return originalQuery(...args);
}) as unknown as PoolQuery;

Object.defineProperty(pool, "query", {
  value: gatedQuery,
  writable: true,
  configurable: true,
});

/** رصد حالة المخطط (لصفحة الإعدادات وفحص الصحة) */
export async function schemaStatus(): Promise<{ ok: boolean; tables: number; detail: string }> {
  try {
    await ensureSchemaReady();
    const result = await originalQuery(
      `select count(*)::text as tables from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    const tables = Number(String(result.rows[0]?.tables ?? 0));
    return { ok: true, tables, detail: `${tables} جدول` };
  } catch (error) {
    return { ok: false, tables: 0, detail: (error as Error).message };
  }
}
