/**
 * خطاف بدء التشغيل في Next.js (instrumentation).
 * يُشغَّل مرة واحدة عند إقلاع الخادم: يطبّق المخطط على قاعدة البيانات إن كانت فارغة،
 * حتى لا تفشل أول عملية كتابة في بيئة جديدة أو حجم مُعاد تهيئته.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensureSchemaReady, schemaStatus } = await import("@/db/pool");
    await ensureSchemaReady();
    const status = await schemaStatus();
    console.log(
      `[icims] قاعدة البيانات جاهزة — ${status.detail}${
        status.ok ? "" : ` (${status.detail})`
      }`,
    );
  } catch (error) {
    // لا نُفشل الإقلاع: البوابة ستُعيد المحاولة عند أول استعلام.
    console.error("[icims] تعذّر تهيئة المخطط عند الإقلاع:", (error as Error).message);
  }
}
