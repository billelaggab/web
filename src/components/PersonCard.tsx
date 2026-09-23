import Link from "next/link";
import { Avatar, ReliabilityStars, SensitivityBadge } from "@/components/ui";
import { documentPreviewUrl } from "@/lib/media-urls";
import { formatDateTime } from "@/lib/format";
import type { PersonListItem } from "@/lib/types";

export default function PersonCard({ person }: { person: PersonListItem }) {
  return (
    <div className={`card person-card h-100 sens-${person.sensitivity}`}>
      <div className="card-body">
        <div className="d-flex gap-3 align-items-start">
          <Avatar
            name={person.fullName}
            url={person.avatarDocId ? documentPreviewUrl(person.avatarDocId) : null}
            size={60}
          />
          <div className="flex-grow-1 min-w-0">
            <div className="d-flex justify-content-between gap-2 align-items-start">
              <Link
                href={`/persons/${person.id}`}
                className="fw-bold text-decoration-none fs-5 text-body"
              >
                {person.fullName}
              </Link>
              <SensitivityBadge level={person.sensitivity} />
            </div>
            <div className="small text-body-secondary">{person.occupation || "بلا نشاط معروف"}</div>
            <div className="mt-1">
              <ReliabilityStars value={person.reliability} />
            </div>
            {person.aliases && (
              <div className="small text-body-secondary mt-1">
                <i className="bi bi-tags me-1" />
                {person.aliases.split(/[,،\n]/).filter(Boolean).slice(0, 3).join(" • ")}
              </div>
            )}
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 mt-3 small text-body-secondary">
          <span className="badge text-bg-light border">
            <i className="bi bi-telephone me-1" />
            {person.phoneCount}
          </span>
          <span className="badge text-bg-light border">
            <i className="bi bi-envelope me-1" />
            {person.emailCount}
          </span>
          <span className="badge text-bg-light border">
            <i className="bi bi-journal-text me-1" />
            {person.noteCount}
          </span>
          <span className="badge text-bg-light border">
            <i className="bi bi-paperclip me-1" />
            {person.documentCount}
          </span>
          <span className="badge text-bg-light border">
            <i className="bi bi-diagram-3 me-1" />
            {person.relationshipCount}
          </span>
        </div>

        <div className="d-flex justify-content-between align-items-center mt-3">
          <small className="text-body-tertiary">
            آخر تحديث: {formatDateTime(person.updatedAt)}
          </small>
          <div className="btn-group btn-group-sm">
            <Link className="btn btn-outline-secondary" href={`/persons/${person.id}`}>
              <i className="bi bi-folder2-open" />
            </Link>
            <Link className="btn btn-outline-secondary" href={`/persons/${person.id}/edit`}>
              <i className="bi bi-pencil" />
            </Link>
            <Link
              className="btn btn-outline-secondary"
              href={`/persons/${person.id}/dossier?profile=full`}
            >
              <i className="bi bi-printer" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
