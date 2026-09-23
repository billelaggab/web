import { eq } from "drizzle-orm";
import { db } from "@/db";
import { persons, searchDocs, type Sensitivity } from "@/db/schema";
import { getDossier, getPerson, logAudit } from "@/db/queries";
import { reindexPerson } from "@/lib/search";
import type { DossierProfileKey } from "@/lib/constants";
import {
  errorResponse,
  jsonBody,
  notFound,
  optDate,
  optInt,
  optOneOf,
  optString,
  reqUuid,
} from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SENSITIVITY = ["public", "confidential", "top_secret"] as const;
const PROFILES = ["full", "no_confidential", "no_media", "minimal"] as const;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    reqUuid(id, "id");
    const url = new URL(request.url);
    const profile = optOneOf<DossierProfileKey>(
      url.searchParams.get("profile"),
      PROFILES,
      "profile",
    ) ?? "full";
    const dossier = await getDossier(id, profile);
    if (!dossier) notFound("الملف المطلوب غير موجود");
    return Response.json({ ok: true, dossier });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    reqUuid(id, "id");
    const existing = await getPerson(id);
    if (!existing) notFound("الملف المطلوب غير موجود");

    const body = jsonBody(await request.json());
    const patch: Partial<typeof persons.$inferInsert> = { updatedAt: new Date() };

    const fullName = optString(body.fullName, "fullName", 200);
    if (fullName !== undefined) {
      if (fullName.length < 2) notFound("الاسم قصير جداً");
      patch.fullName = fullName;
    }
    const aliases = optString(body.aliases, "aliases", 1000);
    if (aliases !== undefined) patch.aliases = aliases;
    const nationality = optString(body.nationality, "nationality", 120);
    if (nationality !== undefined) patch.nationality = nationality;
    const occupation = optString(body.occupation, "occupation", 200);
    if (occupation !== undefined) patch.occupation = occupation;
    const address = optString(body.address, "address", 500);
    if (address !== undefined) patch.address = address;
    const summary = optString(body.summary, "summary", 4000);
    if (summary !== undefined) patch.summary = summary;
    const dateOfBirth = optDate(body.dateOfBirth, "dateOfBirth");
    if (dateOfBirth !== undefined) patch.dateOfBirth = dateOfBirth || null;
    const reliability = optInt(body.reliability, 1, 5);
    if (reliability !== undefined) patch.reliability = reliability;
    const sensitivity = optOneOf<Sensitivity>(body.sensitivity, SENSITIVITY, "sensitivity");
    if (sensitivity !== undefined) patch.sensitivity = sensitivity;

    const [updated] = await db.update(persons).set(patch).where(eq(persons.id, id)).returning();
    await reindexPerson(id);
    await logAudit("update", "person", id, `تحديث ملف: ${updated?.fullName ?? id}`);
    return Response.json({ ok: true, person: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    reqUuid(id, "id");
    const existing = await getPerson(id);
    if (!existing) notFound("الملف المطلوب غير موجود");
    await db.delete(searchDocs).where(eq(searchDocs.personId, id));
    await db.delete(persons).where(eq(persons.id, id));
    await logAudit("delete", "person", id, `حذف ملف: ${existing.fullName}`);
    return Response.json({ ok: true, deleted: id });
  } catch (error) {
    return errorResponse(error);
  }
}
