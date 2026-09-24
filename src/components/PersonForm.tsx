"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  NATIONALITY_OPTIONS,
  RELIABILITY_HINTS,
  SENSITIVITY_LABELS,
} from "@/lib/constants";
import type { Person, Sensitivity } from "@/db/schema";

type PhoneDraft = {
  number: string;
  label: "personal" | "work" | "burner";
  whatsapp: boolean;
  signal: boolean;
  telegram: boolean;
  carrierNotes: string;
};
type EmailDraft = { address: string; type: "primary" | "leaked" | "secure"; pgpPublicKey: string };
type SocialDraft = { platform: string; handle: string; profileUrl: string };
type NoteDraft = {
  title: string;
  content: string;
  category: "meeting" | "financial" | "background" | "leak";
  eventDate: string;
  isConfidential: boolean;
};

const emptyPhone: PhoneDraft = {
  number: "",
  label: "personal",
  whatsapp: false,
  signal: false,
  telegram: false,
  carrierNotes: "",
};
const emptyEmail: EmailDraft = { address: "", type: "primary", pgpPublicKey: "" };
const emptySocial: SocialDraft = { platform: "X (تويتر)", handle: "", profileUrl: "" };
const emptyNote: NoteDraft = {
  title: "",
  content: "",
  category: "meeting",
  eventDate: "",
  isConfidential: false,
};

