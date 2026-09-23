import type { ReactNode } from "react";
import {
  NOTE_CATEGORY_ICONS,
  NOTE_CATEGORY_LABELS,
  PHONE_LABELS,
  RELATIONSHIP_LABELS,
  SENSITIVITY_BADGES,
  SENSITIVITY_LABELS,
  CONFIDENCE_LABELS,
  type DossierProfileKey,
} from "@/lib/constants";
import { renderMarkdown } from "@/lib/markdown";
import { initials } from "@/lib/format";
import type { Confidence, NoteCategory, PhoneLabel, RelationshipType, Sensitivity } from "@/db/schema";

export function SensitivityBadge({ level }: { level: Sensitivity }) {
  return <span className={`badge ${SENSITIVITY_BADGES[level]}`}>{SENSITIVITY_LABELS[level]}</span>;
}

export function ReliabilityStars({ value }: { value: number }) {
  const safe = Math.max(1, Math.min(5, value));
  return (
    <span className="text-warning" title={`تقييم الموثوقية ${safe}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <i key={i} className={`bi ${i < safe ? "bi-star-fill" : "bi-star"} text-warning`} />
      ))}
    </span>
  );
}

export function Avatar({
  name,
  url,
  size = 56,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  return (
    <div className="avatar-box" style={{ width: size, height: size, fontSize: size / 2.8 }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}

export function Chip({ children, tone = "light" }: { children: ReactNode; tone?: string }) {
  return <span className={`badge text-bg-${tone} border`}>{children}</span>;
}

export function CategoryChip({ category }: { category: NoteCategory }) {
  return (
    <span className="badge text-bg-secondary">
      <i className={`bi ${NOTE_CATEGORY_ICONS[category]} me-1`} />
      {NOTE_CATEGORY_LABELS[category]}
    </span>
  );
}

export function RelationshipChip({ type }: { type: RelationshipType }) {
  return <span className="badge text-bg-info">{RELATIONSHIP_LABELS[type]}</span>;
}

export function ConfidenceChip({ confidence }: { confidence: Confidence }) {
  return (
    <span className={`badge ${confidence === "confirmed" ? "text-bg-success" : "text-bg-warning"}`}>
      {CONFIDENCE_LABELS[confidence]}
    </span>
  );
}

export function PhoneLabelChip({ label }: { label: PhoneLabel }) {
  return <span className="badge text-bg-light border">{PHONE_LABELS[label]}</span>;
}

export function EmptyState({
  icon = "bi-inbox",
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-5 border rounded-3 bg-body-tertiary">
      <i className={`bi ${icon} display-5 text-body-secondary`} />
      <h5 className="mt-3 mb-1">{title}</h5>
      {hint && <p className="text-body-secondary small mb-3">{hint}</p>}
      {action}
    </div>
  );
}

/** عرض Markdown آمن: كل المدخلات تُهرَّب قبل التنسيق (لا XSS) */
export function MarkdownView({ source, className = "" }: { source: string; className?: string }) {
  if (!source?.trim()) return <p className="text-body-secondary mb-0 small">لا يوجد محتوى.</p>;
  return (
    <div
      className={`note-body ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}

export function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: string;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="card stat-card h-100 border-0 shadow-sm">
      <div className="card-body d-flex align-items-center gap-3">
        <div className="p-2 rounded-3 bg-primary-subtle text-primary-emphasis">
          <i className={`bi ${icon}`} />
        </div>
        <div>
          <div className="fs-4 fw-bold lh-1">{value}</div>
          <div className="small text-body-secondary">{label}</div>
          {hint && <div className="x-small text-body-tertiary">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

export function profileLabel(key: DossierProfileKey) {
  return key;
}
