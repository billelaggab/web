import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  emails,
  notes,
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
  reqUuid,
  sanitizeUrl,
  toE164,
  normalizeEmail,
} from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KINDS = ["phone", "email", "social", "note", "relationship"] as const;
type Kind = (typeof KINDS)[number];

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

type Ctx = { params: Promise<{ kind: string; id: string }> };

async function resolve(ctx: Ctx): Promise<{ kind: Kind; id: string; personId: string }> {
  const { kind, id } = await ctx.params;
  if (!KINDS.includes(kind as Kind)) badRequest("نوع السجل غير مدعوم");
  reqUuid(id, "id");
  const k = kind as Kind;

  const personId = await (async () => {
    switch (k) {
      case "phone": {
        const [row] = await db.select().from(phones).where(eq(phones.id, id)).limit(1);
        if (!row) notFound("السجل غير موجود");
        return row.personId;
      }
      case "email": {
        const [row] = await db.select().from(emails).where(eq(emails.id, id)).limit(1);
        if (!row) notFound("السجل غير موجود");
        return row.personId;
      }
      case "social": {
        const [row] = await db.select().from(socials).where(eq(socials.id, id)).limit(1);
        if (!row) notFound("السجل غير موجود");
        return row.personId;
      }
      case "note": {
        const [row] = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
        if (!row) notFound("السجل غير موجود");
        return row.personId;
      }
      default: {
        const [row] = await db
          .select()
          .from(relationships)
          .where(eq(relationships.id, id))
          .limit(1);
        if (!row) notFound("السجل غير موجود");
        return row.sourcePersonId;
      }
    }
  })();

  return { kind: k, id, personId };
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { kind, id, personId } = await resolve(ctx);
    const body = jsonBody(await request.json());

    switch (kind) {
      case "phone": {
        const patch: Partial<typeof phones.$inferInsert> = {};
        const number = optString(body.number, "number", 30);
        if (number !== undefined) patch.number = toE164(number);
        const label = optOneOf<PhoneLabel>(body.label, PHONE_LABELS, "label");
        if (label !== undefined) patch.label = label;
        const whatsapp = optBool(body.whatsapp);
        if (whatsapp !== undefined) patch.whatsapp = whatsapp;
        const signal = optBool(body.signal);
        if (signal !== undefined) patch.signal = signal;
        const telegram = optBool(body.telegram);
        if (telegram !== undefined) patch.telegram = telegram;
        const carrierNotes = optString(body.carrierNotes, "carrierNotes", 500);
        if (carrierNotes !== undefined) patch.carrierNotes = carrierNotes;
        const [row] = await db.update(phones).set(patch).where(eq(phones.id, id)).returning();
        await reindexPerson(personId);
        return Response.json({ ok: true, record: row });
      }
      case "email": {
        const patch: Partial<typeof emails.$inferInsert> = {};
        const address = optString(body.address, "address", 200);
        if (address !== undefined) patch.address = normalizeEmail(address);
        const type = optOneOf<EmailType>(body.type, EMAIL_TYPES, "type");
        if (type !== undefined) patch.type = type;
        const pgp = optString(body.pgpPublicKey, "pgpPublicKey", 8000);
        if (pgp !== undefined) patch.pgpPublicKey = pgp;
        const [row] = await db.update(emails).set(patch).where(eq(emails.id, id)).returning();
        await reindexPerson(personId);
        return Response.json({ ok: true, record: row });
      }
      case "social": {
        const patch: Partial<typeof socials.$inferInsert> = {};
        const platform = optString(body.platform, "platform", 100);
        if (platform !== undefined) patch.platform = platform;
        const handle = optString(body.handle, "handle", 200);
        if (handle !== undefined) patch.handle = handle;
        const url = optString(body.profileUrl, "profileUrl", 600);
        if (url !== undefined) patch.profileUrl = sanitizeUrl(url);
        const [row] = await db.update(socials).set(patch).where(eq(socials.id, id)).returning();
        await reindexPerson(personId);
        return Response.json({ ok: true, record: row });
      }
      case "note": {
        const patch: Partial<typeof notes.$inferInsert> = { updatedAt: new Date() };
        const title = optString(body.title, "title", 250);
        if (title !== undefined) patch.title = title;
        const content = optString(body.content, "content", 30000);
        if (content !== undefined) patch.content = content;
        const category = optOneOf<NoteCategory>(body.category, NOTE_CATEGORIES, "category");
        if (category !== undefined) patch.category = category;
        const eventDate = optDate(body.eventDate, "eventDate");
        if (eventDate !== undefined) patch.eventDate = eventDate || null;
        const isConfidential = optBool(body.isConfidential);
        if (isConfidential !== undefined) patch.isConfidential = isConfidential;
        const [row] = await db.update(notes).set(patch).where(eq(notes.id, id)).returning();
        await reindexPerson(personId);
        await logAudit("update", "note", id, "تحديث ملاحظة استخبارية");
        return Response.json({ ok: true, record: row });
      }
      default: {
        const patch: Partial<typeof relationships.$inferInsert> = {};
        const type = optOneOf<RelationshipType>(body.type, REL_TYPES, "type");
        if (type !== undefined) patch.type = type;
        const confidence = optOneOf<Confidence>(body.confidence, CONFIDENCE, "confidence");
        if (confidence !== undefined) patch.confidence = confidence;
        const contextNotes = optString(body.contextNotes, "contextNotes", 2000);
        if (contextNotes !== undefined) patch.contextNotes = contextNotes;
        const [row] = await db
          .update(relationships)
          .set(patch)
          .where(eq(relationships.id, id))
          .returning();
        await reindexPerson(personId);
        return Response.json({ ok: true, record: row });
      }
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { kind, id, personId } = await resolve(ctx);
    switch (kind) {
      case "phone":
        await db.delete(phones).where(eq(phones.id, id));
        break;
      case "email":
        await db.delete(emails).where(eq(emails.id, id));
        break;
      case "social":
        await db.delete(socials).where(eq(socials.id, id));
        break;
      case "note":
        await db.delete(notes).where(eq(notes.id, id));
        break;
      default:
        await db.delete(relationships).where(eq(relationships.id, id));
    }
    await reindexPerson(personId);
    await logAudit("delete", kind, id, `حذف سجل (${kind})`);
    return Response.json({ ok: true, deleted: id });
  } catch (error) {
    return errorResponse(error);
  }
}
