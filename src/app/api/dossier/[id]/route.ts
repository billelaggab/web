import { getDossier } from "@/db/queries";
import { renderDossierHtml } from "@/lib/dossier-html";
import type { DossierProfileKey } from "@/lib/constants";
import { errorResponse, notFound, optOneOf } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROFILES = ["full", "no_confidential", "no_media", "minimal"] as const;

/**
 * GET /api/dossier/:id?profile=full|no_confidential|no_media|minimal&format=html|json
 * يُرجع إما JSON كامل للملف أو مستند HTML مستقل قابل للطباعة/التحويل إلى PDF (WeasyPrint).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const profile =
      optOneOf<DossierProfileKey>(url.searchParams.get("profile"), PROFILES, "profile") ?? "full";
    const format = url.searchParams.get("format") === "json" ? "json" : "html";

    const dossier = await getDossier(id, profile);
    if (!dossier) notFound("الملف المطلوب غير موجود");

    if (format === "json") {
      return Response.json({ ok: true, dossier });
    }
    const html = renderDossierHtml(dossier);
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
