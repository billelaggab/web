import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { resolveMediaPath, verifyFileToken } from "@/lib/security";
import { errorResponse, notFound, reqUuid } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INLINE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

/**
 * GET /api/documents/:id/file?token=...[&download=1]
 * بث الملف عبر رمز موقّع (HMAC) بصلاحية زمنية — لا يُكشف مسار التخزين مطلقاً.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    reqUuid(id, "id");
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const asDownload = url.searchParams.get("download") === "1";

    if (!verifyFileToken(id, token)) {
      return Response.json(
        { ok: false, error: "رمز الوصول غير صالح أو منتهي الصلاحية" },
        { status: 401 },
      );
    }

    const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!row) notFound("المستند غير موجود");

    const path = resolveMediaPath(row.storedName);
    if (!path) {
      return Response.json({ ok: false, error: "مسار غير صالح" }, { status: 400 });
    }

    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(path);
    } catch {
      return Response.json({ ok: false, error: "الملف غير موجود على القرص" }, { status: 410 });
    }
    if (!stat.isFile()) {
      return Response.json({ ok: false, error: "الهدف ليس ملفاً" }, { status: 400 });
    }

    const buffer = await fs.readFile(path);
    const safeName = row.originalName.replace(/[^\p{L}\p{N}._ -]/gu, "_");
    const inline = !asDownload && INLINE_TYPES.has(row.mimeType);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": inline ? row.mimeType : "application/octet-stream",
        "Content-Length": String(stat.size),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
