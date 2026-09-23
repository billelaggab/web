import Link from "next/link";
import { EmptyState, StatCard } from "@/components/ui";
import { getDashboardStats } from "@/db/queries";
import { formatBytes, formatDateTime } from "@/lib/format";
import { NOTE_CATEGORY_LABELS, SENSITIVITY_BADGES, SENSITIVITY_LABELS } from "@/lib/constants";
import type { Sensitivity } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let stats: Awaited<ReturnType<typeof getDashboardStats>> | null = null;
  let dbError: string | null = null;
  try {
    stats = await getDashboardStats();
  } catch (error) {
    dbError = (error as Error).message;
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h3 mb-1 fw-bold">
            <i className="bi bi-shield-fill-check me-2 text-primary" />
            لوحة التحكم الاستقصائية
          </h1>
          <p className="text-body-secondary mb-0 small">
            منظومة محلية معزولة لإدارة الملفات، قنوات الاتصال، الملاحظات الاستخبارية، شبكة العلاقات
            والأدلة الرقمية.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link className="btn btn-primary" href="/persons/new">
            <i className="bi bi-person-add me-1" />
            فتح ملف جديد
          </Link>
          <Link className="btn btn-outline-secondary" href="/network">
            <i className="bi bi-diagram-3 me-1" />
            شبكة العلاقات
          </Link>
        </div>
      </div>

      {dbError && (
        <div className="alert alert-warning">
          <i className="bi bi-database-exclamation me-2" />
          تعذّر قراءة قاعدة البيانات: {dbError}
          <div className="small mt-1">
            تأكد من تشغيل <code>npx drizzle-kit push</code> لإنشاء الجداول.
          </div>
        </div>
      )}

      {stats && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <StatCard icon="bi-person-vcard" label="ملفات الأشخاص" value={stats.persons} />
            </div>
            <div className="col-6 col-lg-3">
              <StatCard icon="bi-journal-text" label="ملاحظات استخبارية" value={stats.notes} />
            </div>
            <div className="col-6 col-lg-3">
              <StatCard
                icon="bi-paperclip"
                label="أدلة ومرفقات"
                value={stats.documents}
                hint={formatBytes(stats.mediaBytes)}
              />
            </div>
            <div className="col-6 col-lg-3">
              <StatCard icon="bi-diagram-3" label="علاقات مرصودة" value={stats.relationships} />
            </div>
            <div className="col-6 col-lg-3">
              <StatCard
                icon="bi-shield-lock-fill"
                label="ملاحظات سرية"
                value={stats.confidentialNotes}
              />
            </div>
            <div className="col-6 col-lg-3">
              <StatCard icon="bi-exclamation-octagon" label="سري للغاية" value={stats.topSecret} />
            </div>
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-body-tertiary fw-semibold">
                  <i className="bi bi-search me-2" />
                  محرّك البحث الموحّد
                </div>
                <div className="card-body small">
                  <p className="mb-2">
                    البحث فوري (search-as-you-type) عبر الأسماء، الأسماء المستعارة، الأرقام بصيغة
                    E.164، البريد، الحسابات، محتوى الملاحظات، وبيانات المستندات.
                  </p>
                  <ul className="mb-0 text-body-secondary">
                    <li>تطبيع عربي كامل: (أ/ا/إ/آ)، (ة/ه)، (ي/ى) وإزالة التشكيل.</li>
                    <li>تحمّل الأخطاء المطبعية بمسافة ليفنشتاين.</li>
                    <li>
                      طبقة Meilisearch اختيارية عبر <code>MEILISEARCH_HOST</code> مع تراجع تلقائي
                      للفهرس المحلي.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-body-tertiary fw-semibold d-flex justify-content-between">
                  <span>
                    <i className="bi bi-clock-history me-2" />
                    أحدث الملفات المحدّثة
                  </span>
                  <Link href="/persons" className="small">
                    عرض الكل
                  </Link>
                </div>
                <div className="list-group list-group-flush">
                  {stats.recentPersons.map((p) => (
                    <Link
                      key={p.id}
                      href={`/persons/${p.id}`}
                      className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <div className="fw-semibold">{p.fullName}</div>
                        <div className="small text-body-secondary">
                          {p.occupation || "بلا نشاط"} — {formatDateTime(p.updatedAt)}
                        </div>
                      </div>
                      <span className={`badge ${SENSITIVITY_BADGES[p.sensitivity as Sensitivity]}`}>
                        {SENSITIVITY_LABELS[p.sensitivity as Sensitivity]}
                      </span>
                    </Link>
                  ))}
                  {stats.recentPersons.length === 0 && (
                    <div className="list-group-item text-body-secondary small">
                      لا ملفات بعد — ابدأ بفتح ملف جديد.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-body-tertiary fw-semibold">
                  <i className="bi bi-journal-plus me-2" />
                  أحدث التدوينات الاستخبارية
                </div>
                <div className="list-group list-group-flush">
                  {stats.recentNotes.map((n) => (
                    <Link
                      key={n.id}
                      href={`/persons/${n.personId}?tab=notes`}
                      className="list-group-item list-group-item-action"
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="fw-semibold">{n.title}</span>
                        {n.isConfidential && (
                          <span className="badge text-bg-danger">
                            <i className="bi bi-shield-lock" />
                          </span>
                        )}
                      </div>
                      <div className="small text-body-secondary">
                        {n.personName} — {NOTE_CATEGORY_LABELS[n.category]} —{" "}
                        {formatDateTime(n.recordedAt)}
                      </div>
                    </Link>
                  ))}
                  {stats.recentNotes.length === 0 && (
                    <div className="list-group-item text-body-secondary small">
                      لا تدوينات بعد.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-body-tertiary fw-semibold">
                  <i className="bi bi-clipboard-data me-2" />
                  سجل التدقيق (سلسلة العهدة)
                </div>
                {stats.recentAudit.length === 0 ? (
                  <div className="card-body">
                    <EmptyState
                      icon="bi-clipboard-x"
                      title="لا أحداث مسجلة"
                      hint="كل عملية إنشاء أو تعديل أو رفع ملف تُسجَّل هنا مع الوقت والفاعل."
                    />
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>الوقت</th>
                          <th>الإجراء</th>
                          <th>الكيان</th>
                          <th>التفصيل</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recentAudit.map((a) => (
                          <tr key={a.id}>
                            <td className="small">{formatDateTime(a.createdAt)}</td>
                            <td>
                              <span className="badge text-bg-secondary">{a.action}</span>
                            </td>
                            <td className="small">{a.entity}</td>
                            <td className="small">{a.summary}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
