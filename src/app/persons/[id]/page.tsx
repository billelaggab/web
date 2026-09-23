import Link from "next/link";
import { notFound } from "next/navigation";
import PersonProfile from "@/components/PersonProfile";
import { getDossier, getPersonOptions } from "@/db/queries";
import { reqUuid } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Tab = "overview" | "contacts" | "notes" | "network" | "media";

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  try {
    reqUuid(id, "id");
  } catch {
    notFound();
  }

  const dossier = await getDossier(id, "full");
  if (!dossier) notFound();

  const options = await getPersonOptions();
  const rawTab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const initialTab: Tab = (["overview", "contacts", "notes", "network", "media"] as Tab[]).includes(
    rawTab as Tab,
  )
    ? (rawTab as Tab)
    : "overview";

  return (
    <>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link href="/">لوحة التحكم</Link>
          </li>
          <li className="breadcrumb-item">
            <Link href="/persons">الملفات</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            {dossier.person.fullName}
          </li>
        </ol>
      </nav>
      <PersonProfile dossier={dossier} personOptions={options} initialTab={initialTab} />
    </>
  );
}
