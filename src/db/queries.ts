/**
 * طبقة الوصول للبيانات — كل الاستعلامات عبر Drizzle ORM (حصانة ضد SQL Injection).
 */
import { and, count, desc, eq, isNotNull, or, sql, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  documents,
  emails,
  notes,
  persons,
  phones,
  relationships,
  socials,
  type Person,
} from "@/db/schema";
import { DOSSIER_PROFILES, type DossierProfileKey } from "@/lib/constants";
import { signFileToken } from "@/lib/security";
import type {
  DocumentView,
  DossierPayload,
  DossierNote,
  PersonListItem,
  RelatedPersonView,
} from "@/lib/types";

/* ------------------------------------ سجل التدقيق ------------------------------------ */

export async function logAudit(
  action: string,
  entity: string,
  entityId: string | null,
  summary: string,
  actor = "local-analyst",
) {
  await db.insert(auditLog).values({ action, entity, entityId, summary, actor });
}

/* ------------------------------------ قوائم الأشخاص ----------------------------------- */

export async function listPersons(opts: {
  q?: string;
  sensitivity?: string;
  limit?: number;
}): Promise<PersonListItem[]> {
  const conditions = [];
  if (opts.q && opts.q.trim()) {
    const like = `%${opts.q.trim()}%`;
    conditions.push(
      or(
        sql`${persons.fullName} ilike ${like}`,
        sql`${persons.aliases} ilike ${like}`,
        sql`${persons.occupation} ilike ${like}`,
        sql`${persons.nationality} ilike ${like}`,
        sql`exists (select 1 from ${phones} ph where ph.person_id = ${persons.id} and ph.number ilike ${like})`,
        sql`exists (select 1 from ${emails} em where em.person_id = ${persons.id} and em.address ilike ${like})`,
      ),
    );
  }
  if (opts.sensitivity) {
    conditions.push(sql`${persons.sensitivity} = ${opts.sensitivity}`);
  }

  const rows = await db
    .select({
      person: persons,
      phoneCount: sql<number>`(select count(*) from ${phones} where ${phones.personId} = ${persons.id})`,
      emailCount: sql<number>`(select count(*) from ${emails} where ${emails.personId} = ${persons.id})`,
      noteCount: sql<number>`(select count(*) from ${notes} where ${notes.personId} = ${persons.id})`,
      documentCount: sql<number>`(select count(*) from ${documents} where ${documents.personId} = ${persons.id})`,
      relationshipCount: sql<number>`(select count(*) from ${relationships} r where r.source_person_id = ${persons.id} or r.target_person_id = ${persons.id})`,
      avatarDocId: sql<
        string | null
      >`(select d.id from ${documents} d where d.person_id = ${persons.id} and d.is_avatar = true order by d.created_at desc limit 1)`,
    })
    .from(persons)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(persons.updatedAt))
    .limit(opts.limit ?? 200);

  return rows.map((r) => ({
    ...r.person,
    phoneCount: Number(r.phoneCount ?? 0),
    emailCount: Number(r.emailCount ?? 0),
    noteCount: Number(r.noteCount ?? 0),
    documentCount: Number(r.documentCount ?? 0),
    relationshipCount: Number(r.relationshipCount ?? 0),
    avatarDocId: r.avatarDocId ?? null,
  }));
}

export async function getPerson(id: string): Promise<Person | null> {
  const [row] = await db.select().from(persons).where(eq(persons.id, id)).limit(1);
  return row ?? null;
}

export async function getPersonOptions(): Promise<
  { id: string; fullName: string; sensitivity: string }[]
> {
  return db
    .select({
      id: persons.id,
      fullName: persons.fullName,
      sensitivity: sql<string>`${persons.sensitivity}`,
    })
    .from(persons)
    .orderBy(asc(persons.fullName))
    .limit(500);
}

/* ------------------------------------- الملف الكامل ----------------------------------- */

function toDocumentView(row: typeof documents.$inferSelect): DocumentView {
  const token = signFileToken(row.id);
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    token,
    previewUrl: `/api/documents/${row.id}/file?token=${encodeURIComponent(token)}`,
    downloadUrl: `/api/documents/${row.id}/file?token=${encodeURIComponent(token)}&download=1`,
    isImage: row.mimeType.startsWith("image/"),
    isPdf: row.mimeType === "application/pdf",
  };
}

