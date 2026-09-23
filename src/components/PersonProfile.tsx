"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EmailEditor,
  MediaTab,
  NoteEditor,
  PhoneEditor,
  RelationshipEditor,
  SocialEditor,
} from "@/components/PersonEditors";
import {
  Avatar,
  CategoryChip,
  ConfidenceChip,
  MarkdownView,
  PhoneLabelChip,
  ReliabilityStars,
  RelationshipChip,
  SensitivityBadge,
} from "@/components/ui";
import { EMAIL_TYPE_LABELS } from "@/lib/constants";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import type { DossierPayload } from "@/lib/types";

type Tab = "overview" | "contacts" | "notes" | "network" | "media";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "نظرة عامة", icon: "bi-person-badge" },
  { key: "contacts", label: "قنوات الاتصال", icon: "bi-telephone" },
  { key: "notes", label: "السجل الاستخباري", icon: "bi-journal-text" },
  { key: "network", label: "العلاقات", icon: "bi-diagram-3" },
  { key: "media", label: "الوسائط والأدلة", icon: "bi-images" },
];

export default function PersonProfile({
  dossier,
  personOptions,
  initialTab = "overview",
}: {
  dossier: DossierPayload;
  personOptions: { id: string; fullName: string; sensitivity: string }[];
  initialTab?: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [pendingSecret, setPendingSecret] = useState<string | null>(null);

  const { person, counts } = dossier;
  const avatarDoc = useMemo(
    () => dossier.documents.find((d) => d.isAvatar) ?? null,
    [dossier.documents],
  );

  const call = useCallback(
    async (url: string, method: string, body?: unknown) => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const res = await fetch(url, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "فشلت العملية");
        router.refresh();
        return true;
      } catch (err) {
        setError((err as Error).message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const editorProps = { personId: person.id, call, busy };

  return (
    <>
      {error && (
        <div className="alert alert-danger py-2 d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-triangle-fill" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="alert alert-success py-2 d-flex align-items-center gap-2">
          <i className="bi bi-check-circle-fill" />
          <span>{notice}</span>
        </div>
      )}

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-3 align-items-start">
            <Avatar name={person.fullName} url={avatarDoc?.previewUrl ?? null} size={92} />
            <div className="flex-grow-1">
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <h1 className="h3 mb-0 fw-bold">{person.fullName}</h1>
                <SensitivityBadge level={person.sensitivity} />
                <span className="badge text-bg-light border">موثوقية {person.reliability}/5</span>
              </div>
              <div className="text-body-secondary">
                {person.occupation || "بلا نشاط معروف"} — {person.nationality || "بلا جنسية"}
              </div>
              <div className="mt-1">
                <ReliabilityStars value={person.reliability} />
              </div>
              {dossier.aliases.length > 0 && (
                <div className="small text-body-secondary mt-1">
                  <i className="bi bi-tags me-1" />
                  {dossier.aliases.join(" • ")}
                </div>
              )}
            </div>
            <div className="d-flex flex-column gap-2">
              <Link
                href={`/persons/${person.id}/dossier?profile=full`}
                className="btn btn-sm btn-warning"
              >
                <i className="bi bi-printer me-1" />
                تصدير الملف الجنائي
              </Link>
              <Link href={`/persons/${person.id}/edit`} className="btn btn-sm btn-outline-secondary">
                <i className="bi bi-pencil me-1" />
                تحرير البيانات
              </Link>
              <button
                className="btn btn-sm btn-outline-danger"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm(`تأكيد حذف ملف «${person.fullName}» نهائياً؟`)) return;
                  if (await call(`/api/persons/${person.id}`, "DELETE")) router.push("/persons");
                }}
              >
                <i className="bi bi-trash me-1" />
                حذف الملف
              </button>
            </div>
          </div>
        </div>
      </div>

      <ul className="nav nav-pills mb-3 flex-nowrap overflow-auto">
        {TABS.map((t) => (
          <li className="nav-item" key={t.key}>
            <button
              className={`nav-link ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              <i className={`bi ${t.icon} me-1`} />
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      {tab === "overview" && (
        <div className="row g-3">
          <div className="col-12 col-lg-7">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-body-tertiary fw-semibold">
                <i className="bi bi-card-text me-2" />
                الملخص الاستقصائي
              </div>
              <div className="card-body">
                <MarkdownView source={person.summary} />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-5">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-body-tertiary fw-semibold">
                <i className="bi bi-info-circle me-2" />
                بيانات تعريفية
              </div>
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle">
                  <tbody>
                    <tr>
                      <th className="text-body-secondary">تاريخ الميلاد</th>
                      <td>{formatDate(person.dateOfBirth)}</td>
                    </tr>
                    <tr>
                      <th className="text-body-secondary">العنوان الحالي</th>
                      <td>{person.address || "—"}</td>
                    </tr>
                    <tr>
                      <th className="text-body-secondary">تاريخ الفتح</th>
                      <td>{formatDateTime(person.createdAt)}</td>
                    </tr>
                    <tr>
                      <th className="text-body-secondary">آخر تحديث</th>
                      <td>{formatDateTime(person.updatedAt)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="col-12">
            <div className="row g-3">
              {[
                { icon: "bi-telephone", label: "أرقام", value: String(counts.phones) },
                { icon: "bi-envelope", label: "بريد", value: String(counts.emails) },
                { icon: "bi-share", label: "حسابات", value: String(counts.socials) },
                { icon: "bi-journal-text", label: "ملاحظات", value: String(counts.notes) },
                { icon: "bi-shield-lock", label: "منها سري", value: String(counts.confidentialNotes) },
                { icon: "bi-diagram-3", label: "علاقات", value: String(counts.relationships) },
                {
                  icon: "bi-paperclip",
                  label: "وسائط",
                  value: `${counts.documents} (${formatBytes(counts.totalBytes)})`,
                },
              ].map((item) => (
                <div className="col-6 col-lg-3" key={item.label}>
                  <div className="border rounded-3 p-3 h-100 bg-body">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="small text-body-secondary">{item.label}</span>
                      <i className={`bi ${item.icon} text-body-secondary`} />
                    </div>
                    <div className="fs-4 fw-bold">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "contacts" && (
        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-body-tertiary fw-semibold">
                <i className="bi bi-telephone me-2" />
                الأرقام الهاتفية ({dossier.phones.length})
              </div>
              <div className="card-body">
                <PhoneEditor {...editorProps} />
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>الرقم</th>
                        <th>التصنيف</th>
                        <th>تطبيقات</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.phones.map((p) => (
                        <tr key={p.id}>
                          <td dir="ltr" className="text-end fw-semibold">
                            {p.number}
                          </td>
                          <td>
                            <PhoneLabelChip label={p.label} />
                          </td>
                          <td className="small">
                            {[
                              p.whatsapp ? "واتساب" : "",
                              p.signal ? "سيجنال" : "",
                              p.telegram ? "تيليجرام" : "",
                            ]
                              .filter(Boolean)
                              .join(" / ") || "—"}
                          </td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-outline-danger"
                              disabled={busy}
                              onClick={() => call(`/api/records/phone/${p.id}`, "DELETE")}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {dossier.phones.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-body-secondary small">
                            لا أرقام مسجلة.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {dossier.phones.some((p) => p.carrierNotes) && (
                  <div className="small text-body-secondary">
                    <strong>ملاحظات المشغّل:</strong>
                    <ul className="mb-0">
                      {dossier.phones
                        .filter((p) => p.carrierNotes)
                        .map((p) => (
                          <li key={p.id}>
                            <span dir="ltr">{p.number}</span> — {p.carrierNotes}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-body-tertiary fw-semibold">
                <i className="bi bi-envelope me-2" />
                البريد الإلكتروني ({dossier.emails.length})
              </div>
              <div className="card-body">
                <EmailEditor {...editorProps} />
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>العنوان</th>
                        <th>النوع</th>
                        <th>PGP</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.emails.map((e) => (
                        <tr key={e.id}>
                          <td dir="ltr" className="text-end">
                            {e.address}
                          </td>
                          <td className="small">{EMAIL_TYPE_LABELS[e.type]}</td>
                          <td className="small">
                            {e.pgpPublicKey ? (
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                title="نسخ مفتاح PGP"
                                onClick={() => {
                                  void navigator.clipboard
                                    ?.writeText(e.pgpPublicKey)
                                    .then(() => setNotice("تم نسخ مفتاح PGP إلى الحافظة."))
                                    .catch(() => setError("تعذّر النسخ إلى الحافظة."));
                                }}
                              >
                                <i className="bi bi-key" />
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-outline-danger"
                              disabled={busy}
                              onClick={() => call(`/api/records/email/${e.id}`, "DELETE")}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {dossier.emails.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-body-secondary small">
                            لا عناوين بريد.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-header bg-body-tertiary fw-semibold">
                <i className="bi bi-share me-2" />
                حسابات التواصل ({dossier.socials.length})
              </div>
              <div className="card-body">
                <SocialEditor {...editorProps} />
                <ul className="list-group list-group-flush">
                  {dossier.socials.map((s) => (
                    <li
                      className="list-group-item d-flex justify-content-between align-items-center bg-transparent px-0"
                      key={s.id}
                    >
                      <div>
                        <div className="fw-semibold">{s.handle}</div>
                        <div className="small text-body-secondary">{s.platform}</div>
                      </div>
                      <div className="d-flex gap-1">
                        {s.profileUrl && (
                          <a
                            className="btn btn-sm btn-outline-secondary"
                            href={s.profileUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            <i className="bi bi-box-arrow-up-left" />
                          </a>
                        )}
                        <button
                          className="btn btn-sm btn-outline-danger"
                          disabled={busy}
                          onClick={() => call(`/api/records/social/${s.id}`, "DELETE")}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </li>
                  ))}
                  {dossier.socials.length === 0 && (
                    <li className="list-group-item bg-transparent px-0 small text-body-secondary">
                      لا حسابات مسجلة.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "notes" && (
        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm sticky-top" style={{ top: "80px" }}>
              <div className="card-header bg-body-tertiary fw-semibold">
                <i className="bi bi-plus-circle me-2" />
                إضافة ملاحظة
              </div>
              <div className="card-body">
                <NoteEditor {...editorProps} />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-8">
            <div className="d-flex flex-column gap-3">
              {dossier.notes.map((note) => {
                const isSecret = note.isConfidential && !revealed[note.id];
                return (
                  <article className="note-card" key={note.id}>
                    <div className="d-flex flex-wrap gap-2 justify-content-between align-items-start">
                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        <strong>{note.title}</strong>
                        <CategoryChip category={note.category} />
                        {note.isConfidential && (
                          <span className="badge text-bg-danger">
                            <i className="bi bi-shield-lock me-1" />
                            سري
                          </span>
                        )}
                      </div>
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-secondary"
                          title="تبديل السرية"
                          disabled={busy}
                          onClick={() =>
                            call(`/api/records/note/${note.id}`, "PATCH", {
                              isConfidential: !note.isConfidential,
                            })
                          }
                        >
                          <i className="bi bi-shield-lock" />
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          disabled={busy}
                          onClick={() => call(`/api/records/note/${note.id}`, "DELETE")}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </div>
                    <div className="small text-body-secondary mt-1">
                      تاريخ الحدث: {formatDate(note.eventDate)} — تاريخ التدوين:{" "}
                      {formatDateTime(note.recordedAt)}
                    </div>
                    <div className="mt-2">
                      {isSecret ? (
                        <div className="border border-danger-subtle rounded-3 p-3 text-center bg-danger-subtle">
                          <i className="bi bi-eye-slash fs-4 text-danger" />
                          <p className="small mb-2">
                            محتوى سري — يتطلب تأكيد صلاحية صريح قبل العرض أو الطباعة.
                          </p>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => setPendingSecret(note.id)}
                          >
                            <i className="bi bi-unlock me-1" />
                            عرض المحتوى السري
                          </button>
                        </div>
                      ) : (
                        <MarkdownView source={note.content} />
                      )}
                    </div>
                  </article>
                );
              })}
              {dossier.notes.length === 0 && (
                <div className="alert alert-light border">
                  لا ملاحظات ضمن هذا النطاق. أضف أول ملاحظة من النموذج المجاور.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "network" && (
        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-body-tertiary fw-semibold">
                <i className="bi bi-node-plus me-2" />
                ربط بعلاقة
              </div>
              <div className="card-body">
                <RelationshipEditor {...editorProps} personOptions={personOptions} />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-8">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-body-tertiary fw-semibold">
                <i className="bi bi-diagram-3 me-2" />
                دليل العلاقات ({dossier.relationships.length})
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>الطرف الآخر</th>
                      <th>النوع</th>
                      <th>الثقة</th>
                      <th>الاتجاه</th>
                      <th>السياق</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {dossier.relationships.map((r) => (
                      <tr key={r.relationshipId}>
                        <td>
                          <Link
                            href={`/persons/${r.otherPersonId}`}
                            className="text-decoration-none"
                          >
                            {r.otherName}
                          </Link>
                        </td>
                        <td>
                          <RelationshipChip type={r.type} />
                        </td>
                        <td>
                          <ConfidenceChip confidence={r.confidence} />
                        </td>
                        <td className="small">
                          <i
                            className={`bi ${
                              r.direction === "outgoing" ? "bi-arrow-left" : "bi-arrow-right"
                            }`}
                            title={r.direction === "outgoing" ? "صادر" : "وارد"}
                          />
                        </td>
                        <td className="small text-body-secondary">{r.contextNotes || "—"}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-danger"
                            disabled={busy}
                            onClick={() =>
                              call(`/api/records/relationship/${r.relationshipId}`, "DELETE")
                            }
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {dossier.relationships.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-body-secondary small">
                          لا علاقات مسجلة لهذا الملف.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "media" && (
        <MediaTab
          personId={person.id}
          call={call}
          busy={busy}
          documents={dossier.documents}
          onNotice={setNotice}
          onError={setError}
        />
      )}

      {pendingSecret && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title">
                    <i className="bi bi-shield-exclamation me-2" />
                    تأكيد الوصول إلى محتوى سري
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setPendingSecret(null)}
                    aria-label="إغلاق"
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-2">
                    هذا المحتوى مصنّف <strong>سري</strong>، والعرض يُسجَّل في سجل التدقيق.
                  </p>
                  <p className="small text-body-secondary mb-0">
                    أكّد أنك مخوّل، وأن البيئة المحيطة آمنة من العرض غير المصرّح به.
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setPendingSecret(null)}>
                    إلغاء
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      setRevealed((prev) => ({ ...prev, [pendingSecret]: true }));
                      setPendingSecret(null);
                    }}
                  >
                    <i className="bi bi-unlock me-1" />
                    أؤكد — اعرض المحتوى
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </>
  );
}
