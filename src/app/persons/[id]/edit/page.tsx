import { notFound } from "next/navigation";
import PersonForm from "@/components/PersonForm";
import { getPerson } from "@/db/queries";
import { reqUuid } from "@/lib/validate";

export const dynamic = "force-dynamic";

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let person = null;
  try {
    reqUuid(id, "id");
    person = await getPerson(id);
  } catch {
    person = null;
  }
  if (!person) notFound();

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
          <li className="breadcrumb-item">
            <a href={`/persons/${person.id}`}>{person.fullName}</a>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            تحرير
          </li>
        </ol>
      </nav>
      <h1 className="h4 mb-3">
        <i className="bi bi-pencil-square me-2" />
        تحرير ملف: {person.fullName}
      </h1>
      <PersonForm initial={person} />
    </>
  );
}
