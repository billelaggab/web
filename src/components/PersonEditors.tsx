"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EMAIL_TYPE_LABELS,
  NOTE_CATEGORY_LABELS,
  PHONE_LABELS,
  PLATFORM_OPTIONS,
  RELATIONSHIP_LABELS,
} from "@/lib/constants";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { DocumentView } from "@/lib/types";

export type CallFn = (url: string, method: string, body?: unknown) => Promise<boolean>;

const label = "form-label small fw-semibold";
const field = "form-control form-control-sm";

type CommonProps = { personId: string; call: CallFn; busy: boolean };

/* --------------------------------- الأرقام --------------------------------- */
export function PhoneEditor({ personId, call, busy }: CommonProps) {
  const [number, setNumber] = useState("");
  const [phoneLabel, setPhoneLabel] = useState<keyof typeof PHONE_LABELS>("personal");
  const [apps, setApps] = useState({ whatsapp: false, signal: false, telegram: false });
  const [carrierNotes, setCarrierNotes] = useState("");

  return (
    <form
      className="row g-2 align-items-end mb-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await call("/api/records", "POST", {
          kind: "phone",
          personId,
          number,
          label: phoneLabel,
          ...apps,
          carrierNotes,
        });
        if (ok) {
          setNumber("");
          setCarrierNotes("");
          setApps({ whatsapp: false, signal: false, telegram: false });
        }
      }}
    >
      <div className="col-12 col-md-4">
        <label className={label}>رقم جديد (E.164)</label>
        <input
          className={field}
          dir="ltr"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="+966512345678"
          required
        />
      </div>
      <div className="col-6 col-md-3">
        <label className={label}>التصنيف</label>
        <select
          className="form-select form-select-sm"
          value={phoneLabel}
          onChange={(e) => setPhoneLabel(e.target.value as keyof typeof PHONE_LABELS)}
        >
          {Object.entries(PHONE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="col-6 col-md-3">
        <label className={label}>تطبيقات</label>
        <div className="d-flex gap-2 small">
          {(["whatsapp", "signal", "telegram"] as const).map((app) => (
            <div className="form-check" key={app}>
              <input
                className="form-check-input"
                type="checkbox"
                id={`app-${app}`}
                checked={apps[app]}
                onChange={(e) => setApps({ ...apps, [app]: e.target.checked })}
              />
              <label className="form-check-label" htmlFor={`app-${app}`}>
                {app === "whatsapp" ? "واتساب" : app === "signal" ? "سيجنال" : "تيليجرام"}
              </label>
            </div>
          ))}
        </div>
      </div>
      <div className="col-12 col-md-2">
        <button className="btn btn-sm btn-primary w-100" disabled={busy}>
          <i className="bi bi-plus-lg" />
        </button>
      </div>
      <div className="col-12">
        <input
          className={field}
          value={carrierNotes}
          onChange={(e) => setCarrierNotes(e.target.value)}
          placeholder="ملاحظات المشغّل / مزود الخدمة"
        />
      </div>
    </form>
  );
}

/* --------------------------------- البريد ---------------------------------- */
export function EmailEditor({ personId, call, busy }: CommonProps) {
  const [address, setAddress] = useState("");
  const [type, setType] = useState<keyof typeof EMAIL_TYPE_LABELS>("primary");
  const [pgp, setPgp] = useState("");

  return (
    <form
      className="row g-2 align-items-end mb-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await call("/api/records", "POST", {
          kind: "email",
          personId,
          address,
          type,
          pgpPublicKey: pgp,
        });
        if (ok) {
          setAddress("");
          setPgp("");
        }
      }}
    >
      <div className="col-12 col-md-5">
        <label className={label}>بريد جديد</label>
        <input
          className={field}
          dir="ltr"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="name@example.com"
          required
        />
      </div>
      <div className="col-6 col-md-4">
        <label className={label}>النوع</label>
        <select
          className="form-select form-select-sm"
          value={type}
          onChange={(e) => setType(e.target.value as keyof typeof EMAIL_TYPE_LABELS)}
        >
          {Object.entries(EMAIL_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="col-6 col-md-3">
        <button className="btn btn-sm btn-primary w-100" disabled={busy}>
          <i className="bi bi-plus-lg" />
        </button>
      </div>
      <div className="col-12">
        <textarea
          className={field}
          rows={2}
          value={pgp}
          onChange={(e) => setPgp(e.target.value)}
          placeholder="بلوك مفتاح PGP العام (اختياري)"
        />
      </div>
    </form>
  );
}

