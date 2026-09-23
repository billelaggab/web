import { searchAll } from "@/lib/search";
import { errorResponse } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/search?q=...&limit=20
 * بحث موحّد فوري (search-as-you-type) عبر: الأسماء، الأسماء المستعارة، الأرقام،
 * البريد، الحسابات، محتوى الملاحظات، وبيانات المستندات — مع تطبيع عربي وتحمّل أخطاء مطبعية.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 50);
    const result = await searchAll(q, limit);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
