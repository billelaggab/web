import Link from "next/link";

export default function NotFound() {
  return (
    <div className="row justify-content-center mt-5">
      <div className="col-12 col-md-7 col-lg-5">
        <div className="card border-0 shadow-sm text-center">
          <div className="card-body p-4">
            <i className="bi bi-folder-x display-3 text-body-secondary" />
            <h1 className="h4 mt-3">الملف غير موجود</h1>
            <p className="text-body-secondary small">
              قد يكون الملف حُذف، أو أن المعرّف المطلوب غير صحيح. تحقّق من الرابط أو ابحث من جديد.
            </p>
            <div className="d-flex gap-2 justify-content-center mt-3">
              <Link className="btn btn-primary btn-sm" href="/persons">
                <i className="bi bi-person-vcard me-1" />
                كل الملفات
              </Link>
              <Link className="btn btn-outline-secondary btn-sm" href="/">
                <i className="bi bi-speedometer2 me-1" />
                لوحة التحكم
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
