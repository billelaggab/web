import { sql } from "drizzle-orm";
import { db } from "@/db";
import { MEDIA_DIR, ensureMediaDir } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, string> = {};
  let ok = true;

  try {
    await db.execute(sql`select 1`);
    checks.database = "متصل";
  } catch (error) {
    ok = false;
    checks.database = `غير متصل: ${(error as Error).message}`;
  }

  try {
    await ensureMediaDir();
    checks.storage = MEDIA_DIR;
  } catch (error) {
    checks.storage = `تعذّر التهيئة: ${(error as Error).message}`;
  }

  checks.search =
    process.env.MEILISEARCH_HOST
      ? `Meilisearch (${process.env.MEILISEARCH_HOST}) + طبقة محلية`
      : "طبقة PostgreSQL المحلية (تطبيع عربي + مطابقة ضبابية)";

  return Response.json(
    { ok, service: "icims-api", version: "1.0.0", mode: "air-gapped", checks },
    { status: ok ? 200 : 500 },
  );
}
