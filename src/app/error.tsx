"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // يمكن توجيه الخطأ هنا إلى سجل التدقيق المحلي أو ملف سجل على القرص.
    console.error("ICIMS runtime error:", error.message);
  }, [error]);

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-12 col-md-8 col-lg-6">
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-danger text-white fw-semibold">
            <i className="bi bi-exclamation-octagon me-2" />
            خطأ في تنفيذ العملية
          </div>
          <div className="card-body">
            <p className="mb-2">
              حدث خطأ غير متوقع أثناء معالجة الطلب. لم تُفقد أي بيانات — قاعدة البيانات تُدار
              بمعاملات آمنة (ACID).
            </p>
            {error.digest && (
              <p className="small text-body-secondary mb-3">
                مرجع الخطأ: <code dir="ltr">{error.digest}</code>
              </p>
            )}
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={() => reset()}>
                <i className="bi bi-arrow-clockwise me-1" />
                إعادة المحاولة
              </button>
              <a className="btn btn-sm btn-outline-secondary" href="/">
                لوحة التحكم
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
