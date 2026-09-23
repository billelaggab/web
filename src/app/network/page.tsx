import Link from "next/link";
import NetworkGraph from "@/components/NetworkGraph";
import { ConfidenceChip, RelationshipChip } from "@/components/ui";
import { getNetworkGraph } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  let data: Awaited<ReturnType<typeof getNetworkGraph>> | null = null;
  let error: string | null = null;
  try {
    data = await getNetworkGraph();
  } catch (err) {
    error = (err as Error).message;
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1 fw-bold">
            <i className="bi bi-diagram-3 me-2" />
            شبكة العلاقات
          </h1>
          <p className="text-body-secondary small mb-0">
            تمثيل بصري للعلاقات بين الملفات (محامٍ، شريك تجاري، قريب، شريك في فعل، خصم، مُبلِّغ).
          </p>
        </div>
        <Link className="btn btn-outline-secondary" href="/persons">
          <i className="bi bi-person-vcard me-1" />
          إدارة الملفات
        </Link>
      </div>

      {error && (
        <div className="alert alert-warning">
          <i className="bi bi-database-exclamation me-2" />
          تعذّر جلب الشبكة: {error}
        </div>
      )}

      {data && (
        <>
          <NetworkGraph nodes={data.nodes} links={data.links} />

          {data.links.length > 0 && (
            <div className="card border-0 shadow-sm mt-3">
              <div className="card-header bg-body-tertiary fw-semibold">
                <i className="bi bi-list-ul me-2" />
                كل العلاقات المسجّلة ({data.links.length})
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>المصدر</th>
                      <th>الهدف</th>
                      <th>النوع</th>
                      <th>الثقة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.links.map((link) => {
                      const source = data!.nodes.find((n) => n.id === link.source);
                      const target = data!.nodes.find((n) => n.id === link.target);
                      return (
                        <tr key={link.id}>
                          <td>
                            <Link href={`/persons/${link.source}`} className="text-decoration-none">
                              {source?.fullName ?? "—"}
                            </Link>
                          </td>
                          <td>
                            <Link href={`/persons/${link.target}`} className="text-decoration-none">
                              {target?.fullName ?? "—"}
                            </Link>
                          </td>
                          <td>
                            <RelationshipChip type={link.type} />
                          </td>
                          <td>
                            <ConfidenceChip confidence={link.confidence} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
