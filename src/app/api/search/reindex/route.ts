import { reindexAll, syncToMeilisearch } from "@/lib/search";
import { logAudit } from "@/db/queries";
import { errorResponse } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/search/reindex — إعادة بناء الفهرس بالكامل ثم مزامنة Meilisearch (إن ضُبط) */
export async function POST() {
  try {
    const started = Date.now();
    const stats = await reindexAll();
    const sync = await syncToMeilisearch();
    await logAudit(
      "reindex",
      "search_index",
      null,
      `إعادة فهرسة ${stats.persons} ملف و ${stats.documents} مستند`,
    );
    return Response.json({
      ok: true,
      ...stats,
      meilisearch: sync,
      tookMs: Date.now() - started,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    hint: "استخدم POST لإعادة بناء الفهرس الموحّد.",
    engine: process.env.MEILISEARCH_HOST ? "meilisearch + postgres" : "postgres",
  });
}
