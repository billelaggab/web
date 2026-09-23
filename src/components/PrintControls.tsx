"use client";

import Link from "next/link";
import { DOSSIER_PROFILES, type DossierProfileKey } from "@/lib/constants";

export default function PrintControls({
  personId,
  profile,
}: {
  personId: string;
  profile: DossierProfileKey;
}) {
  return (
    <div className="card border-0 shadow-sm mb-3 d-print-none">
      <div className="card-body">
        <div className="d-flex flex-wrap gap-3 align-items-center justify-content-between">
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <span className="fw-semibold me-1">
              <i className="bi bi-funnel me-1" />
              مرشّح التعقيم قبل الطباعة:
            </span>
            <div className="btn-group btn-group-sm flex-wrap">
              {Object.entries(DOSSIER_PROFILES).map(([key, value]) => (
                <Link
                  key={key}
                  href={`/persons/${personId}/dossier?profile=${key}`}
                  className={`btn ${
                    profile === key ? "btn-primary" : "btn-outline-secondary"
                  }`}
                >
                  {value.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-sm btn-warning" onClick={() => window.print()}>
              <i className="bi bi-printer me-1" />
              طباعة / حفظ كـ PDF
            </button>
            <a
              className="btn btn-sm btn-outline-secondary"
              href={`/api/dossier/${personId}?profile=${profile}`}
              target="_blank"
              rel="noreferrer"
            >
              <i className="bi bi-filetype-html me-1" />
              نسخة HTML للطباعة (WeasyPrint)
            </a>
            <a
              className="btn btn-sm btn-outline-secondary"
              href={`/api/dossier/${personId}?profile=${profile}&format=json`}
              target="_blank"
              rel="noreferrer"
            >
              <i className="bi bi-braces me-1" />
              JSON
            </a>
            <Link className="btn btn-sm btn-outline-secondary" href={`/persons/${personId}`}>
              <i className="bi bi-arrow-return-right me-1" />
              عودة للملف
            </Link>
          </div>
        </div>
        <div className="small text-body-secondary mt-2">
          تعتمد الطباعة على تنسيق A4 مع منع تقسيم الجداول والملاحظات عبر الصفحات، وعلامة مائية
          «سري — ملف تحقيقي» تظهر في كل صفحة. الأقسام غير المحدّثة للطباعة مخفية تلقائياً.
        </div>
      </div>
    </div>
  );
}
