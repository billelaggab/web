import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  emails,
  notes,
  persons,
  phones,
  relationships,
  socials,
  type Confidence,
  type EmailType,
  type NoteCategory,
  type PhoneLabel,
  type RelationshipType,
} from "@/db/schema";
import { logAudit } from "@/db/queries";
import { reindexPerson } from "@/lib/search";
import {
  badRequest,
  errorResponse,
  jsonBody,
  notFound,
  optBool,
  optDate,
  optOneOf,
  optString,
  reqString,
  reqUuid,
  sanitizeUrl,
  toE164,
  normalizeEmail,
} from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PHONE_LABELS = ["personal", "work", "burner"] as const;
const EMAIL_TYPES = ["primary", "leaked", "secure"] as const;
const NOTE_CATEGORIES = ["meeting", "financial", "background", "leak"] as const;
const REL_TYPES = [
  "lawyer",
  "business_partner",
  "relative",
  "accomplice",
  "adversary",
  "whistleblower",
  "associate",
] as const;
const CONFIDENCE = ["confirmed", "suspected"] as const;
const KINDS = ["phone", "email", "social", "note", "relationship"] as const;

/** POST /api/records — إنشاء سجل فرعي لأي كيان (قنوات الاتصال، الملاحظات، العلاقات) */
export async function POST(request: Request) {
  try {
    const body = jsonBody(await request.json());
    const kind = optOneOf(body.kind, KINDS, "kind");
    if (!kind) badRequest("نوع السجل (kind) غير صالح");

    const personId = reqUuid(body.personId, "personId");
    const [person] = await db.select().from(persons).where(eq(persons.id, personId)).limit(1);
    if (!person) notFound("الشخص غير موجود");

    switch (kind) {
      case "phone": {
        const [row] = await db
          .insert(phones)
          .values({
            personId,
            number: toE164(reqString(body.number, "number", 5, 30)),
            label: optOneOf<PhoneLabel>(body.label, PHONE_LABELS, "label") ?? "personal",
            whatsapp: optBool(body.whatsapp) ?? false,
            signal: optBool(body.signal) ?? false,
            telegram: optBool(body.telegram) ?? false,
            carrierNotes: optString(body.carrierNotes, "carrierNotes", 500) ?? "",
          })
          .returning();
        await reindexPerson(personId);
        await logAudit("create", "phone", row?.id ?? null, `إضافة رقم لـ ${person.fullName}`);
        return Response.json({ ok: true, record: row }, { status: 201 });
      }
      case "email": {
        const [row] = await db
          .insert(emails)
          .values({
            personId,
            address: normalizeEmail(reqString(body.address, "address", 5, 200)),
            type: optOneOf<EmailType>(body.type, EMAIL_TYPES, "type") ?? "primary",
            pgpPublicKey: optString(body.pgpPublicKey, "pgpPublicKey", 8000) ?? "",
          })
          .returning();
        await reindexPerson(personId);
        await logAudit("create", "email", row?.id ?? null, `إضافة بريد لـ ${person.fullName}`);
        return Response.json({ ok: true, record: row }, { status: 201 });
      }
      case "social": {
        const [row] = await db
          .insert(socials)
          .values({
            personId,
            platform: reqString(body.platform, "platform", 1, 100),
            handle: reqString(body.handle, "handle", 1, 200),
            profileUrl: sanitizeUrl(optString(body.profileUrl, "profileUrl", 600)),
          })
          .returning();
        await reindexPerson(personId);
        await logAudit("create", "social", row?.id ?? null, `إضافة حساب لـ ${person.fullName}`);
        return Response.json({ ok: true, record: row }, { status: 201 });
      }
      case "note": {
        const [row] = await db
          .insert(notes)
          .values({
            personId,
            title: reqString(body.title, "title", 2, 250),
            content: optString(body.content, "content", 30000) ?? "",
            category: optOneOf<NoteCategory>(body.category, NOTE_CATEGORIES, "category") ?? "meeting",
            eventDate: optDate(body.eventDate, "eventDate") ?? null,
            isConfidential: optBool(body.isConfidential) ?? false,
          })
          .returning();
        await reindexPerson(personId);
        await logAudit("create", "note", row?.id ?? null, `إضافة ملاحظة لـ ${person.fullName}`);
        return Response.json({ ok: true, record: row }, { status: 201 });
      }
      case "relationship": {
        const targetPersonId = reqUuid(body.targetPersonId, "targetPersonId");
        if (targetPersonId === personId) {
          badRequest("لا يمكن ربط الشخص بنفسه");
        }
        const [target] = await db
          .select()
          .from(persons)
          .where(eq(persons.id, targetPersonId))
          .limit(1);
        if (!target) notFound("الشخص الهدف غير موجود");
        const type = optOneOf<RelationshipType>(body.type, REL_TYPES, "type") ?? "associate";
        const existing = await db
          .select({ id: relationships.id })
          .from(relationships)
          .where(
            and(
              eq(relationships.sourcePersonId, personId),
              eq(relationships.targetPersonId, targetPersonId),
              eq(relationships.type, type),
              ne(relationships.sourcePersonId, targetPersonId),
            ),
          )
          .limit(1);
        if (existing.length) badRequest("العلاقة موجودة مسبقاً بنفس النوع");

        const [row] = await db
          .insert(relationships)
          .values({
            sourcePersonId: personId,
            targetPersonId,
            type,
            confidence: optOneOf<Confidence>(body.confidence, CONFIDENCE, "confidence") ?? "suspected",
            contextNotes: optString(body.contextNotes, "contextNotes", 2000) ?? "",
          })
          .returning();
        await reindexPerson(personId);
        await logAudit(
          "create",
          "relationship",
          row?.id ?? null,
          `ربط ${person.fullName} ↔ ${target.fullName}`,
        );
        return Response.json({ ok: true, record: row }, { status: 201 });
      }
      default:
        badRequest("نوع غير مدعوم");
    }
  } catch (error) {
    return errorResponse(error);
  }
}
