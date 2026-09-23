import PersonForm from "@/components/PersonForm";

export const dynamic = "force-dynamic";

export default function NewPersonPage() {
  return (
    <>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <a href="/">لوحة التحكم</a>
          </li>
          <li className="breadcrumb-item">
            <a href="/persons">الملفات</a>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            ملف جديد
          </li>
        </ol>
      </nav>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">
          <i className="bi bi-person-add me-2" />
          فتح ملف تحقيقي جديد
        </h1>
      </div>
      <PersonForm />
    </>
  );
}
