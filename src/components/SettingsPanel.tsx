"use client";

import { useEffect, useState } from "react";

type HealthPayload = {
  ok: boolean;
  service: string;
  version: string;
  mode: string;
  checks: Record<string, string>;
};

type ReindexPayload = {
  ok: boolean;
  persons?: number;
  documents?: number;
  tookMs?: number;
  meilisearch?: { ok: boolean; detail: string };
  error?: string;
};

function StatusPill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`badge ${ok ? "text-bg-success" : "text-bg-danger"}`}>
      <i className={`bi ${ok ? "bi-check-circle-fill" : "bi-x-circle-fill"} me-1`} />
      {text}
    </span>
  );
}

export default function SettingsPanel() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [reindexResult, setReindexResult] = useState<ReindexPayload | null>(null);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function loadHealth() {
    setBusy("health");
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      setHealth((await res.json()) as HealthPayload);
    } catch (err) {
      setHealth({
        ok: false,
        service: "icims-api",
        version: "-",
        mode: "-",
        checks: { error: (err as Error).message },
      });
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  async function reindex() {
    setBusy("reindex");
    setReindexResult(null);
    try {
      const res = await fetch("/api/search/reindex", { method: "POST" });
      setReindexResult((await res.json()) as ReindexPayload);
    } catch (err) {
      setReindexResult({ ok: false, error: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function seed() {
    if (!window.confirm("سيتم إدخال بيانات تجريبية (إن كانت القاعدة فارغة). المتابعة؟")) return;
    setBusy("seed");
    setSeedResult(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; created?: number; error?: string };
      setSeedResult(
        data.ok ? `تم إنشاء ${data.created ?? 0} ملف تجريبي مع السجلات المرتبطة.` : data.error ?? "فشل",
      );
    } catch (err) {
      setSeedResult((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="row g-3">
      <div className="col-12 col-lg-6">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-body-tertiary fw-semibold d-flex justify-content-between">
            <span>
              <i className="bi bi-heart-pulse me-2" />
              فحص صحة النظام
            </span>
            <button className="btn btn-sm btn-outline-secondary" onClick={loadHealth} disabled={busy === "health"}>
              <i className="bi bi-arrow-clockwise" />
            </button>
          </div>
          <div className="card-body">
            {health ? (
              <>
                <div className="mb-2">
                  <StatusPill ok={health.ok} text={health.ok ? "الخدمة تعمل" : "خلل"} />
                  <span className="ms-2 small text-body-secondary">
                    {health.service} {health.version} — {health.mode}
                  </span>
                </div>
                <ul className="list-unstyled small mb-0">
                  {Object.entries(health.checks).map(([key, value]) => (
                    <li key={key} className="d-flex gap-2">
                      <strong className="text-body-secondary">{key}:</strong>
                      <span dir={key === "storage" ? "ltr" : undefined}>{value}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="small text-body-secondary mb-0">جارٍ الفحص…</p>
            )}
          </div>
        </div>
      </div>

      <div className="col-12 col-lg-6">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-header bg-body-tertiary fw-semibold">
            <i className="bi bi-list-columns-reverse me-2" />
            فهرس البحث الموحّد
          </div>
          <div className="card-body">
            <p className="small text-body-secondary">
              يعمل خط أنابيب الفهرسة (Write-through) بعد كل عملية كتابة. عند ترقية النظام أو استعادة
              نسخة احتياطية، أعد بناء الفهرس بالكامل.
            </p>
            <button className="btn btn-sm btn-primary" onClick={reindex} disabled={busy === "reindex"}>
              <i className="bi bi-arrow-repeat me-1" />
              {busy === "reindex" ? "جارٍ البناء…" : "إعادة بناء الفهرس"}
            </button>
            {reindexResult && (
              <div className={`alert ${reindexResult.ok ? "alert-success" : "alert-danger"} mt-3 py-2 small`}>
                {reindexResult.ok
                  ? `تمت فهرسة ${reindexResult.persons} ملف و ${reindexResult.documents} مستند في ${reindexResult.tookMs} مللي ثانية. Meilisearch: ${reindexResult.meilisearch?.detail ?? "غير مفعّل"}`
                  : reindexResult.error}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-body-tertiary fw-semibold">
            <i className="bi bi-database-add me-2" />
            بيانات تجريبية
          </div>
          <div className="card-body">
            <p className="small text-body-secondary">
              إدخال مجموعة ملفات تجريبية (أسماء وشبكة علاقات وملاحظات) لاختبار البحث والتصدير. تعمل
              فقط إذا كانت القاعدة فارغة.
            </p>
            <button className="btn btn-sm btn-outline-primary" onClick={seed} disabled={busy === "seed"}>
              <i className="bi bi-magic me-1" />
              {busy === "seed" ? "جارٍ الإدخال…" : "إدخال بيانات تجريبية"}
            </button>
            {seedResult && <div className="alert alert-light border mt-3 py-2 small mb-0">{seedResult}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
