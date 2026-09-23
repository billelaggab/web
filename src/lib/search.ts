/**
 * محرّك البحث الموحّد + خط أنابيب الفهرسة.
 *
 * التصميم: طبقتان
 *  1) طبقة PostgreSQL: فهرس داخلي (search_docs) يحتوي نصاً مطبَّعاً (تطبيع عربي كامل) مع
 *     مطابقة ضبابية وتحمل للأخطاء المطبعية داخل التطبيق — تعمل بدون أي خدمة خارجية (Air-gap).
 *  2) طبقة Meilisearch (اختيارية): إذا ضُبط المتغير MEILISEARCH_HOST يتم استعلام الفهرس البعيد،
 *     مع تراجع تلقائي إلى PostgreSQL عند أي فشل. المخططان متطابقان تماماً.
 */
import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  documents,
  emails,
  notes,
  persons,
  phones,
  searchDocs,
  socials,
  type SearchEntityType,
} from "@/db/schema";
import { fuzzyMatch, normalizeArabic, snippet, tokenize } from "@/lib/arabic";
import { SEARCH_ENTITY_LABELS } from "@/lib/constants";
import type { SearchHit, SearchResponse } from "@/lib/types";

type DocRow = typeof searchDocs.$inferSelect;

const MEILI_HOST = process.env.MEILISEARCH_HOST?.replace(/\/$/, "");
const MEILI_KEY = process.env.MEILISEARCH_API_KEY;
const MEILI_INDEX = process.env.MEILISINDEX_INDEX ?? process.env.MEILI_INDEX ?? "icims";

/* ----------------------------------- بناء مستندات الفهرس ---------------------------------- */

type IndexableDoc = {
  entityType: SearchEntityType;
  entityId: string;
  personId: string | null;
  title: string;
  subtitle?: string;
  body?: string;
  weight?: number;
};

function normalizedOf(...parts: (string | null | undefined)[]): string {
  return normalizeArabic(parts.filter(Boolean).join(" "));
}

async function buildDocsForPerson(personId: string): Promise<IndexableDoc[]> {
  const [person] = await db.select().from(persons).where(eq(persons.id, personId)).limit(1);
  if (!person) return [];

  const [phoneRows, emailRows, socialRows, noteRows, docRows] = await Promise.all([
    db.select().from(phones).where(eq(phones.personId, personId)),
    db.select().from(emails).where(eq(emails.personId, personId)),
    db.select().from(socials).where(eq(socials.personId, personId)),
    db.select().from(notes).where(eq(notes.personId, personId)),
    db.select().from(documents).where(eq(documents.personId, personId)),
  ]);

  const docs: IndexableDoc[] = [
    {
      entityType: "person",
      entityId: person.id,
      personId: person.id,
      title: person.fullName,
      subtitle: [person.occupation, person.nationality].filter(Boolean).join(" • "),
      body: [person.aliases, person.summary, person.address].filter(Boolean).join(" \n "),
      weight: 10,
    },
  ];

  for (const p of phoneRows) {
    docs.push({
      entityType: "phone",
      entityId: p.id,
      personId,
      title: p.number,
      subtitle: person.fullName,
      body: [p.carrierNotes, p.label].join(" "),
      weight: 6,
    });
  }
  for (const e of emailRows) {
    docs.push({
      entityType: "email",
      entityId: e.id,
      personId,
      title: e.address,
      subtitle: person.fullName,
      body: e.pgpPublicKey.slice(0, 400),
      weight: 6,
    });
  }
  for (const s of socialRows) {
    docs.push({
      entityType: "social",
      entityId: s.id,
      personId,
      title: `${s.platform}: ${s.handle}`,
      subtitle: person.fullName,
      body: s.profileUrl,
      weight: 4,
    });
  }
  for (const n of noteRows) {
    docs.push({
      entityType: "note",
      entityId: n.id,
      personId,
      title: n.title,
      subtitle: person.fullName,
      body: n.content.slice(0, 4000),
      weight: n.isConfidential ? 3 : 5,
    });
  }
  for (const d of docRows) {
    docs.push({
      entityType: "document",
      entityId: d.id,
      personId,
      title: d.originalName,
      subtitle: person.fullName,
      body: [d.description, d.mimeType, d.sha256].join(" "),
      weight: 4,
    });
  }
  return docs;
}

