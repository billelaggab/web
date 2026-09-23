import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, persons } from "@/db/schema";
import { logAudit } from "@/db/queries";
import { reindexPerson } from "@/lib/search";
import { resolveMediaPath, signFileToken } from "@/lib/security";
import { errorResponse, jsonBody, notFound, optBool, optString, reqUuid } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    reqUuid(id, "id");
    const [existing] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!existing) notFound("المستند غير موجود");

    const body = jsonBody(await request.json());
    const patch: Partial<typeof documents.$inferInsert> = {};
    const description = optString(body.description, "description", 1000);
    if (description !== undefined) patch.description = description;
    const isAvatar = optBool(body.isAvatar);
    if (isAvatar !== undefined) patch.isAvatar = isAvatar;

    const [row] = await db.update(documents).set(patch).where(eq(documents.id, id)).returning();
    if (row?.isAvatar && row.personId) {
      await db.update(persons).set({ avatarPath: row.storedName }).where(eq(persons.id, row.personId));
    }
    if (existing.personId) await reindexPerson(existing.personId);
    return Response.json({ ok: true, document: row, token: signFileToken(id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    reqUuid(id, "id");
    const [existing] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!existing) notFound("المستند غير موجود");

    const path = resolveMediaPath(existing.storedName);
    await db.delete(documents).where(eq(documents.id, id));
    if (path) {
      await fs.rm(path, { force: true }).catch(() => undefined);
    }
    if (existing.personId) {
      if (existing.isAvatar) {
        await db.update(persons).set({ avatarPath: null }).where(eq(persons.id, existing.personId));
      }
      await reindexPerson(existing.personId);
    }
    await logAudit("delete", "document", id, `حذف مستند: ${existing.originalName}`);
    return Response.json({ ok: true, deleted: id });
  } catch (error) {
    return errorResponse(error);
  }
}
