/**
 * قالب الملف الجنائي المستقل (HTML واحد قابل للطباعة أو التحويل إلى PDF عبر WeasyPrint).
 * لا يعتمد على أي مورد خارجي: كل الأنماط مضمّنة، والخطوط من النظام (Air-gap).
 * هذا القالب هو النظير المباشر لقالب Jinja2 المستخدم في نسخة FastAPI.
 */
import {
  CLASSIFICATION_WATERMARK,
  CONFIDENCE_LABELS,
  DOSSIER_PROFILES,
  NOTE_CATEGORY_LABELS,
  PHONE_LABELS,
  RELATIONSHIP_LABELS,
  SENSITIVITY_LABELS,
  EMAIL_TYPE_LABELS,
} from "@/lib/constants";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { escapeText, renderMarkdown } from "@/lib/markdown";
import type { DossierPayload } from "@/lib/types";

function section(title: string, body: string): string {
  return `<section class="section"><h2>${escapeText(title)}</h2>${body}</section>`;
}

function row(label: string, value: string): string {
  return `<tr><th>${escapeText(label)}</th><td>${value || "—"}</td></tr>`;
}

export function renderDossierHtml(dossier: DossierPayload): string {
  const { person, aliases, phones, emails, socials, notes, relationships, documents, counts } =
    dossier;
  const profile = DOSSIER_PROFILES[dossier.profile];
  const watermark = escapeText(CLASSIFICATION_WATERMARK);

  const header = `
    <header class="cover">
      <div class="cover-head">
        <div class="brand">
          <div class="brand-title">ملف تحقيقي — ${escapeText(person.fullName)}</div>
          <div class="brand-sub">أُنشئ بواسطة منظومة إدارة جهات الاتصال والاستخبارات (نسخة محلية معزولة)</div>
        </div>
        <div class="classification classification-${escapeText(person.sensitivity)}">
          ${escapeText(SENSITIVITY_LABELS[person.sensitivity])}
        </div>
      </div>
      <table class="meta">
        <tbody>
          ${row("الاسم الكامل", escapeText(person.fullName))}
          ${row("الأسماء المستعارة / الأكواد", aliases.map(escapeText).join(" • "))}
          ${row("تاريخ الميلاد", escapeText(formatDate(person.dateOfBirth)))}
          ${row("الجنسية", escapeText(person.nationality))}
          ${row("النشاط / الغطاء المهني", escapeText(person.occupation))}
          ${row("العنوان الحالي", escapeText(person.address))}
          ${row("تقييم الموثوقية", `${person.reliability}/5`)}
          ${row("مستوى الحساسية", escapeText(SENSITIVITY_LABELS[person.sensitivity]))}
          ${row("نمط التصدير", escapeText(profile.label))}
          ${row("تاريخ التوليد", escapeText(formatDateTime(dossier.generatedAt)))}
        </tbody>
      </table>
      ${person.summary ? `<div class="summary">${renderMarkdown(person.summary)}</div>` : ""}
    </header>`;

  const contactCards = [
    section(
      `بطاقات الاتصال (${phones.length + emails.length + socials.length})`,
      `<table>
        <thead><tr><th>النوع</th><th>القيمة</th><th>تصنيف</th><th>ملاحظات</th></tr></thead>
        <tbody>
          ${phones
            .map(
              (p) =>
                `<tr><td>هاتف</td><td>${escapeText(p.number)}</td><td>${escapeText(
                  PHONE_LABELS[p.label],
                )}</td><td>${escapeText(p.carrierNotes)}${
                  [p.whatsapp ? "واتساب" : "", p.signal ? "سيجنال" : "", p.telegram ? "تيليجرام" : ""]
                    .filter(Boolean)
                    .map((x) => `<span class="chip">${escapeText(x)}</span>`)
                    .join("")
                }</td></tr>`,
            )
            .join("")}
          ${emails
            .map(
              (e) =>
                `<tr><td>بريد</td><td>${escapeText(e.address)}</td><td>${escapeText(
                  EMAIL_TYPE_LABELS[e.type],
                )}</td><td>${e.pgpPublicKey ? '<span class="chip">مفتاح PGP مرفق</span>' : ""}</td></tr>`,
            )
            .join("")}
          ${socials
            .map(
              (s) =>
                `<tr><td>تواصل</td><td>${escapeText(s.handle)}</td><td>${escapeText(
                  s.platform,
                )}</td><td>${escapeText(s.profileUrl)}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>`,
    ),
  ].join("");

  const intelLog = section(
    `السجل الاستخباري الزمني (${notes.length})`,
    notes.length
      ? notes
          .map(
            (n) => `<article class="note">
              <div class="note-head">
                <strong>${escapeText(n.title)}</strong>
                <span class="chip">${escapeText(NOTE_CATEGORY_LABELS[n.category])}</span>
                ${n.isConfidential ? '<span class="chip chip-danger">سري</span>' : ""}
              </div>
              <div class="note-meta">
                تاريخ الحدث: ${escapeText(formatDate(n.eventDate))} — تاريخ التدوين: ${escapeText(
                  formatDateTime(n.recordedAt),
                )}
              </div>
              <div class="note-body">${renderMarkdown(n.content)}</div>
            </article>`,
          )
          .join("")
      : `<p class="empty">لا توجد ملاحظات ضمن نطاق هذا التصدير.</p>`,
  );

  const relDir = section(
    `دليل العلاقات (${relationships.length})`,
    relationships.length
      ? `<table>
          <thead><tr><th>الطرف</th><th>نوع العلاقة</th><th>الثقة</th><th>الاتجاه</th><th>سياق</th></tr></thead>
          <tbody>
          ${relationships
            .map(
              (r) =>
                `<tr><td>${escapeText(r.otherName)}</td><td>${escapeText(
                  RELATIONSHIP_LABELS[r.type],
                )}</td><td>${escapeText(CONFIDENCE_LABELS[r.confidence])}</td><td>${
                  r.direction === "outgoing" ? "صادر" : "وارد"
                }</td><td>${escapeText(r.contextNotes)}</td></tr>`,
            )
            .join("")}
          </tbody>
        </table>`
      : `<p class="empty">لا توجد علاقات مسجلة.</p>`,
  );

  const evidence = section(
    `فهرس الأدلة والمرفقات (${documents.length} من ${counts.documents} — ${
      counts.totalBytes ? formatBytes(counts.totalBytes) : "0"
    })`,
    documents.length
      ? `<table>
          <thead><tr><th>الاسم الأصلي</th><th>النوع</th><th>الحجم</th><th>SHA-256</th><th>الوصف</th></tr></thead>
          <tbody>
          ${documents
            .map(
              (d) =>
                `<tr><td>${escapeText(d.originalName)}</td><td>${escapeText(d.mimeType)}</td><td>${formatBytes(
                  d.sizeBytes,
                )}</td><td class="hash">${escapeText(d.sha256)}</td><td>${escapeText(
                  d.description,
                )}</td></tr>`,
            )
            .join("")}
          </tbody>
        </table>`
      : `<p class="empty">لا توجد وسائط ضمن نطاق هذا التصدير.</p>`,
  );

  const footer = `<footer class="foot">
    <div>سلسلة العهدة الرقمية: ${counts.documents} ملف — ${dossier.integrity.hashed} بصمة SHA-256 مسجلة</div>
    <div>ملاحظات سرية مستثناة: ${profile.excludeConfidential ? "نعم" : "لا"} — الوسائط المستثناة: ${
      profile.excludeMedia ? "نعم" : "لا"
    }</div>
    <div>${escapeText(CLASSIFICATION_WATERMARK)} — نسخة مطبوعة تخضع لرقابة التداول</div>
  </footer>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ملف تحقيقي — ${escapeText(person.fullName)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Tajawal", "Cairo", "Noto Naskh Arabic", "Segoe UI", Tahoma, sans-serif; color: #14202b; margin: 0; padding: 24px; background: #f4f6f8; font-size: 12px; line-height: 1.7; }
  .page { background: #fff; max-width: 900px; margin: 0 auto; padding: 28px 32px; border: 1px solid #d3dae1; border-radius: 6px; position: relative; }
  .watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
  .watermark span { transform: rotate(-32deg); font-size: 56px; font-weight: 800; color: rgba(178, 34, 52, 0.07); letter-spacing: 4px; white-space: nowrap; }
  .cover-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 3px double #14202b; padding-bottom: 12px; }
  .brand-title { font-size: 20px; font-weight: 800; }
  .brand-sub { color: #55657a; font-size: 11px; }
  .classification { border: 2px solid #b22234; color: #b22234; padding: 6px 14px; font-weight: 800; border-radius: 4px; white-space: nowrap; }
  .classification-top_secret { background: #b22234; color: #fff; }
  .classification-confidential { border-color: #b26a00; color: #b26a00; }
  .classification-public { border-color: #1c7a4a; color: #1c7a4a; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; page-break-inside: avoid; }
  th, td { border: 1px solid #cfd8e0; padding: 6px 8px; text-align: right; vertical-align: top; word-break: break-word; }
  thead th { background: #eef2f6; font-size: 11px; }
  .meta th { width: 32%; background: #f7f9fb; }
  .summary { background: #f7f9fb; border-inline-start: 4px solid #14202b; padding: 10px 14px; margin-top: 14px; page-break-inside: avoid; }
  .section h2 { font-size: 14px; font-weight: 800; border-bottom: 1px solid #cfd8e0; padding-bottom: 6px; margin: 22px 0 10px; }
  .note { border: 1px solid #dbe2e8; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
  .note-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .note-meta { color: #55657a; font-size: 10.5px; margin-top: 2px; }
  .note-body { margin-top: 6px; }
  .note-body h3, .note-body h4, .note-body h5 { margin: 8px 0 4px; font-size: 12px; }
  .chip { display: inline-block; background: #e8eef4; border-radius: 999px; padding: 1px 8px; font-size: 10px; margin-inline-start: 4px; }
  .chip-danger { background: #b22234; color: #fff; }
  .hash { font-family: "Courier New", monospace; font-size: 9.5px; direction: ltr; text-align: left; }
  .empty { color: #55657a; font-style: italic; }
  .foot { margin-top: 26px; border-top: 1px solid #cfd8e0; padding-top: 10px; color: #55657a; font-size: 10.5px; display: grid; gap: 4px; }
  @media print {
    body { background: #fff; padding: 0; }
    .page { border: none; max-width: none; padding: 0; }
    .section h2 { page-break-after: avoid; }
    table, .note, .summary { page-break-inside: avoid; }
    thead { display: table-header-group; }
  }
</style>
</head>
<body>
  <div class="watermark"><span>${watermark}</span></div>
  <div class="page">
    ${header}
    ${contactCards}
    ${intelLog}
    ${relDir}
    ${evidence}
    ${footer}
  </div>
</body>
</html>`;
}