/** إعادة فهرسة شخص واحد (تُستدعى بعد كل عملية كتابة — Write-through pipeline) */
export async function reindexPerson(personId: string): Promise<number> {
  const docs = await buildDocsForPerson(personId);
  await db.delete(searchDocs).where(eq(searchDocs.personId, personId));
  if (!docs.length) return 0;
  await db.insert(searchDocs).values(
    docs.map((d) => ({
      entityType: d.entityType,
      entityId: d.entityId,
      personId: d.personId,
      title: d.title,
      subtitle: d.subtitle ?? "",
      body: d.body ?? "",
      normalized: normalizedOf(d.title, d.subtitle, d.body),
      weight: d.weight ?? 1,
      updatedAt: new Date(),
    })),
  );
  return docs.length;
}

/** إعادة الفهرسة الكاملة (زر "إعادة بناء الفهرس" في الإعدادات) */
export async function reindexAll(): Promise<{ persons: number; documents: number }> {
  const personRows = await db.select({ id: persons.id }).from(persons);
  await db.delete(searchDocs);
  let total = 0;
  for (const p of personRows) {
    total += await reindexPerson(p.id);
  }
  return { persons: personRows.length, documents: total };
}

/** مزامنة مستندات Meilisearch (تُستخدم عند توفّر الخدمة فقط) */
export async function syncToMeilisearch(): Promise<{ ok: boolean; detail: string }> {
  if (!MEILI_HOST) return { ok: false, detail: "MEILISEARCH_HOST غير مضبوط — تعمل الطبقة المحلية." };
  try {
    const rows = await db.select().from(searchDocs).limit(50000);
    const res = await fetch(`${MEILI_HOST}/indexes/${MEILI_INDEX}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(MEILI_KEY ? { Authorization: `Bearer ${MEILI_KEY}` } : {}),
      },
      body: JSON.stringify(
        rows.map((r) => ({
          id: r.id,
          entityType: r.entityType,
          entityId: r.entityId,
          personId: r.personId,
          title: r.title,
          subtitle: r.subtitle,
          body: r.body,
          normalized: r.normalized,
          weight: r.weight,
        })),
      ),
    });
    return { ok: res.ok, detail: res.ok ? "تمت المزامنة." : `فشل: ${res.status}` };
  } catch (error) {
    return { ok: false, detail: `تعذّر الاتصال: ${(error as Error).message}` };
  }
}

/* --------------------------------------- تنفيذ البحث -------------------------------------- */

function hrefFor(hit: Pick<DocRow, "entityType" | "personId" | "entityId">): string {
  const base = hit.personId ? `/persons/${hit.personId}` : "/persons";
  switch (hit.entityType) {
    case "phone":
    case "email":
    case "social":
      return `${base}?tab=contacts`;
    case "note":
      return `${base}?tab=notes`;
    case "document":
      return `${base}?tab=media`;
    default:
      return base;
  }
}

function scoreDoc(row: DocRow, tokens: string[]): number {
  if (!tokens.length) return 0;
  const words = row.normalized.split(" ");
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const word of words) {
      const s = fuzzyMatch(word, token);
      if (s > best) best = s;
      if (best === 1) break;
    }
    if (best === 0) return 0; // كل الكلمات يجب أن تتحقق
    total += best;
  }
  return total * row.weight;
}

async function searchViaMeili(query: string, tokens: string[], limit: number) {
  if (!MEILI_HOST) return null;
  try {
    const res = await fetch(`${MEILI_HOST}/indexes/${MEILI_INDEX}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(MEILI_KEY ? { Authorization: `Bearer ${MEILI_KEY}` } : {}),
      },
      body: JSON.stringify({ q: tokens.join(" "), limit: limit * 6, attributesToHighlight: ["*"] }),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { hits?: Record<string, unknown>[] };
    if (!payload.hits?.length) return null;
    return payload.hits;
  } catch {
    return null;
  }
}

