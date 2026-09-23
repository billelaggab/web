import Link from "next/link";
import PersonCard from "@/components/PersonCard";
import { EmptyState } from "@/components/ui";
import { listPersons } from "@/db/queries";
import { SENSITIVITY_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PersonsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const sensitivity = (Array.isArray(sp.sensitivity) ? sp.sensitivity[0] : sp.sensitivity) ?? "";

  let persons: Awaited<ReturnType<typeof listPersons>> = [];
  let error: string | null = null;
  try {
    persons = await listPersons({ q, sensitivity, limit: 200 });
  } catch (err) {
    error = (err as Error).message;
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1 fw-bold">
            <i className="bi bi-person-vcard me-2" />
            ملفات الأشخاص
          </h1>
          <p className="text-body-secondary small mb-0">
            {persons.length} ملف — مرتّبة حسب آخر تحديث.
          </p>
        </div>
        <Link className="btn btn-primary" href="/persons/new">
          <i className="bi bi-person-add me-1" />
          ملف جديد
        </Link>
      </div>

      <form className="row g-2 align-items-end mb-3" method="get">
        <div className="col-12 col-md-5">
          <label className="form-label small fw-semibold">بحث في الملفات</label>
          <input
            className="form-control"
            name="q"
            defaultValue={q}
            placeholder="اسم، اسم مستعار، نشاط، رقم، بريد…"
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small fw-semibold">مستوى الحساسية</label>
          <select className="form-select" name="sensitivity" defaultValue={sensitivity}>
            <option value="">الكل</option>
            {Object.entries(SENSITIVITY_LABELS).map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-3 d-flex gap-2">
          <button className="btn btn-outline-primary flex-grow-1">
            <i className="bi bi-funnel me-1" />
            تصفية
          </button>
          <Link className="btn btn-outline-secondary" href="/persons">
            مسح
          </Link>
        </div>
      </form>

      {error && (
        <div className="alert alert-warning">
          <i className="bi bi-database-exclamation me-2" />
          تعذّر جلب البيانات: {error}
        </div>
      )}

      {persons.length === 0 && !error ? (
        <EmptyState
          icon="bi-folder2-open"
          title="لا ملفات مطابقة"
          hint="جرّب تعديل معايير التصفية، أو افتح ملفاً جديداً لبدء التوثيق."
          action={
            <Link className="btn btn-primary btn-sm" href="/persons/new">
              <i className="bi bi-person-add me-1" />
              فتح ملف
            </Link>
          }
        />
      ) : (
        <div className="row g-3">
          {persons.map((person) => (
            <div className="col-12 col-md-6 col-xl-4" key={person.id}>
              <PersonCard person={person} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
