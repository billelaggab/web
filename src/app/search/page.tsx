import Link from "next/link";
import { EmptyState, SensitivityBadge } from "@/components/ui";
import { highlightParts } from "@/lib/arabic";
import { SEARCH_ENTITY_LABELS } from "@/lib/constants";
import { searchAll } from "@/lib/search";

export const dynamic = "force-dynamic";

function Highlighted({ text, tokens }: { text: string; tokens: string[] }) {
  return (
    <>
      {highlightParts(text, tokens).map((p, i) =>
        p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>,
      )}
    </>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim();
  let result: Awaited<ReturnType<typeof searchAll>> | null = null;
  let error: string | null = null;

  if (q) {
    try {
      result = await searchAll(q, 25);
    } catch (err) {
      error = (err as Error).message;
    }
  }

  const tokens = q.split(/\s+/).filter((t) => t.length > 1);

  return (
    <>
      <h1 className="h3 fw-bold mb-1">
        <i className="bi bi-search me-2" />
        البحث الموحّد
      </h1>
      <p className="text-body-secondary small">
        بحث فوري عبر الملفات وقنوات الاتصال والملاحظات والمستندات — مع تطبيع عربي كامل وتحمّل
        الأخطاء المطبعية.
      </p>

      <form className="input-group mb-4" method="get">
        <span className="input-group-text">
          <i className="bi bi-search" />
        </span>
        <input
          className="form-control form-control-lg"
          name="q"
          defaultValue={q}
          placeholder="اكتب اسماً، رقماً، بريداً، أو مقطعاً من ملاحظة…"
        />
        <button className="btn btn-primary">بحث</button>
      </form>

      {error && <div className="alert alert-danger">تعذّر تنفيذ البحث: {error}</div>}

      {!q && (
        <EmptyState
          icon="bi-keyboard"
          title="ابدأ بكتابة استعلام"
          hint="مثال: «أحمد الحارثي» أو «+9665» أو «تسريب» — يمكن أيضاً كتابة كلمة بإملاء خاطئ وسيتم إيجادها."
        />
      )}

      {result && (
        <>
          <div className="d-flex flex-wrap gap-3 small text-body-secondary mb-3">
            <span>
              <i className="bi bi-lightning-charge-fill text-warning me-1" />
              زمن التنفيذ: {result.tookMs} مللي ثانية
            </span>
            <span>
              <i className="bi bi-hdd-network me-1" />
              المحرّك: {result.engine === "meilisearch" ? "Meilisearch" : "فهرس PostgreSQL المحلي"}
            </span>
            <span>
              <i className="bi bi-people me-1" />
              ملفات مطابقة: {result.persons.length}
            </span>
            <span>
              <i className="bi bi-list-check me-1" />
              إجمالي التطابقات: {result.total}
            </span>
          </div>

          {result.persons.length === 0 && (
            <EmptyState
              icon="bi-emoji-neutral"
              title="لا نتائج مطابقة"
              hint="جرّب كلمة أقصر أو تحقّق من الإملاء — البحث يتحمّل خطأ أو خطأين مطبعيين حسب طول الكلمة."
            />
          )}

          <div className="vstack gap-3">
            {result.persons.map((person, index) => (
              <div className="card border-0 shadow-sm" key={person.personId}>
                <div className="card-header bg-body-tertiary d-flex justify-content-between align-items-center">
                  <div className="d-flex gap-2 align-items-center">
                    <span className="badge text-bg-primary">#{index + 1}</span>
                    <Link
                      href={`/persons/${person.personId}`}
                      className="fw-bold text-decoration-none fs-5"
                    >
                      <Highlighted text={person.fullName} tokens={tokens} />
                    </Link>
                    <SensitivityBadge level={person.sensitivity} />
                  </div>
                  <small className="text-body-secondary">
                    درجة المطابقة: {person.score.toFixed(1)} — موثوقية {person.reliability}/5
                  </small>
                </div>
                <div className="list-group list-group-flush">
                  {person.hits.map((hit) => (
                    <Link
                      key={hit.entityId}
                      href={hit.href}
                      className="list-group-item list-group-item-action"
                    >
                      <div className="d-flex justify-content-between gap-2 align-items-center">
                        <span className="fw-semibold">
                          <span className="badge text-bg-light border me-2">
                            {SEARCH_ENTITY_LABELS[hit.entityType]}
                          </span>
                          <Highlighted text={hit.title} tokens={tokens} />
                        </span>
                        <small className="text-body-tertiary">{hit.score.toFixed(1)}</small>
                      </div>
                      {hit.subtitle && (
                        <div className="small text-body-secondary">{hit.subtitle}</div>
                      )}
                      {hit.snippet && (
                        <div className="small text-body-secondary">
                          <Highlighted text={hit.snippet} tokens={tokens} />
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