export default function PersonForm({ initial }: { initial?: Person }) {
  const router = useRouter();
  const editing = Boolean(initial);

  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [aliases, setAliases] = useState(initial?.aliases ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(initial?.dateOfBirth ?? "");
  const [nationality, setNationality] = useState(initial?.nationality ?? "");
  const [occupation, setOccupation] = useState(initial?.occupation ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [reliability, setReliability] = useState(initial?.reliability ?? 3);
  const [sensitivity, setSensitivity] = useState<Sensitivity>(initial?.sensitivity ?? "confidential");

  const [phones, setPhones] = useState<PhoneDraft[]>([]);
  const [emails, setEmails] = useState<EmailDraft[]>([]);
  const [socials, setSocials] = useState<SocialDraft[]>([]);
  const [notes, setNotes] = useState<NoteDraft[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) {
      setError("الاسم الكامل مطلوب (حرفان على الأقل).");
      return;
    }
    setBusy(true);
    setError(null);
    setRetryable(false);
    let httpStatus = 0;
    try {
      const payload = {
        fullName: fullName.trim(),
        aliases,
        dateOfBirth: dateOfBirth || null,
        nationality,
        occupation,
        address,
        summary,
        reliability,
        sensitivity,
        phones,
        emails,
        socials,
        notes,
      };
      const res = await fetch(editing ? `/api/persons/${initial!.id}` : "/api/persons", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      httpStatus = res.status;
      const data = (await res.json().catch(() => ({ ok: false }))) as {
        ok: boolean;
        error?: string;
        person?: Person;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `فشل الحفظ (رمز ${res.status})`);
      }
      router.push(`/persons/${editing ? initial!.id : data.person!.id}`);
      router.refresh();
    } catch (err) {
      // 503/504 = حالة مؤقتة (قاعدة البيانات أو المخطط غير جاهز) — يمكن إعادة المحاولة.
      setRetryable(httpStatus === 503 || httpStatus === 504 || httpStatus === 0);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const label = "form-label small fw-semibold";
  const field = "form-control form-control-sm";

  return (
    <form onSubmit={submit} className="d-print-none">
      {error && (
        <div className="alert alert-danger">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill" />
            <span>{error}</span>
          </div>
          {retryable ? (
            <div className="small mt-2 border-top pt-2 d-flex align-items-center gap-2">
              <i className="bi bi-info-circle" />
              <span>
                هذه حالة مؤقتة (قاعدة البيانات لم تكن جاهزة أو المخطط لم يُطبَّق بعد). لم تُفقد
                أي بيانات — انتظر ثانيتين ثم أعد المحاولة، أو راجع صفحة الإعدادات لفحص الحالة.
              </span>
              <button type="submit" className="btn btn-sm btn-outline-danger ms-2" disabled={busy}>
                إعادة المحاولة
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-header bg-body-tertiary fw-semibold">
          <i className="bi bi-person-vcard me-2" />
          البيانات الأساسية
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <label className={label}>الاسم الكامل *</label>
              <input
                className={field}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: أحمد سليم الحارثي"
                required
              />
            </div>
            <div className="col-12 col-lg-6">
              <label className={label}>الأسماء المستعارة / أكواد الملف</label>
              <input
                className={field}
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                placeholder="افصل بينها بفاصلة: أبو سليم، الصقر"
              />
            </div>
            <div className="col-6 col-lg-3">
              <label className={label}>تاريخ الميلاد</label>
              <input
                type="date"
                className={field}
                value={dateOfBirth ?? ""}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>
            <div className="col-6 col-lg-3">
              <label className={label}>الجنسية</label>
              <input
                className={field}
                list="nationality-options"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
              />
              <datalist id="nationality-options">
                {NATIONALITY_OPTIONS.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <div className="col-12 col-lg-6">
              <label className={label}>النشاط / الغطاء المهني</label>
              <input
                className={field}
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="مثال: رجل أعمال — شركة مقاولات"
              />
            </div>
            <div className="col-12">
              <label className={label}>العنوان الفعلي الحالي</label>
              <input
                className={field}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="المدينة — الحي — أقرب معلم"
              />
            </div>
            <div className="col-12">
              <label className={label}>
                ملخص الملف <span className="text-body-secondary">(يدعم Markdown)</span>
              </label>
              <textarea
                className={field}
                rows={4}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="**الخلاصة الاستقصائية:** شخص محوري في شبكة مشتريات عامة…"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-header bg-body-tertiary fw-semibold">
          <i className="bi bi-shield-exclamation me-2" />
          التصنيف والموثوقية
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <label className={label}>مستوى الحساسية</label>
              <select
                className="form-select form-select-sm"
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value as Sensitivity)}
              >
                {Object.entries(SENSITIVITY_LABELS).map(([key, text]) => (
                  <option key={key} value={key}>
                    {text}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-lg-6">
              <label className={label}>
                تقييم الموثوقية: <span className="text-primary">{RELIABILITY_HINTS[reliability - 1]}</span>
              </label>
              <input
                type="range"
                className="form-range"
                min={1}
                max={5}
                step={1}
                value={reliability}
                onChange={(e) => setReliability(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>

      {!editing && (
        <>
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-body-tertiary d-flex justify-content-between align-items-center fw-semibold">
              <span>
                <i className="bi bi-telephone me-2" />
                الأرقام ({phones.length})
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => setPhones([...phones, { ...emptyPhone }])}
              >
                <i className="bi bi-plus-lg" />
              </button>
            </div>
            <div className="card-body">
              {phones.length === 0 && (
                <p className="text-body-secondary small mb-0">لا أرقام مضافة بعد.</p>
              )}
              {phones.map((p, i) => (
                <div className="row g-2 align-items-end border-bottom pb-2 mb-2" key={i}>
                  <div className="col-12 col-md-4">
                    <input
                      className={field}
                      placeholder="+966512345678 (E.164)"
                      value={p.number}
                      onChange={(e) => {
                        const next = [...phones];
                        next[i] = { ...p, number: e.target.value };
                        setPhones(next);
                      }}
                    />
                  </div>
                  <div className="col-6 col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={p.label}
                      onChange={(e) => {
                        const next = [...phones];
                        next[i] = { ...p, label: e.target.value as PhoneDraft["label"] };
                        setPhones(next);
                      }}
                    >
                      <option value="personal">شخصي</option>
                      <option value="work">عمل</option>
                      <option value="burner">رقم مؤقت</option>
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`wa-${i}`}
                        checked={p.whatsapp}
                        onChange={(e) => {
                          const next = [...phones];
                          next[i] = { ...p, whatsapp: e.target.checked };
                          setPhones(next);
                        }}
                      />
                      <label className="form-check-label small" htmlFor={`wa-${i}`}>
                        واتساب
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`sg-${i}`}
                        checked={p.signal}
                        onChange={(e) => {
                          const next = [...phones];
                          next[i] = { ...p, signal: e.target.checked };
                          setPhones(next);
                        }}
                      />
                      <label className="form-check-label small" htmlFor={`sg-${i}`}>
                        سيجنال
                      </label>
                    </div>
                  </div>
                  <div className="col-12 col-md-2 text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setPhones(phones.filter((_, idx) => idx !== i))}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-body-tertiary d-flex justify-content-between align-items-center fw-semibold">
              <span>
                <i className="bi bi-envelope me-2" />
                البريد الإلكتروني ({emails.length})
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => setEmails([...emails, { ...emptyEmail }])}
              >
                <i className="bi bi-plus-lg" />
              </button>
            </div>
            <div className="card-body">
              {emails.length === 0 && (
                <p className="text-body-secondary small mb-0">لا عناوين بريد بعد.</p>
              )}
              {emails.map((e, i) => (
                <div className="row g-2 align-items-end border-bottom pb-2 mb-2" key={i}>
                  <div className="col-12 col-md-5">
                    <input
                      className={field}
                      placeholder="name@example.com"
                      value={e.address}
                      onChange={(ev) => {
                        const next = [...emails];
                        next[i] = { ...e, address: ev.target.value };
                        setEmails(next);
                      }}
                    />
                  </div>
                  <div className="col-6 col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={e.type}
                      onChange={(ev) => {
                        const next = [...emails];
                        next[i] = { ...e, type: ev.target.value as EmailDraft["type"] };
                        setEmails(next);
                      }}
                    >
                      <option value="primary">أساسي</option>
                      <option value="leaked">مُسرَّب</option>
                      <option value="secure">آمن (Proton/PGP)</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-3">
                    <input
                      className={field}
                      placeholder="مفتاح PGP العام (اختياري)"
                      value={e.pgpPublicKey}
                      onChange={(ev) => {
                        const next = [...emails];
                        next[i] = { ...e, pgpPublicKey: ev.target.value };
                        setEmails(next);
                      }}
                    />
                  </div>
                  <div className="col-12 col-md-1 text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setEmails(emails.filter((_, idx) => idx !== i))}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-body-tertiary d-flex justify-content-between align-items-center fw-semibold">
              <span>
                <i className="bi bi-share me-2" />
                حسابات التواصل ({socials.length})
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => setSocials([...socials, { ...emptySocial }])}
              >
                <i className="bi bi-plus-lg" />
              </button>
            </div>
            <div className="card-body">
              {socials.length === 0 && (
                <p className="text-body-secondary small mb-0">لا حسابات بعد.</p>
              )}
              {socials.map((s, i) => (
                <div className="row g-2 align-items-end border-bottom pb-2 mb-2" key={i}>
                  <div className="col-12 col-md-3">
                    <input
                      className={field}
                      placeholder="المنصة"
                      value={s.platform}
                      onChange={(ev) => {
                        const next = [...socials];
                        next[i] = { ...s, platform: ev.target.value };
                        setSocials(next);
                      }}
                    />
                  </div>
                  <div className="col-6 col-md-3">
                    <input
                      className={field}
                      placeholder="@handle"
                      value={s.handle}
                      onChange={(ev) => {
                        const next = [...socials];
                        next[i] = { ...s, handle: ev.target.value };
                        setSocials(next);
                      }}
                    />
                  </div>
                  <div className="col-12 col-md-5">
                    <input
                      className={field}
                      placeholder="https://… (يُقبل https فقط)"
                      value={s.profileUrl}
                      onChange={(ev) => {
                        const next = [...socials];
                        next[i] = { ...s, profileUrl: ev.target.value };
                        setSocials(next);
                      }}
                    />
                  </div>
                  <div className="col-12 col-md-1 text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setSocials(socials.filter((_, idx) => idx !== i))}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-body-tertiary d-flex justify-content-between align-items-center fw-semibold">
              <span>
                <i className="bi bi-journal-text me-2" />
                ملاحظات استخبارية أولية ({notes.length})
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => setNotes([...notes, { ...emptyNote }])}
              >
                <i className="bi bi-plus-lg" />
              </button>
            </div>
            <div className="card-body">
              {notes.length === 0 && (
                <p className="text-body-secondary small mb-0">لا ملاحظات بعد.</p>
              )}
              {notes.map((n, i) => (
                <div className="border-bottom pb-2 mb-3" key={i}>
                  <div className="row g-2 align-items-end">
                    <div className="col-12 col-md-4">
                      <input
                        className={field}
                        placeholder="عنوان الملاحظة"
                        value={n.title}
                        onChange={(ev) => {
                          const next = [...notes];
                          next[i] = { ...n, title: ev.target.value };
                          setNotes(next);
                        }}
                      />
                    </div>
                    <div className="col-6 col-md-3">
                      <select
                        className="form-select form-select-sm"
                        value={n.category}
                        onChange={(ev) => {
                          const next = [...notes];
                          next[i] = { ...n, category: ev.target.value as NoteDraft["category"] };
                          setNotes(next);
                        }}
                      >
                        <option value="meeting">محضر اجتماع</option>
                        <option value="financial">مسار مالي</option>
                        <option value="background">تحقق خلفي</option>
                        <option value="leak">تسريب من مصدر</option>
                      </select>
                    </div>
                    <div className="col-6 col-md-3">
                      <input
                        type="date"
                        className={field}
                        value={n.eventDate}
                        onChange={(ev) => {
                          const next = [...notes];
                          next[i] = { ...n, eventDate: ev.target.value };
                          setNotes(next);
                        }}
                      />
                    </div>
                    <div className="col-12 col-md-2">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`conf-${i}`}
                          checked={n.isConfidential}
                          onChange={(ev) => {
                            const next = [...notes];
                            next[i] = { ...n, isConfidential: ev.target.checked };
                            setNotes(next);
                          }}
                        />
                        <label className="form-check-label small" htmlFor={`conf-${i}`}>
                          سري
                        </label>
                      </div>
                    </div>
                  </div>
                  <textarea
                    className={`${field} mt-2`}
                    rows={3}
                    placeholder="المحتوى (Markdown)"
                    value={n.content}
                    onChange={(ev) => {
                      const next = [...notes];
                      next[i] = { ...n, content: ev.target.value };
                      setNotes(next);
                    }}
                  />
                  <div className="text-end mt-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setNotes(notes.filter((_, idx) => idx !== i))}
                    >
                      <i className="bi bi-trash" /> حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="d-flex gap-2 justify-content-end sticky-bottom bg-body py-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <i className={`bi ${busy ? "bi-hourglass-split" : "bi-save"} me-1`} />
          {editing ? "حفظ التعديلات" : "إنشاء الملف"}
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => router.back()}
          disabled={busy}
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
