export default function Loading() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center py-5 text-body-secondary">
      <div className="spinner-border mb-3" role="status" aria-hidden="true" />
      <span className="small">جارٍ تحميل البيانات من قاعدة البيانات المحلية…</span>
    </div>
  );
}