export async function getDossier(
  personId: string,
  profileKey: DossierProfileKey = "full",
): Promise<DossierPayload | null> {
  const person = await getPerson(personId);
  if (!person) return null;

  const profile = DOSSIER_PROFILES[profileKey];

  const [phoneRows, emailRows, socialRows, noteRows, relOut, relIn, docRows] =
    await Promise.all([
      db.select().from(phones).where(eq(phones.personId, personId)).orderBy(asc(phones.label)),
      db.select().from(emails).where(eq(emails.personId, personId)).orderBy(asc(emails.type)),
      db.select().from(socials).where(eq(socials.personId, personId)).orderBy(asc(socials.platform)),
      db
        .select()
        .from(notes)
        .where(eq(notes.personId, personId))
        .orderBy(sql`${notes.eventDate} desc nulls last, ${notes.recordedAt} desc`),
      db
        .select({ rel: relationships, otherName: persons.fullName })
        .from(relationships)
        .innerJoin(persons, eq(relationships.targetPersonId, persons.id))
        .where(eq(relationships.sourcePersonId, personId)),
      db
        .select({ rel: relationships, otherName: persons.fullName })
        .from(relationships)
        .innerJoin(persons, eq(relationships.sourcePersonId, persons.id))
        .where(eq(relationships.targetPersonId, personId)),
      db
        .select()
        .from(documents)
        .where(eq(documents.personId, personId))
        .orderBy(desc(documents.createdAt)),
    ]);

  const allNotes: DossierNote[] = noteRows.map((n) => ({
    ...n,
    recordedAt: n.recordedAt.toISOString(),
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));

  const filteredNotes = profile.excludeConfidential
    ? allNotes.filter((n) => !n.isConfidential)
    : allNotes;

  const relationshipViews: RelatedPersonView[] = [
    ...relOut.map((r) => ({
      relationshipId: r.rel.id,
      otherPersonId: r.rel.targetPersonId,
      otherName: r.otherName,
      direction: "outgoing" as const,
      type: r.rel.type,
      confidence: r.rel.confidence,
      contextNotes: r.rel.contextNotes,
    })),
    ...relIn.map((r) => ({
      relationshipId: r.rel.id,
      otherPersonId: r.rel.sourcePersonId,
      otherName: r.otherName,
      direction: "incoming" as const,
      type: r.rel.type,
      confidence: r.rel.confidence,
      contextNotes: r.rel.contextNotes,
    })),
  ].sort((a, b) => a.otherName.localeCompare(b.otherName, "ar"));

  const filteredDocs = profile.excludeMedia ? [] : docRows.map(toDocumentView);
  const allDocViews = docRows.map(toDocumentView);

  return {
    profile: profileKey,
    generatedAt: new Date().toISOString(),
    person,
    aliases: person.aliases
      .split(/[,،\n]/)
      .map((a) => a.trim())
      .filter(Boolean),
    phones: phoneRows,
    emails: emailRows,
    socials: socialRows.map((s) => ({
      id: s.id,
      platform: s.platform,
      handle: s.handle,
      profileUrl: s.profileUrl,
    })),
    notes: filteredNotes,
    relationships: relationshipViews,
    documents: filteredDocs,
    counts: {
      phones: phoneRows.length,
      emails: emailRows.length,
      socials: socialRows.length,
      notes: allNotes.length,
      confidentialNotes: allNotes.filter((n) => n.isConfidential).length,
      relationships: relationshipViews.length,
      documents: allDocViews.length,
      totalBytes: allDocViews.reduce((sum, d) => sum + d.sizeBytes, 0),
    },
    integrity: {
      fileCount: allDocViews.length,
      hashed: allDocViews.filter((d) => d.sha256.length === 64).length,
    },
  };
}

/* ------------------------------------ إحصائيات اللوحة ---------------------------------- */

export async function getDashboardStats() {
  const [personCount] = await db.select({ value: count() }).from(persons);
  const [noteCount] = await db.select({ value: count() }).from(notes);
  const [docCount] = await db.select({ value: count() }).from(documents);
  const [relCount] = await db.select({ value: count() }).from(relationships);
  const [confidentialCount] = await db
    .select({ value: count() })
    .from(notes)
    .where(eq(notes.isConfidential, true));
  const [topSecretCount] = await db
    .select({ value: count() })
    .from(persons)
    .where(eq(persons.sensitivity, "top_secret"));
  const [mediaBytes] = await db
    .select({ value: sql<number>`coalesce(sum(${documents.sizeBytes}), 0)` })
    .from(documents);

  const recentPersons = await db
    .select()
    .from(persons)
    .orderBy(desc(persons.updatedAt))
    .limit(6);

  const recentNotes = await db
    .select({ note: notes, personName: persons.fullName })
    .from(notes)
    .innerJoin(persons, eq(notes.personId, persons.id))
    .orderBy(desc(notes.recordedAt))
    .limit(6);

  const recentAudit = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(10);

  return {
    persons: Number(personCount?.value ?? 0),
    notes: Number(noteCount?.value ?? 0),
    documents: Number(docCount?.value ?? 0),
    relationships: Number(relCount?.value ?? 0),
    confidentialNotes: Number(confidentialCount?.value ?? 0),
    topSecret: Number(topSecretCount?.value ?? 0),
    mediaBytes: Number(mediaBytes?.value ?? 0),
    recentPersons,
    recentNotes: recentNotes.map((r) => ({
      id: r.note.id,
      title: r.note.title,
      category: r.note.category,
      isConfidential: r.note.isConfidential,
      personId: r.note.personId,
      personName: r.personName,
      recordedAt: r.note.recordedAt.toISOString(),
    })),
    recentAudit: recentAudit.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  };
}

/* --------------------------------- شبكة العلاقات (الرسم البياني) ------------------------------ */

export async function getNetworkGraph() {
  const [personRows, relRows] = await Promise.all([
    db
      .select({
        id: persons.id,
        fullName: persons.fullName,
        sensitivity: sql<string>`${persons.sensitivity}`,
        reliability: persons.reliability,
      })
      .from(persons)
      .orderBy(asc(persons.fullName))
      .limit(300),
    db
      .select({
        id: relationships.id,
        source: relationships.sourcePersonId,
        target: relationships.targetPersonId,
        type: relationships.type,
        confidence: relationships.confidence,
      })
      .from(relationships)
      .limit(2000),
  ]);
  return { nodes: personRows, links: relRows };
}

/* ------------------------------------- التحقق من الازدواج -------------------------------- */

export async function findDuplicateDocuments(sha256: string, excludeId?: string) {
  const rows = await db
    .select({ id: documents.id, originalName: documents.originalName })
    .from(documents)
    .where(
      excludeId
        ? and(eq(documents.sha256, sha256), sql`${documents.id} <> ${excludeId}`)
        : eq(documents.sha256, sha256),
    );
  return rows;
}

export async function countPersons() {
  const [row] = await db.select({ value: count() }).from(persons);
  return Number(row?.value ?? 0);
}

export async function hasAnyData() {
  const rows = await db
    .select({ id: persons.id })
    .from(persons)
    .where(isNotNull(persons.id))
    .limit(1);
  return rows.length > 0;
}
