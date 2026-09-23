import { db } from "@/db";
import {
  emails,
  notes,
  persons,
  phones,
  socials,
  type EmailType,
  type NoteCategory,
  type PhoneLabel,
  type Sensitivity,
} from "@/db/schema";
import { listPersons, logAudit } from "@/db/queries";
import { reindexPerson } from "@/lib/search";
import {
  badRequest,
  errorResponse,
  jsonBody,
  optArray,
  optBool,
  optDate,
  optInt,
  optOneOf,
  optString,
  reqString,
  toE164,
  normalizeEmail,
} from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SENSITIVITY = ["public", "confidential", "top_secret"] as const;
const PHONE_LABELS = ["personal", "work", "burner"] as const;
const EMAIL_TYPES = ["primary", "leaked", "secure"] as const;
const NOTE_CATEGORIES = ["meeting", "financial", "background", "leak"] as const;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rows = await listPersons({
      q: url.searchParams.get("q") ?? undefined,
      sensitivity: url.searchParams.get("sensitivity") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 200),
    });
    return Response.json({ ok: true, count: rows.length, persons: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = jsonBody(await request.json());

    const fullName = reqString(body.fullName, "fullName", 2, 200);
    const reliability = optInt(body.reliability, 1, 5) ?? 3;
    const sensitivity = optOneOf<Sensitivity>(body.sensitivity, SENSITIVITY, "sensitivity") ?? "confidential";

    const [person] = await db
      .insert(persons)
      .values({
        fullName,
        aliases: optString(body.aliases, "aliases", 1000) ?? "",
        dateOfBirth: optDate(body.dateOfBirth, "dateOfBirth") ?? null,
        nationality: optString(body.nationality, "nationality", 120) ?? "",
        occupation: optString(body.occupation, "occupation", 200) ?? "",
        address: optString(body.address, "address", 500) ?? "",
        summary: optString(body.summary, "summary", 4000) ?? "",
        reliability,
        sensitivity,
      })
      .returning();

    if (!person) badRequest("تعذّر إنشاء الملف");

    /* ---------------------------- السجلات المترابطة (Nested writes) --------------------------- */
    const phoneInput = optArray(body.phones, "phones") ?? [];
    if (phoneInput.length) {
      await db.insert(phones).values(
        phoneInput.map((raw) => {
          const item = raw as Record<string, unknown>;
          return {
            personId: person.id,
            number: toE164(reqString(item.number, "phones[].number", 5, 30)),
            label: optOneOf<PhoneLabel>(item.label, PHONE_LABELS, "phones[].label") ?? "personal",
            whatsapp: optBool(item.whatsapp) ?? false,
            signal: optBool(item.signal) ?? false,
            telegram: optBool(item.telegram) ?? false,
            carrierNotes: optString(item.carrierNotes, "phones[].carrierNotes", 500) ?? "",
          };
        }),
      );
    }

    const emailInput = optArray(body.emails, "emails") ?? [];
    if (emailInput.length) {
      await db.insert(emails).values(
        emailInput.map((raw) => {
          const item = raw as Record<string, unknown>;
          return {
            personId: person.id,
            address: normalizeEmail(reqString(item.address, "emails[].address", 5, 200)),
            type: optOneOf<EmailType>(item.type, EMAIL_TYPES, "emails[].type") ?? "primary",
            pgpPublicKey: optString(item.pgpPublicKey, "emails[].pgpPublicKey", 6000) ?? "",
          };
        }),
      );
    }

    const socialInput = optArray(body.socials, "socials") ?? [];
    if (socialInput.length) {
      await db.insert(socials).values(
        socialInput.map((raw) => {
          const item = raw as Record<string, unknown>;
          return {
            personId: person.id,
            platform: reqString(item.platform, "socials[].platform", 1, 100),
            handle: reqString(item.handle, "socials[].handle", 1, 200),
            profileUrl: optString(item.profileUrl, "socials[].profileUrl", 600) ?? "",
          };
        }),
      );
    }

    const noteInput = optArray(body.notes, "notes") ?? [];
    if (noteInput.length) {
      await db.insert(notes).values(
        noteInput.map((raw) => {
          const item = raw as Record<string, unknown>;
          return {
            personId: person.id,
            title: reqString(item.title, "notes[].title", 2, 250),
            content: optString(item.content, "notes[].content", 30000) ?? "",
            category:
              optOneOf<NoteCategory>(item.category, NOTE_CATEGORIES, "notes[].category") ?? "meeting",
            eventDate: optDate(item.eventDate, "notes[].eventDate") ?? null,
            isConfidential: optBool(item.isConfidential) ?? false,
          };
        }),
      );
    }

    await reindexPerson(person.id);
    await logAudit("create", "person", person.id, `إنشاء ملف: ${person.fullName}`);

    return Response.json({ ok: true, person }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
