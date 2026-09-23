import SettingsPanel from "@/components/SettingsPanel";
import { MEDIA_DIR } from "@/lib/security";

export const dynamic = "force-dynamic";

const SECURITY_CHECKLIST = [
  {
    icon: "bi-ethernet",
    title: "عزل الشبكة (Air-gap)",
    body: "لا يوجد أي استدعاء لشبكة خارجية: Bootstrap RTL والأيقونات والخطوط تُحمَّل محلياً من الحزمة، وخطوط Cairo/Tajawal تُقرأ من /public/fonts.",
  },
  {
    icon: "bi-file-earmark-lock",
    title: "حماية من Path Traversal",
    body: "أسماء الملفات على القرص تُولَّد كـ UUID صارم، والامتدادات ضمن قائمة بيضاء. أي مسار لا يقع داخل مجلد الوسائط يُرفض.",
  },
  {
    icon: "bi-key",
    title: "تنزيل موقّع مؤقت",
    body: "لا تُكشف مسارات التخزين. كل تنزيل/معاينة يمر عبر /api/documents/:id/file مع رمز HMAC صلاحيته 15 دقيقة.",
  },
  {
    icon: "bi-shield-check",
    title: "حصانة SQL Injection و XSS",
    body: "كل الاستعلامات عبر Drizzle ORM بمعاملات مُهيّأة، وكل Markdown يُهرَّب قبل التنسيق، فلا يُنفَّذ أي وسوم HTML من المستخدم.",
  },
  {
    icon: "bi-fingerprint",
    title: "سلسلة العهدة",
    body: "لكل ملف مرفوع بصمة SHA-256 محسوبة عند الرفع ومخزّنة في قاعدة البيانات، مع سجل تدقيق لكل عملية.",
  },
  {
    icon: "bi-printer",
    title: "طباعة مُعقَّمة",
    body: "قبل التصدير يمكنك استثناء الملاحظات السرية أو الوسائط، مع علامة مائية ومنع تقسيم الجداول عبر الصفحات.",
  },
];

export default function SettingsPage() {
  return (
    <>
      <h1 className="h3 fw-bold mb-1">
        <i className="bi bi-shield-lock me-2" />
        الإعدادات والسلامة التشغيلية
      </h1>
      <p className="text-body-secondary small">
        مراقبة صحة الخدمات، إدارة فهرس البحث، والتحقق من ضوابط الأمان المعتمدة.
      </p>

      <SettingsPanel />

      <div className="row g-3 mt-1">
        {SECURITY_CHECKLIST.map((item) => (
          <div className="col-12 col-md-6 col-xl-4" key={item.title}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex gap-2 align-items-center mb-2">
                  <i className={`bi ${item.icon} fs-5 text-primary`} />
                  <h2 className="h6 fw-bold mb-0">{item.title}</h2>
                </div>
                <p className="small text-body-secondary mb-0">{item.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card border-0 shadow-sm mt-3">
        <div className="card-header bg-body-tertiary fw-semibold">
          <i className="bi bi-sliders me-2" />
          متغيرات البيئة المدعومة
        </div>
        <div className="table-responsive">
          <table className="table table-sm mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>المتغير</th>
                <th>الوظيفة</th>
                <th>الحالة الحالية</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td dir="ltr" className="text-end">
                  DATABASE_URL
                </td>
                <td className="small">اتصال PostgreSQL</td>
                <td>
                  {process.env.DATABASE_URL ? (
                    <span className="badge text-bg-success">مضبوط</span>
                  ) : (
                    <span className="badge text-bg-danger">غير مضبوط</span>
                  )}
                </td>
              </tr>
              <tr>
                <td dir="ltr" className="text-end">
                  MEDIA_DIR
                </td>
                <td className="small">مجلد تخزين الوسائط (خارج المجلد العام)</td>
                <td dir="ltr" className="small text-end">
                  {MEDIA_DIR}
                </td>
              </tr>
              <tr>
                <td dir="ltr" className="text-end">
                  APP_SECRET
                </td>
                <td className="small">مفتاح توقيع رموز التنزيل (HMAC-SHA256)</td>
                <td>
                  {process.env.APP_SECRET ? (
                    <span className="badge text-bg-success">مضبوط</span>
                  ) : (
                    <span className="badge text-bg-warning">افتراضي — غيّره في الإنتاج</span>
                  )}
                </td>
              </tr>
              <tr>
                <td dir="ltr" className="text-end">
                  MEILISEARCH_HOST
                </td>
                <td className="small">
                  تفعيل طبقة Meilisearch (اختياري) — بدونه يعمل الفهرس المحلي
                </td>
                <td>
                  {process.env.MEILISEARCH_HOST ? (
                    <span className="badge text-bg-success">{process.env.MEILISEARCH_HOST}</span>
                  ) : (
                    <span className="badge text-bg-secondary">غير مفعّل</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