export async function searchAll(rawQuery: string, limit = 20): Promise<SearchResponse> {
  const started = Date.now();
  const tokens = tokenize(rawQuery);
  const empty: SearchResponse = {
    query: rawQuery,
    engine: "postgres",
    tookMs: 0,
    persons: [],
    total: 0,
  };
  if (!tokens.length) return { ...empty, tookMs: Date.now() - started };

  let engine: "postgres" | "meilisearch" = "postgres";
  let rows: DocRow[] = [];

  const meiliHits = await searchViaMeili(rawQuery, tokens, limit);
  if (meiliHits) {
    engine = "meilisearch";
    const ids = meiliHits
      .map((h) => String(h.id ?? ""))
      .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    if (ids.length) {
      rows = await db.select().from(searchDocs).where(inArray(searchDocs.id, ids));
    }
  }

  if (!rows.length) {
    engine = "postgres";
    const like = `%${tokens[0]}%`;
    const direct = await db
      .select()
      .from(searchDocs)
      .where(or(...tokens.map((t) => sql`${searchDocs.normalized} like ${`%${t}%`}`)))
      .orderBy(desc(searchDocs.weight))
      .limit(600);
    rows = direct;
    if (direct.length < 40) {
      const pool = await db
        .select()
        .from(searchDocs)
        .orderBy(desc(searchDocs.weight), desc(searchDocs.updatedAt))
        .limit(1500);
      const seen = new Set(rows.map((r) => r.id));
      for (const p of pool) if (!seen.has(p.id)) rows.push(p);
    }
  }

  const personMap = new Map<
    string,
    { fullName: string; sensitivity: string; reliability: number; score: number; hits: SearchHit[] }
  >();

  for (const row of rows) {
    const score = scoreDoc(row, tokens);
    if (score <= 0) continue;
    const personKey = row.personId ?? row.entityId;
    const sourceText = row.body || row.subtitle;
    const hit: SearchHit = {
      entityType: row.entityType,
      entityId: row.entityId,
      personId: row.personId,
      title: row.title,
      subtitle: row.subtitle,
      snippet: snippet(sourceText || row.title, tokens),
      score,
      href: hrefFor(row),
    };
    const entry = personMap.get(personKey);
    if (entry) {
      entry.score += score;
      if (row.entityType === "person") {
        entry.fullName = row.title;
        entry.sensitivity = "confidential";
        entry.reliability = 3;
      }
      entry.hits.push(hit);
    } else {
      personMap.set(personKey, {
        fullName: row.entityType === "person" ? row.title : row.subtitle || SEARCH_ENTITY_LABELS[row.entityType],
        sensitivity: "confidential",
        reliability: 3,
        score,
        hits: [hit],
      });
    }
  }

  const personIds = [...personMap.keys()].filter((k) =>
    /^[0-9a-f-]{36}$/i.test(k),
  );
  const personRows = personIds.length
    ? await db
        .select({
          id: persons.id,
          fullName: persons.fullName,
          sensitivity: sql<string>`${persons.sensitivity}`,
          reliability: persons.reliability,
        })
        .from(persons)
        .where(inArray(persons.id, personIds))
    : [];
  const personInfo = new Map(personRows.map((p) => [p.id, p]));

  const grouped = [...personMap.entries()]
    .map(([personId, entry]) => {
      const info = personInfo.get(personId);
      return {
        personId,
        fullName: info?.fullName ?? entry.fullName,
        sensitivity: (info?.sensitivity ?? "confidential") as SearchResponse["persons"][number]["sensitivity"],
        reliability: info?.reliability ?? entry.reliability,
        occupation: "",
        score: entry.score,
        hits: entry.hits.sort((a, b) => b.score - a.score).slice(0, 6),
      };
    })
    .filter((g) => personInfo.has(g.personId))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    query: rawQuery,
    engine,
    tookMs: Date.now() - started,
    persons: grouped,
    total: grouped.reduce((sum, g) => sum + g.hits.length, 0),
  };
}