/* ------------------------------- حسابات التواصل ------------------------------ */
export function SocialEditor({ personId, call, busy }: CommonProps) {
  const [platform, setPlatform] = useState(PLATFORM_OPTIONS[0]);
  const [handle, setHandle] = useState("");
  const [profileUrl, setProfileUrl] = useState("");

  return (
    <form
      className="row g-2 align-items-end mb-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await call("/api/records", "POST", {
          kind: "social",
          personId,
          platform,
          handle,
          profileUrl,
        });
        if (ok) {
          setHandle("");
          setProfileUrl("");
        }
      }}
    >
      <div className="col-12 col-md-4">
        <label className={label}>المنصة</label>
        <select
          className="form-select form-select-sm"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          {PLATFORM_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="col-12 col-md-4">
        <label className={label}>المعرّف</label>
        <input
          className={field}
          dir="ltr"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@handle"
          required
        />
      </div>
      <div className="col-12 col-md-4">
        <label className={label}>رابط الملف</label>
        <input
          className={field}
          dir="ltr"
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <div className="col-12">
        <button className="btn btn-sm btn-primary" disabled={busy}>
          <i className="bi bi-plus-lg me-1" />
          إضافة الحساب
        </button>
      </div>
    </form>
  );
}

/* -------------------------------- الملاحظات -------------------------------- */
export function NoteEditor({ personId, call, busy }: CommonProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<keyof typeof NOTE_CATEGORY_LABELS>("meeting");
  const [eventDate, setEventDate] = useState("");
  const [isConfidential, setIsConfidential] = useState(false);
  const [content, setContent] = useState("");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await call("/api/records", "POST", {
          kind: "note",
          personId,
          title,
          category,
          eventDate: eventDate || null,
          isConfidential,
          content,
        });
        if (ok) {
          setTitle("");
          setContent("");
          setEventDate("");
          setIsConfidential(false);
        }
      }}
    >
      <div className="mb-2">
        <label className={label}>عنوان الملاحظة</label>
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="row g-2">
        <div className="col-7">
          <label className={label}>التصنيف</label>
          <select
            className="form-select form-select-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as keyof typeof NOTE_CATEGORY_LABELS)}
          >
            {Object.entries(NOTE_CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="col-5">
          <label className={label}>تاريخ الحدث</label>
          <input
            type="date"
            className={field}
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>
      </div>
      <div className="mb-2 mt-2">
        <label className={label}>المحتوى (Markdown آمن)</label>
        <textarea
          className={field}
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={"**المكان:** فندق …\n- نقطة أولى\n- نقطة ثانية"}
        />
      </div>
      <div className="form-check form-switch mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="note-confidential"
          checked={isConfidential}
          onChange={(e) => setIsConfidential(e.target.checked)}
        />
        <label className="form-check-label small" htmlFor="note-confidential">
          تصنيف كسري (يتطلب تأكيداً منفصلاً للعرض والطباعة)
        </label>
      </div>
      <button className="btn btn-sm btn-primary w-100" disabled={busy}>
        <i className="bi bi-journal-plus me-1" />
        تسجيل الملاحظة
      </button>
    </form>
  );
}

/* --------------------------------- العلاقات --------------------------------- */
export function RelationshipEditor({
  personId,
  personOptions,
  call,
  busy,
}: CommonProps & {
  personOptions: { id: string; fullName: string; sensitivity: string }[];
}) {
  const [target, setTarget] = useState("");
  const [type, setType] = useState<keyof typeof RELATIONSHIP_LABELS>("associate");
  const [confidence, setConfidence] = useState<"confirmed" | "suspected">("suspected");
  const [contextNotes, setContextNotes] = useState("");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await call("/api/records", "POST", {
          kind: "relationship",
          personId,
          targetPersonId: target,
          type,
          confidence,
          contextNotes,
        });
        if (ok) {
          setTarget("");
          setContextNotes("");
        }
      }}
    >
      <div className="mb-2">
        <label className={label}>الطرف الآخر</label>
        <select
          className="form-select form-select-sm"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          required
        >
          <option value="">— اختر شخصاً —</option>
          {personOptions
            .filter((o) => o.id !== personId)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.fullName}
              </option>
            ))}
        </select>
      </div>
      <div className="row g-2 mb-2">
        <div className="col-7">
          <label className={label}>نوع العلاقة</label>
          <select
            className="form-select form-select-sm"
            value={type}
            onChange={(e) => setType(e.target.value as keyof typeof RELATIONSHIP_LABELS)}
          >
            {Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="col-5">
          <label className={label}>الثقة</label>
          <select
            className="form-select form-select-sm"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value as typeof confidence)}
          >
            <option value="confirmed">مؤكَّدة</option>
            <option value="suspected">مشتبه بها</option>
          </select>
        </div>
      </div>
      <div className="mb-3">
        <label className={label}>سياق العلاقة</label>
        <textarea
          className={field}
          rows={3}
          value={contextNotes}
          onChange={(e) => setContextNotes(e.target.value)}
          placeholder="مثال: شريك في شركة وسيطة لتجارة الأخشاب…"
        />
      </div>
      <button className="btn btn-sm btn-primary w-100" disabled={busy}>
        <i className="bi bi-diagram-3 me-1" />
        إنشاء العلاقة
      </button>
    </form>
  );
}

