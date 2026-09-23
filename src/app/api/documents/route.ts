import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, persons, type EntityType } from "@/db/schema";
import { findDuplicateDocuments, logAudit } from "@/db/queries";
import { reindexPerson } from "@/lib/search";
import {
  buildStoredName,
  ensureMediaDir,
  isAllowedExtension,
  isAllowedMime,
  MEDIA_DIR,
  resolveMediaPath,
  sanitizeOriginalFilename,
  sha256Buffer,
  signFileToken,
} from "@/lib/security";
import {
  badRequest,
  errorResponse,
  notFound,
  optString,
  reqString,
  reqUuid,
} from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_BYTES = 60 * 1024 * 1024; // 60MB لكل ملف
const ENTITY_TYPES = ["person", "note", "relationship"] as const;

function docView(row: typeof documents.$inferSelect) {
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

/** GET /api/documents?personId=... — قائمة المستندات مع رموز وصول مؤقتة */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const personId = url.searchParams.get("personId");
    if (!personId) badRequest("personId مطلوب");
    const rows = await db.select().from(documents).where(eq(documents.personId, personId));
    return Response.json({ ok: true, documents: rows.map(docView) });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/documents — رفع جماعي (multipart/form-data)
 * الحقول: files (متعدد)، personId، description، entityType، entityId، isAvatar
 * كل ملف يُخزَّن باسم UUID معقّم، ويُحسب له SHA-256 لسلسلة العهدة.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const personId = reqUuid(form.get("personId"), "personId");
    const [person] = await db.select().from(persons).where(eq(persons.id, personId)).limit(1);
    if (!person) notFound("الشخص غير موجود");

    const description = optString(form.get("description"), "description", 1000) ?? "";
    const entityTypeRaw = optString(form.get("entityType"), "entityType", 40) ?? "person";
    if (!ENTITY_TYPES.includes(entityTypeRaw as EntityType)) badRequest("entityType غير صالح");
    const entityType = entityTypeRaw as EntityType;
    const entityIdRaw = optString(form.get("entityId"), "entityId", 64) ?? personId;
    const entityId = reqUuid(entityIdRaw, "entityId");
    const isAvatar = form.get("isAvatar") === "true" || form.get("isAvatar") === "1";

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) badRequest("لم يتم إرسال أي ملف");
    if (files.length > 25) badRequest("الحد الأقصى 25 ملفاً في العملية الواحدة");

    await ensureMediaDir();

    const created: ReturnType<typeof docView>[] = [];
    const skipped: { name: string; reason: string }[] = [];

    for (const file of files) {
      const originalName = sanitizeOriginalFilename(file.name || "file");
      if (!isAllowedExtension(originalName)) {
        skipped.push({ name: originalName, reason: "امتداد غير مسموح" });
        continue;
      }
      const mime = file.type || "application/octet-stream";
      if (!isAllowedMime(mime)) {
        skipped.push({ name: originalName, reason: "نوع MIME غير مسموح" });
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        skipped.push({ name: originalName, reason: "الحجم يتجاوز 60 م.ب" });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const sha256 = sha256Buffer(buffer);
      const storedName = buildStoredName(originalName);
      const targetPath = resolveMediaPath(storedName);
      if (!targetPath) {
        skipped.push({ name: originalName, reason: "اسم تخزين غير صالح" });
        continue;
      }

      const dupes = await findDuplicateDocuments(sha256);
      await fs.writeFile(targetPath, new Uint8Array(buffer), { mode: 0o640 });

      const [row] = await db
        .insert(documents)
        .values({
          entityType,
          entityId,
          personId,
          storedName,
          originalName,
          mimeType: mime,
          sizeBytes: buffer.byteLength,
          sha256,
          description,
          isAvatar: isAvatar && mime.startsWith("image/"),
        })
        .returning();

      if (row) {
        if (row.isAvatar) {
          await db.update(persons).set({ avatarPath: storedName }).where(eq(persons.id, personId));
        }
        created.push(docView(row));
      }
    }

    await reindexPerson(personId);
    await logAudit(
      "upload",
      "document",
      personId,
      `رفع ${created.length} ملف لـ ${person.fullName}${skipped.length ? ` — تم تجاهل ${skipped.length}` : ""}`,
    );

    return Response.json(
      { ok: true, mediaDir: MEDIA_DIR, created, skipped, duplicates: true },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
