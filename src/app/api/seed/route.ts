import { seedDemoData } from "@/lib/seed-data";
import { errorResponse } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/seed — إدخال بيانات تجريبية (يعمل فقط إذا كانت القاعدة فارغة) */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    const result = await seedDemoData(force);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