/* ------------------------------ الوسائط والأدلة ------------------------------ */
export function MediaTab({
  personId,
  documents,
  call,
  busy,
  onNotice,
  onError,
}: CommonProps & {
  documents: DocumentView[];
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [lightbox, setLightbox] = useState<DocumentView | null>(null);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    onError("");
    try {
      const form = new FormData();
      for (const f of list) form.append("files", f);
      form.append("personId", personId);
      form.append("description", description);
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const payload = (await res.json()) as {
        ok: boolean;
        error?: string;
        created?: DocumentView[];
        skipped?: { name: string; reason: string }[];
      };
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? "فشل الرفع");
      onNotice(
        `تم رفع ${payload.created?.length ?? 0} ملف بنجاح${
          payload.skipped?.length ? ` — تم رفض ${payload.skipped.length} (نوع أو حجم غير مسموح)` : ""
        }`,
      );
      router.refresh();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="row g-3">
      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div
              className={`dropzone ${dragging ? "dragging" : ""}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void upload(e.dataTransfer.files);
              }}
            >
              <i className="bi bi-cloud-arrow-up fs-1 text-body-secondary" />
              <div className="fw-semibold">
                {uploading ? "جارٍ الرفع وحساب بصمات SHA-256…" : "اسحب الملفات هنا أو اضغط للاختيار"}
              </div>
              <div className="small text-body-secondary">
                رفع جماعي حتى 25 ملفاً — صور، PDF، مستندات، صوت. الحد 60 م.ب للملف، وتُرفض الامتدادات
                غير المصرّح بها.
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              className="d-none"
              multiple
              onChange={(e) => e.target.files && upload(e.target.files)}
            />
            <div className="row g-2 mt-3 align-items-end">
              <div className="col-12 col-md-9">
                <label className={label}>وصف السياق للمجموعة</label>
                <input
                  className={field}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="مثال: مستندات السجل التجاري 2019"
                />
              </div>
              <div className="col-12 col-md-3">
                <button
                  className="btn btn-sm btn-outline-primary w-100"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                >
                  <i className="bi bi-folder2-open me-1" />
                  اختيار ملفات
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {documents.filter((d) => d.isImage).length > 0 && (
        <div className="col-12">
          <h2 className="h6 fw-bold">
            <i className="bi bi-images me-2" />
            معرض الصور
          </h2>
          <div className="row g-2">
            {documents
              .filter((d) => d.isImage)
              .map((d) => (
                <div className="col-6 col-md-3 col-lg-2" key={d.id}>
                  <button
                    className="btn p-0 border-0 w-100"
                    onClick={() => setLightbox(d)}
                    title={d.originalName}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.previewUrl}
                      alt={d.originalName}
                      className="img-fluid rounded-3 border"
                      style={{ height: 120, width: "100%", objectFit: "cover" }}
                    />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-body-tertiary fw-semibold">
            <i className="bi bi-paperclip me-2" />
            فهرس الأدلة ({documents.length}) — سلسلة العهدة الرقمية
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>الاسم الأصلي</th>
                  <th>النوع</th>
                  <th>الحجم</th>
                  <th>SHA-256</th>
                  <th>الرفع</th>
                  <th className="text-end">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
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
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        {d.isImage && (
                          <button
                            className="btn btn-outline-secondary"
                            title="عرض بالحجم الكامل"
                            onClick={() => setLightbox(d)}
                          >
                            <i className="bi bi-zoom-in" />
                          </button>
                        )}
                        {d.isPdf && (
                          <a
                            className="btn btn-outline-secondary"
                            href={d.previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="معاينة PDF"
                          >
                            <i className="bi bi-file-earmark-pdf" />
                          </a>
                        )}
                        <a
                          className="btn btn-outline-secondary"
                          href={d.downloadUrl}
                          title="تنزيل موقّع"
                        >
                          <i className="bi bi-download" />
                        </a>
                        <button
                          className="btn btn-outline-warning"
                          title="تعيين كصورة الملف"
                          disabled={busy || d.isAvatar}
                          onClick={() => call(`/api/documents/${d.id}`, "PATCH", { isAvatar: true })}
                        >
                          <i className="bi bi-person-square" />
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          title="حذف"
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm(`حذف «${d.originalName}» نهائياً؟`)) return;
                            void call(`/api/documents/${d.id}`, "DELETE");
                          }}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {documents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-body-secondary small">
                      لا وسائط مرفوعة لهذا الملف.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {lightbox && (
        <div className="lightbox-backdrop" onClick={() => setLightbox(null)}>
          <div className="text-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.previewUrl} alt={lightbox.originalName} />
            <div className="text-white mt-2 small">
              <strong>{lightbox.originalName}</strong> — {formatBytes(lightbox.sizeBytes)} —
              <span className="hash-cell ms-2">{lightbox.sha256}</span>
            </div>
            <div className="mt-2 d-flex gap-2 justify-content-center">
              <a className="btn btn-sm btn-light" href={lightbox.downloadUrl}>
                <i className="bi bi-download me-1" />
                تنزيل موقّع
              </a>
              <button className="btn btn-sm btn-outline-light" onClick={() => setLightbox(null)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
