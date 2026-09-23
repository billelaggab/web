import Link from "next/link";
import { notFound } from "next/navigation";
import PrintControls from "@/components/PrintControls";
import {
  Avatar,
  CategoryChip,
  ConfidenceChip,
  MarkdownView,
  PhoneLabelChip,
  RelationshipChip,
  ReliabilityStars,
  SensitivityBadge,
} from "@/components/ui";
import { getDossier } from "@/db/queries";
import {
  CLASSIFICATION_WATERMARK,
  DOSSIER_PROFILES,
  EMAIL_TYPE_LABELS,
  type DossierProfileKey,
} from "@/lib/constants";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { reqUuid } from "@/lib/validate";

export const dynamic = "force-dynamic";

const PROFILES = ["full", "no_confidential", "no_media", "minimal"] as const;

export default async function DossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const rawProfile = Array.isArray(sp.profile) ? sp.profile[0] : sp.profile;
  const profile: DossierProfileKey = PROFILES.includes(rawProfile as DossierProfileKey)
    ? (rawProfile as DossierProfileKey)
    : "full";

  let dossier = null;
  try {
    reqUuid(id, "id");
    dossier = await getDossier(id, profile);
  } catch {
    dossier = null;
  }
  if (!dossier) notFound();

  const { person, counts } = dossier;
  const settings = DOSSIER_PROFILES[profile];
  const avatarDoc = dossier.documents.find((d) => d.isAvatar) ?? null;

  return (
    <div className="mx-auto" style={{ maxWidth: 1100 }}>
      <div className="watermark-layer d-none d-print-flex" aria-hidden>
        <span>{CLASSIFICATION_WATERMARK}</span>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3 d-print-none">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <Link href="/persons">الملفات</Link>
            </li>
            <li className="breadcrumb-item">
              <Link href={`/persons/${person.id}`}>{person.fullName}</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              الملف الجنائي
            </li>
          </ol>
        </nav>
      </div>

      <PrintControls personId={person.id} profile={profile} />

      <article className="dossier-sheet p-3 p-lg-4">
        {/* ------------------------------ ترويسة الملف ------------------------------ */}
        <header className="page-block border-bottom border-3 pb-3 mb-3">
          <div className="d-flex justify-content-between align-items-start gap-3">
            <div className="d-flex gap-3 align-items-center">
              <Avatar
                name={person.fullName}
                url={avatarDoc?.previewUrl ?? null}
                size={88}
              />
              <div>
                <h1 className="h3 mb-1 fw-bold">{person.fullName}</h1>
                <div className="small text-body-secondary">
                  {person.occupation || "بلا نشاط معروف"} — {person.nationality || "بلا جنسية"}
                </div>
                <div className="mt-1 d-flex flex-wrap gap-2 align-items-center">
                  <SensitivityBadge level={person.sensitivity} />
                  <span className="badge text-bg-light border">
                    موثوقية {person.reliability}/5
                  </span>
                  <span className="badge text-bg-light border">
                    {settings.label}
                  </span>
                </div>
                <div className="mt-1">
                  <ReliabilityStars value={person.reliability} />
                </div>
              </div>
            </div>
            <div className="text-end small">
              <div className="fw-bold">تاريخ التوليد</div>
              <div>{formatDateTime(dossier.generatedAt)}</div>
              <div className="fw-bold mt-2">معرّف الملف</div>
              <div dir="ltr" className="hash-cell">{person.id}</div>
            </div>
          </div>

          {dossier.aliases.length > 0 && (
            <div className="mt-2 small">
              <strong>الأسماء المستعارة:</strong> {dossier.aliases.join(" • ")}
            </div>
          )}

          <div className="table-responsive mt-3">
            <table className="table table-sm table-bordered mb-0 align-middle">
              <tbody>
                <tr>
                  <th className="w-25 table-light">تاريخ الميلاد</th>
                  <td>{formatDate(person.dateOfBirth)}</td>
                  <th className="w-25 table-light">العنوان الحالي</th>
                  <td>{person.address || "—"}</td>
                </tr>
                <tr>
                  <th className="table-light">عدد الملاحظات</th>
                  <td>
                    {dossier.notes.length} من {counts.notes}
                    {settings.excludeConfidential ? " (بعد استثناء السري)" : ""}
                  </td>
                  <th className="table-light">عدد الأدلة</th>
                  <td>
                    {dossier.documents.length} من {counts.documents} —{" "}
                    {formatBytes(counts.totalBytes)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {person.summary && (
            <section className="mt-3 border-start border-4 ps-3 page-block">
              <h2 className="h6 fw-bold mb-2">الخلاصة الاستقصائية</h2>
              <MarkdownView source={person.summary} />
            </section>
          )}
        </header>

        {/* ------------------------------ بطاقات الاتصال ------------------------------ */}
        <section className="dossier-section page-block">
          <h2>
            <i className="bi bi-telephone me-2" />
            بطاقات الاتصال ({dossier.phones.length + dossier.emails.length + dossier.socials.length})
          </h2>
          <div className="table-responsive">
            <table className="table table-sm table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th>النوع</th>
                  <th>القيمة</th>
                  <th>التصنيف</th>
                  <th>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {dossier.phones.map((p) => (
                  <tr key={p.id}>
                    <td>هاتف</td>
                    <td dir="ltr" className="text-end fw-semibold">
                      {p.number}
                    </td>
                    <td>
                      <PhoneLabelChip label={p.label} />
                    </td>
                    <td className="small">
                      {p.carrierNotes || "—"}
                      {p.whatsapp && <span className="badge text-bg-light border ms-1">واتساب</span>}
                      {p.signal && <span className="badge text-bg-light border ms-1">سيجنال</span>}
                      {p.telegram && (
                        <span className="badge text-bg-light border ms-1">تيليجرام</span>
                      )}
                    </td>
                  </tr>
                ))}
                {dossier.emails.map((e) => (
                  <tr key={e.id}>
                    <td>بريد</td>
                    <td dir="ltr" className="text-end">
                      {e.address}
                    </td>
                    <td>{EMAIL_TYPE_LABELS[e.type]}</td>
                    <td className="small">
                      {e.pgpPublicKey ? "مفتاح PGP مرفق" : "—"}
                    </td>
                  </tr>
                ))}
                {dossier.socials.map((s) => (
                  <tr key={s.id}>
                    <td>تواصل</td>
                    <td dir="ltr" className="text-end">
                      {s.handle}
                    </td>
                    <td>{s.platform}</td>
                    <td className="small" dir="ltr">
                      {s.profileUrl || "—"}
                    </td>
                  </tr>
                ))}
                {dossier.phones.length + dossier.emails.length + dossier.socials.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-body-secondary small">
                      لا قنوات اتصال مسجلة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* --------------------------- السجل الاستخباري الزمني --------------------------- */}
        <section className="dossier-section">
          <h2>
            <i className="bi bi-journal-text me-2" />
            السجل الاستخباري الزمني ({dossier.notes.length})
            {settings.excludeConfidential && (
              <span className="badge text-bg-warning ms-2">مُعقَّم: السري مستثنى</span>
            )}
          </h2>
          {dossier.notes.length === 0 && (
            <p className="text-body-secondary small">
              لا ملاحظات ضمن نطاق هذا التصدير.
            </p>
          )}
          {dossier.notes.map((note) => (
            <article className="note-card mb-2 page-block" key={note.id}>
              <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center">
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <strong>{note.title}</strong>
                  <CategoryChip category={note.category} />
                  {note.isConfidential && <span className="badge text-bg-danger">سري</span>}
                </div>
                <span className="small text-body-secondary">
                  {formatDate(note.eventDate)}
                </span>
              </div>
              <div className="small text-body-secondary">
                تاريخ التدوين: {formatDateTime(note.recordedAt)}
              </div>
              <div className="mt-2">
                <MarkdownView source={note.content} />
              </div>
            </article>
          ))}
        </section>

        {/* ------------------------------ دليل العلاقات ------------------------------ */}
        <section className="dossier-section page-block">
          <h2>
            <i className="bi bi-diagram-3 me-2" />
            دليل العلاقات ({dossier.relationships.length})
          </h2>
          <div className="table-responsive">
            <table className="table table-sm table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th>الطرف الآخر</th>
                  <th>نوع العلاقة</th>
                  <th>الثقة</th>
                  <th>الاتجاه</th>
                  <th>السياق</th>
                </tr>
              </thead>
              <tbody>
                {dossier.relationships.map((r) => (
                  <tr key={r.relationshipId}>
                    <td>{r.otherName}</td>
                    <td>
                      <RelationshipChip type={r.type} />
                    </td>
                    <td>
                      <ConfidenceChip confidence={r.confidence} />
                    </td>
                    <td className="small">{r.direction === "outgoing" ? "صادر" : "وارد"}</td>
                    <td className="small">{r.contextNotes || "—"}</td>
                  </tr>
                ))}
                {dossier.relationships.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-body-secondary small">
                      لا علاقات مسجلة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ------------------------------ فهرس الأدلة ------------------------------ */}
        <section className="dossier-section page-block">
          <h2>
            <i className="bi bi-paperclip me-2" />
            فهرس الأدلة والمرفقات ({dossier.documents.length} من {counts.documents})
            {settings.excludeMedia && (
              <span className="badge text-bg-warning ms-2">الوسائط مستثناة</span>
            )}
          </h2>
          {settings.excludeMedia ? (
            <p className="text-body-secondary small mb-0">
              تم استثناء الوسائط من هذا التصدير بناءً على مرشّح التعقيم المحدّد.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-bordered align-middle">
                <thead className="table-light">
                  <tr>
                    <th>الاسم الأصلي</th>
                    <th>النوع</th>
                    <th>الحجم</th>
                    <th>SHA-256</th>
                    <th>تاريخ الرفع</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.documents.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div className="fw-semibold">{d.originalName}</div>
                        <div className="small text-body-secondary">{d.description || "—"}</div>
                      </td>
                      <td className="small" dir="ltr">
                        {d.mimeType}
                      </td>
                      <td className="small">{formatBytes(d.sizeBytes)}</td>
                      <td className="hash-cell">{d.sha256}</td>
                      <td className="small">{formatDateTime(d.createdAt)}</td>
                    </tr>
                  ))}
                  {dossier.documents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-body-secondary small">
                        لا مرفقات.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="border-top pt-2 mt-4 small text-body-secondary page-block">
          <div>
            سلسلة العهدة الرقمية: {counts.documents} ملف — {dossier.integrity.hashed} بصمة SHA-256
            مسجّلة.
          </div>
          <div>
            الملاحظات السرية المستثناة: {settings.excludeConfidential ? "نعم" : "لا"} — الوسائط
            المستثناة: {settings.excludeMedia ? "نعم" : "لا"}
          </div>
          <div className="fw-bold">{CLASSIFICATION_WATERMARK} — نسخة مطبوعة تخضع لرقابة التداول.</div>
        </footer>
      </article>
    </div>
  );
}
