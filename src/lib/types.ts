import type {
  Confidence,
  DocumentRow,
  Email,
  Note,
  Person,
  Phone,
  RelationshipType,
  SearchEntityType,
  Sensitivity,
} from "@/db/schema";
import type { DossierProfileKey } from "@/lib/constants";

export type PersonListItem = Person & {
  phoneCount: number;
  emailCount: number;
  noteCount: number;
  documentCount: number;
  relationshipCount: number;
  avatarDocId: string | null;
};

export type DocumentView = Omit<DocumentRow, "createdAt"> & {
  createdAt: string;
  token: string;
  previewUrl: string;
  downloadUrl: string;
  isImage: boolean;
  isPdf: boolean;
};

export type RelatedPersonView = {
  relationshipId: string;
  otherPersonId: string;
  otherName: string;
  direction: "outgoing" | "incoming";
  type: RelationshipType;
  confidence: Confidence;
  contextNotes: string;
};

export type DossierNote = Omit<Note, "recordedAt" | "createdAt" | "updatedAt"> & {
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type DossierPayload = {
  profile: DossierProfileKey;
  generatedAt: string;
  person: Person;
  aliases: string[];
  phones: Phone[];
  emails: Email[];
  socials: { id: string; platform: string; handle: string; profileUrl: string }[];
  notes: DossierNote[];
  relationships: RelatedPersonView[];
  documents: DocumentView[];
  counts: {
    phones: number;
    emails: number;
    socials: number;
    notes: number;
    confidentialNotes: number;
    relationships: number;
    documents: number;
    totalBytes: number;
  };
  integrity: { fileCount: number; hashed: number };
};

export type SearchHit = {
  entityType: SearchEntityType;
  entityId: string;
  personId: string | null;
  title: string;
  subtitle: string;
  snippet: string;
  score: number;
  href: string;
};

export type SearchResponse = {
  query: string;
  engine: "postgres" | "meilisearch";
  tookMs: number;
  persons: {
    personId: string;
    fullName: string;
    sensitivity: Sensitivity;
    reliability: number;
    occupation: string;
    score: number;
    hits: SearchHit[];
  }[];
  total: number;
};
