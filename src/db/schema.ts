/**
 * ==========================================================================================
 *  نظام إدارة جهات الاتصال والاستخبارات الصحفية — مخطط قاعدة البيانات (PostgreSQL / Drizzle ORM)
 *  كل الجداول تعتمد على UUID + فهرسة محسّنة + قيود مرجعية (ON DELETE CASCADE).
 * ==========================================================================================
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------- الأنواع (Enums كنصوص مُقيَّدة) ------------------------------- */

export type Sensitivity = "public" | "confidential" | "top_secret";
export type PhoneLabel = "personal" | "work" | "burner";
export type EmailType = "primary" | "leaked" | "secure";
export type NoteCategory = "meeting" | "financial" | "background" | "leak";
export type RelationshipType =
  | "lawyer"
  | "business_partner"
  | "relative"
  | "accomplice"
  | "adversary"
  | "whistleblower"
  | "associate";
export type Confidence = "confirmed" | "suspected";
export type SearchEntityType =
  | "person"
  | "phone"
  | "email"
  | "social"
  | "note"
  | "document";
export type EntityType = "person" | "note" | "relationship";

/* ------------------------------------ A) الشخص (الملف الأساسي) --------------------------------- */

export const persons = pgTable(
  "persons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    aliases: text("aliases").notNull().default(""),
    avatarPath: text("avatar_path"),
    dateOfBirth: date("date_of_birth"),
    nationality: text("nationality").notNull().default(""),
    occupation: text("occupation").notNull().default(""),
    address: text("address").notNull().default(""),
    summary: text("summary").notNull().default(""),
    /** تقييم الموثوقية من 1 إلى 5 */
    reliability: integer("reliability").notNull().default(3),
    /** مستوى الحساسية: عام / سري / سري للغاية */
    sensitivity: text("sensitivity")
      .notNull()
      .default("confidential")
      .$type<Sensitivity>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("persons_full_name_idx").on(t.fullName),
    index("persons_sensitivity_idx").on(t.sensitivity),
    index("persons_created_at_idx").on(t.createdAt),
  ],
);

/* ---------------------------------- B) قنوات الاتصال (1..N) ---------------------------------- */

export const phones = pgTable(
  "phones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    /** رقم بصيغة E.164 */
    number: text("number").notNull(),
    label: text("label").notNull().default("personal").$type<PhoneLabel>(),
    whatsapp: boolean("whatsapp").notNull().default(false),
    signal: boolean("signal").notNull().default(false),
    telegram: boolean("telegram").notNull().default(false),
    carrierNotes: text("carrier_notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("phones_person_idx").on(t.personId),
    index("phones_number_idx").on(t.number),
  ],
);

export const emails = pgTable(
  "emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    type: text("type").notNull().default("primary").$type<EmailType>(),
    pgpPublicKey: text("pgp_public_key").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("emails_person_idx").on(t.personId),
    index("emails_address_idx").on(t.address),
  ],
);

export const socials = pgTable(
  "socials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    handle: text("handle").notNull(),
    profileUrl: text("profile_url").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("socials_person_idx").on(t.personId),
    index("socials_handle_idx").on(t.handle),
  ],
);

/* ------------------------------- C) الاستخبارات والملاحظات الميدانية ---------------------------- */

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    category: text("category").notNull().default("meeting").$type<NoteCategory>(),
    eventDate: date("event_date"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isConfidential: boolean("is_confidential").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notes_person_idx").on(t.personId),
    index("notes_category_idx").on(t.category),
    index("notes_event_date_idx").on(t.eventDate),
  ],
);

/* ------------------------------ D) العلاقات / شبكة الرسم البياني (N..N) ------------------------- */

export const relationships = pgTable(
  "relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourcePersonId: uuid("source_person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    targetPersonId: uuid("target_person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("associate").$type<RelationshipType>(),
    confidence: text("confidence")
      .notNull()
      .default("suspected")
      .$type<Confidence>(),
    contextNotes: text("context_notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("relationships_source_idx").on(t.sourcePersonId),
    index("relationships_target_idx").on(t.targetPersonId),
    uniqueIndex("relationships_unique_triple").on(
      t.sourcePersonId,
      t.targetPersonId,
      t.type,
    ),
  ],
);

/* --------------------------- E) المستندات والوسائط (متعددة الأشكال) ---------------------------- */

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** الكيان المرتبط (person / note / relationship) */
    entityType: text("entity_type").notNull().default("person").$type<EntityType>(),
    entityId: uuid("entity_id").notNull(),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "cascade" }),
    /** اسم الملف على القرص: UUID معقّم + امتداد آمن */
    storedName: text("stored_name").notNull(),
    /** الاسم الأصلي محفوظ في قاعدة البيانات فقط */
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** بصمة SHA-256 لسلسلة العهدة الجنائية */
    sha256: text("sha256").notNull(),
    description: text("description").notNull().default(""),
    isAvatar: boolean("is_avatar").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("documents_person_idx").on(t.personId),
    index("documents_entity_idx").on(t.entityType, t.entityId),
    index("documents_sha256_idx").on(t.sha256),
  ],
);

/* --------------------------- F) فهرس البحث الموحّد (طبقة Meilisearch المحلية) ------------------- */

export const searchDocs = pgTable(
  "search_docs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull().$type<SearchEntityType>(),
    entityId: uuid("entity_id").notNull(),
    personId: uuid("person_id"),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    body: text("body").notNull().default(""),
    /** النص بعد تطبيع العربية: يُستخدم للمطابقة الضبابية */
    normalized: text("normalized").notNull(),
    weight: integer("weight").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("search_docs_person_idx").on(t.personId),
    uniqueIndex("search_docs_entity_unique").on(t.entityType, t.entityId),
  ],
);

/* ------------------------------------- G) سجل التدقيق الجنائي ---------------------------------- */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    summary: text("summary").notNull().default(""),
    actor: text("actor").notNull().default("local-analyst"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_log_created_at_idx").on(t.createdAt)],
);

/* --------------------------------------- الأنواع المُصدَّرة -------------------------------------- */

export type Person = typeof persons.$inferSelect;
export type NewPerson = typeof persons.$inferInsert;
export type Phone = typeof phones.$inferSelect;
export type Email = typeof emails.$inferSelect;
export type Social = typeof socials.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Relationship = typeof relationships.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type SearchDoc = typeof searchDocs.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;

export const nowSql = sql`now()`;
