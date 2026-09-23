"""
===========================================================================================
 منظومة إدارة جهات الاتصال والاستخبارات — المرجع المرجعي لطبقة FastAPI
 (SQLAlchemy 2.0 + Pydantic v2 + Meilisearch + WeasyPrint) — يعمل معزولاً بالكامل.
-------------------------------------------------------------------------------------------
 هذا الملف هو نظير Python للتنفيذ الجاهز في هذا المستودع (Next.js + Drizzle).
 المخططان متطابقان تماماً، فيمكن تشغيل الطبقتين معاً على نفس قاعدة البيانات.
===========================================================================================
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Literal, Sequence

import httpx
import jwt  # مثال على امتداد ممكن؛ لا يُستخدم افتراضياً
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    delete,
    func,
    select,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

# ------------------------------------------------------------------ الإعدادات
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg://icims:icims_local_pw@db:5432/icims")
MEDIA_DIR = Path(os.environ.get("MEDIA_DIR", "/data/media"))
APP_SECRET = os.environ.get("APP_SECRET", "change-me-app-secret").encode()
MEILI_HOST = os.environ.get("MEILISEARCH_HOST", "").rstrip("/")
MEILI_KEY = os.environ.get("MEILI_MASTER_KEY", "")
MEILI_INDEX = os.environ.get("MEILISEARCH_INDEX", "icims")
MAX_FILE_BYTES = 60 * 1024 * 1024

MEDIA_DIR.mkdir(parents=True, exist_ok=True, mode=0o750)


# ------------------------------------------------------------------ النماذج (SQLAlchemy)
class Base(DeclarativeBase):
    pass


class Person(Base):
    __tablename__ = "persons"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name: Mapped[str] = mapped_column("full_name", String(200), nullable=False, index=True)
    aliases: Mapped[str] = mapped_column(String(1000), default="")
    avatar_path: Mapped[str | None] = mapped_column(String(300))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    nationality: Mapped[str] = mapped_column(String(120), default="")
    occupation: Mapped[str] = mapped_column(String(200), default="")
    address: Mapped[str] = mapped_column(String(500), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    reliability: Mapped[int] = mapped_column(Integer, default=3)
    sensitivity: Mapped[str] = mapped_column(String(20), default="confidential")
    created_at: Mapped[datetime] = mapped_column(func.now())
    updated_at: Mapped[datetime] = mapped_column(func.now(), onupdate=func.now())

    phones: Mapped[list["Phone"]] = relationship(back_populates="person", cascade="all, delete-orphan")
    emails: Mapped[list["Email"]] = relationship(back_populates="person", cascade="all, delete-orphan")
    socials: Mapped[list["Social"]] = relationship(back_populates="person", cascade="all, delete-orphan")
    notes: Mapped[list["Note"]] = relationship(back_populates="person", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]] = relationship(back_populates="person", cascade="all, delete-orphan")


class Phone(Base):
    __tablename__ = "phones"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("persons.id", ondelete="CASCADE"), index=True)
    number: Mapped[str] = mapped_column(String(30), index=True)
    label: Mapped[str] = mapped_column(String(20), default="personal")
    whatsapp: Mapped[bool] = mapped_column(Boolean, default=False)
    signal: Mapped[bool] = mapped_column(Boolean, default=False)
    telegram: Mapped[bool] = mapped_column(Boolean, default=False)
    carrier_notes: Mapped[str] = mapped_column(String(500), default="")
    person: Mapped[Person] = relationship(back_populates="phones")


class Email(Base):
    __tablename__ = "emails"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("persons.id", ondelete="CASCADE"), index=True)
    address: Mapped[str] = mapped_column(String(200), index=True)
    type: Mapped[str] = mapped_column(String(20), default="primary")
    pgp_public_key: Mapped[str] = mapped_column(Text, default="")
    person: Mapped[Person] = relationship(back_populates="emails")


class Social(Base):
    __tablename__ = "socials"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("persons.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str] = mapped_column(String(100))
    handle: Mapped[str] = mapped_column(String(200), index=True)
    profile_url: Mapped[str] = mapped_column(String(600), default="")
    person: Mapped[Person] = relationship(back_populates="socials")


class Note(Base):
    __tablename__ = "notes"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("persons.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(250))
    content: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(30), default="meeting")
    event_date: Mapped[date | None] = mapped_column(Date, index=True)
    recorded_at: Mapped[datetime] = mapped_column(func.now())
    is_confidential: Mapped[bool] = mapped_column(Boolean, default=False)
    person: Mapped[Person] = relationship(back_populates="notes")


class Relationship(Base):
    __tablename__ = "relationships"
    __table_args__ = (UniqueConstraint("source_person_id", "target_person_id", "type"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_person_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("persons.id", ondelete="CASCADE"), index=True)
    target_person_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("persons.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(40), default="associate")
    confidence: Mapped[str] = mapped_column(String(20), default="suspected")
    context_notes: Mapped[str] = mapped_column(String(2000), default="")


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(30), default="person")
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    person_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("persons.id", ondelete="CASCADE"), index=True)
    stored_name: Mapped[str] = mapped_column(String(120), unique=True)
    original_name: Mapped[str] = mapped_column(String(300))
    mime_type: Mapped[str] = mapped_column(String(150))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    description: Mapped[str] = mapped_column(String(1000), default="")
    is_avatar: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(func.now())
    person: Mapped[Person | None] = relationship(back_populates="documents")


class SearchDoc(Base):
    __tablename__ = "search_docs"
    __table_args__ = (UniqueConstraint("entity_type", "entity_id"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(20))
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    person_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    title: Mapped[str] = mapped_column(String(400))
    subtitle: Mapped[str] = mapped_column(String(400), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    normalized: Mapped[str] = mapped_column(Text)
    weight: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(func.now())


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action: Mapped[str] = mapped_column(String(40))
    entity: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    summary: Mapped[str] = mapped_column(Text, default="")
    actor: Mapped[str] = mapped_column(String(120), default="local-analyst")
    created_at: Mapped[datetime] = mapped_column(func.now(), index=True)


engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterable[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ------------------------------------------------------------------ التطبيع العربي
_TASHKEEL = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")


def normalize_arabic(text: str) -> str:
    """توحيد أشكال الحروف العربية وإزالة التشكيل — أساس البحث والفهرسة."""
    out = (text or "").normalize("NFKC") if hasattr(text or "", "normalize") else (text or "")
    out = _TASHKEEL.sub("", out)
    table = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي"})
    out = out.translate(table)
    out = out.lower()
    out = re.sub(r"[^\w\u0600-\u06FF@._+-]+", " ", out, flags=re.UNICODE)
    return re.sub(r"\s+", " ", out).strip()


def levenshtein(a: str, b: str, cap: int = 3) -> int:
    if a == b:
        return 0
    if abs(len(a) - len(b)) > cap:
        return cap + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


# ------------------------------------------------------------------ مخططات Pydantic
class PhoneIn(BaseModel):
    number: str = Field(min_length=5, max_length=30)
    label: Literal["personal", "work", "burner"] = "personal"
    whatsapp: bool = False
    signal: bool = False
    telegram: bool = False
    carrier_notes: str = ""

    @field_validator("number")
    @classmethod
    def e164(cls, v: str) -> str:
        v = re.sub(r"[^\d+]", "", v)
        if v.startswith("00"):
            v = "+" + v[2:]
        if re.fullmatch(r"\d{8,15}", v):
            v = "+" + v
        if not re.fullmatch(r"\+[1-9]\d{7,14}", v):
            raise ValueError("رقم الهاتف يجب أن يكون بصيغة E.164 مثل +966512345678")
        return v


class EmailIn(BaseModel):
    address: EmailStr
    type: Literal["primary", "leaked", "secure"] = "primary"
    pgp_public_key: str = ""


class SocialIn(BaseModel):
    platform: str = Field(min_length=1, max_length=100)
    handle: str = Field(min_length=1, max_length=200)
    profile_url: str = ""

    @field_validator("profile_url")
    @classmethod
    def http_only(cls, v: str) -> str:
        return v if v == "" or v.startswith(("http://", "https://")) else ""


class NoteIn(BaseModel):
    title: str = Field(min_length=2, max_length=250)
    content: str = ""
    category: Literal["meeting", "financial", "background", "leak"] = "meeting"
    event_date: date | None = None
    is_confidential: bool = False


class PersonIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    aliases: str = ""
    date_of_birth: date | None = None
    nationality: str = ""
    occupation: str = ""
    address: str = ""
    summary: str = ""
    reliability: int = Field(default=3, ge=1, le=5)
    sensitivity: Literal["public", "confidential", "top_secret"] = "confidential"
    phones: list[PhoneIn] = []
    emails: list[EmailIn] = []
    socials: list[SocialIn] = []
    notes: list[NoteIn] = []


class PersonPatch(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    aliases: str | None = None
    nationality: str | None = None
    occupation: str | None = None
    address: str | None = None
    summary: str | None = None
    date_of_birth: date | None = None
    reliability: int | None = Field(default=None, ge=1, le=5)
    sensitivity: Literal["public", "confidential", "top_secret"] | None = None


class RelationshipIn(BaseModel):
    person_id: uuid.UUID
    target_person_id: uuid.UUID
    type: Literal[
        "lawyer", "business_partner", "relative", "accomplice", "adversary", "whistleblower", "associate"
    ] = "associate"
    confidence: Literal["confirmed", "suspected"] = "suspected"
    context_notes: str = ""


# ------------------------------------------------------------------ فهرس البحث
def reindex_person(db: Session, person_id: uuid.UUID) -> int:
    """خط أنابيب Write-through: إعادة بناء مستندات الفهرس لملف واحد."""
    person = db.get(Person, person_id)
    if person is None:
        return 0
    db.execute(delete(SearchDoc).where(SearchDoc.person_id == person_id))

    rows = [
        SearchDoc(
            entity_type="person", entity_id=person.id, person_id=person.id,
            title=person.full_name,
            subtitle=" • ".join(filter(None, [person.occupation, person.nationality])),
            body="\n".join(filter(None, [person.aliases, person.summary, person.address])),
            normalized=normalize_arabic(
                " ".join(filter(None, [person.full_name, person.aliases, person.occupation, person.summary]))
            ),
            weight=10,
        )
    ]
    for p in person.phones:
        rows.append(SearchDoc(entity_type="phone", entity_id=p.id, person_id=person_id, title=p.number,
                              subtitle=person.full_name, body=p.carrier_notes,
                              normalized=normalize_arabic(f"{p.number} {p.carrier_notes}"), weight=6))
    for e in person.emails:
        rows.append(SearchDoc(entity_type="email", entity_id=e.id, person_id=person_id, title=e.address,
                              subtitle=person.full_name, body=e.pgp_public_key[:400],
                              normalized=normalize_arabic(e.address), weight=6))
    for s in person.socials:
        rows.append(SearchDoc(entity_type="social", entity_id=s.id, person_id=person_id,
                              title=f"{s.platform}: {s.handle}", subtitle=person.full_name, body=s.profile_url,
                              normalized=normalize_arabic(f"{s.platform} {s.handle} {s.profile_url}"), weight=4))
    for n in person.notes:
        rows.append(SearchDoc(entity_type="note", entity_id=n.id, person_id=person_id, title=n.title,
                              subtitle=person.full_name, body=n.content[:4000],
                              normalized=normalize_arabic(f"{n.title} {n.content}"), weight=5))
    for d in person.documents:
        rows.append(SearchDoc(entity_type="document", entity_id=d.id, person_id=person_id,
                              title=d.original_name, subtitle=person.full_name,
                              body=f"{d.description} {d.mime_type} {d.sha256}",
                              normalized=normalize_arabic(f"{d.original_name} {d.description}"), weight=4))
    db.add_all(rows)
    db.commit()
    return len(rows)


def sync_meilisearch(db: Session) -> dict[str, Any]:
    if not MEILI_HOST:
        return {"ok": False, "detail": "MEILISEARCH_HOST غير مضبوط"}
    docs = db.scalars(select(SearchDoc).limit(50000)).all()
    payload = [
        {"id": str(d.id), "entityType": d.entity_type, "entityId": str(d.entity_id),
         "personId": str(d.person_id) if d.person_id else None, "title": d.title,
         "subtitle": d.subtitle, "body": d.body, "normalized": d.normalized, "weight": d.weight}
        for d in docs
    ]
    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.post(
                f"{MEILI_HOST}/indexes/{MEILI_INDEX}/documents",
                json=payload,
                headers={"Authorization": f"Bearer {MEILI_KEY}"} if MEILI_KEY else {},
            )
        return {"ok": res.is_success, "detail": str(res.status_code)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": str(exc)}


def search_all(db: Session, query: str, limit: int = 20) -> dict[str, Any]:
    """بحث موحّد: Meilisearch عند توفّره، مع تراجع لطبقة PostgreSQL المطبَّعة."""
    tokens = [t for t in normalize_arabic(query).split() if len(t) > 1]
    if not tokens:
        return {"query": query, "engine": "postgres", "hits": []}

    rows: Sequence[SearchDoc] = []
    engine = "postgres"
    if MEILI_HOST:
        try:
            with httpx.Client(timeout=1.5) as client:
                res = client.post(
                    f"{MEILI_HOST}/indexes/{MEILI_INDEX}/search",
                    json={"q": " ".join(tokens), "limit": limit * 6},
                    headers={"Authorization": f"Bearer {MEILI_KEY}"} if MEILI_KEY else {},
                )
                res.raise_for_status()
                ids = [h["id"] for h in res.json().get("hits", [])]
                if ids:
                    rows = db.scalars(select(SearchDoc).where(SearchDoc.id.in_(ids))).all()
                    engine = "meilisearch"
        except Exception:  # noqa: BLE001
            engine = "postgres"

    if not rows:
        clauses = [SearchDoc.normalized.ilike(f"%{t}%") for t in tokens]
        rows = db.scalars(select(SearchDoc).where(*clauses).limit(500)).all() or db.scalars(
            select(SearchDoc).order_by(SearchDoc.weight.desc()).limit(1500)
        ).all()

    grouped: dict[uuid.UUID, dict[str, Any]] = {}
    for row in rows:
        words = row.normalized.split()
        score = 0.0
        for token in tokens:
            best = 0.0
            for word in words:
                if word == token:
                    best = 1.0
                elif word.startswith(token) and len(token) >= 4:
                    best = max(best, 0.85)
                elif token in word and len(token) >= 3:
                    best = max(best, 0.7)
                else:
                    allowed = 1 if len(token) <= 4 else (2 if len(token) <= 7 else 3)
                    if levenshtein(word, token, allowed) <= allowed:
                        best = max(best, 0.5)
                if best == 1.0:
                    break
            if best == 0.0:
                score = 0.0
                break
            score += best
        if score <= 0:
            continue
        entry = grouped.setdefault(
            row.person_id or row.entity_id,
            {"person_id": row.person_id, "score": 0.0, "hits": []},
        )
        entry["score"] += score * row.weight
        entry["hits"].append(
            {"entity_type": row.entity_type, "entity_id": str(row.entity_id),
             "title": row.title, "subtitle": row.subtitle, "score": round(score, 3)}
        )
    ordered = sorted(grouped.values(), key=lambda g: g["score"], reverse=True)[:limit]
    return {"query": query, "engine": engine, "hits": ordered}


# ------------------------------------------------------------------ رموز الوسائط
def sign_file_token(document_id: uuid.UUID, ttl_seconds: int = 900) -> str:
    exp = int((datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).timestamp())
    payload = f"{document_id}.{exp}".encode()
    return f"{exp}.{hmac.new(APP_SECRET, payload, hashlib.sha256).hexdigest()}"


def verify_file_token(document_id: uuid.UUID, token: str | None) -> bool:
    if not token or "." not in token:
        return False
    exp_raw, signature = token.split(".", 1)
    if not exp_raw.isdigit() or int(exp_raw) < int(datetime.now(timezone.utc).timestamp()):
        return False
    expected = hmac.new(APP_SECRET, f"{document_id}.{exp_raw}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)


ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".pdf", ".txt", ".md", ".csv", ".json",
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".mp3", ".wav", ".ogg",
    ".mp4", ".webm", ".zip",
}


def sanitize_original_name(raw: str) -> str:
    base = os.path.basename(raw or "file")
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).replace(" ", "_")
    return base[:140] or "file"


def resolve_media_path(stored_name: str) -> Path:
    """حماية صارمة من Path Traversal: اسم UUID فقط، وداخل MEDIA_DIR فقط."""
    if not re.fullmatch(r"[a-f0-9\-]{36}(\.[a-z0-9]{1,8})?", stored_name or "", re.IGNORECASE):
        raise HTTPException(status_code=400, detail="اسم ملف غير صالح")
    candidate = (MEDIA_DIR / stored_name).resolve()
    if MEDIA_DIR.resolve() not in candidate.parents:
        raise HTTPException(status_code=400, detail="مسار غير مسموح")
    return candidate


# ------------------------------------------------------------------ التطبيق
app =FastAPI(title="I.C.I.M.S — Investigative Contact & Intelligence Management", version="1.0.0")
templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))


@app.get("/api/health")
def health(db: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        db.execute(select(1))
        db_status = "متصل"
        ok = True
    except Exception as exc:  # noqa: BLE001
        db_status, ok = str(exc), False
    return {"ok": ok, "service": "icims-fastapi", "mode": "air-gapped",
            "checks": {"database": db_status, "storage": str(MEDIA_DIR), "meilisearch": MEILI_HOST or "معطّل"}}


@app.get("/api/persons", response_class=JSONResponse)
def list_persons(q: str | None = None, sensitivity: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Person).order_by(Person.updated_at.desc()).limit(200)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            Person.full_name.ilike(like) | Person.aliases.ilike(like) | Person.occupation.ilike(like)
        )
    if sensitivity:
        stmt = stmt.where(Person.sensitivity == sensitivity)
    people = db.scalars(stmt).unique().all()
    return [{"id": str(p.id), "full_name": p.full_name, "aliases": p.aliases,
             "sensitivity": p.sensitivity, "reliability": p.reliability,
             "counts": {"phones": len(p.phones), "emails": len(p.emails),
                        "notes": len(p.notes), "documents": len(p.documents)}} for p in people]


@app.post("/api/persons", status_code=201)
def create_person(payload: PersonIn, db: Session = Depends(get_db)):
    person = Person(
        full_name=payload.full_name, aliases=payload.aliases, date_of_birth=payload.date_of_birth,
        nationality=payload.nationality, occupation=payload.occupation, address=payload.address,
        summary=payload.summary, reliability=payload.reliability, sensitivity=payload.sensitivity,
    )
    person.phones = [Phone(**p.model_dump()) for p in payload.phones]
    person.emails = [Email(address=e.address, type=e.type, pgp_public_key=e.pgp_public_key)
                     for e in payload.emails]
    person.socials = [Social(**s.model_dump()) for s in payload.socials]
    person.notes = [Note(**n.model_dump()) for n in payload.notes]
    db.add(person)
    db.commit()
    db.refresh(person)
    reindex_person(db, person.id)
    db.add(AuditLog(action="create", entity="person", entity_id=person.id, summary=person.full_name))
    db.commit()
    return {"ok": True, "id": str(person.id)}


@app.get("/api/persons/{person_id}")
def read_person(person_id: uuid.UUID,
                profile: Literal["full", "no_confidential", "no_media", "minimal"] = "full",
                db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    exclude_confidential = profile in ("no_confidential", "minimal")
    exclude_media = profile in ("no_media", "minimal")
    notes = [n for n in person.notes if not (exclude_confidential and n.is_confidential)]
    return {
        "profile": profile,
        "person": {"id": str(person.id), "full_name": person.full_name, "aliases": person.aliases,
                   "sensitivity": person.sensitivity, "reliability": person.reliability,
                   "summary": person.summary, "nationality": person.nationality,
                   "occupation": person.occupation, "address": person.address,
                   "date_of_birth": person.date_of_birth.isoformat() if person.date_of_birth else None},
        "phones": [{"id": str(p.id), "number": p.number, "label": p.label,
                    "whatsapp": p.whatsapp, "signal": p.signal, "telegram": p.telegram,
                    "carrier_notes": p.carrier_notes} for p in person.phones],
        "emails": [{"id": str(e.id), "address": e.address, "type": e.type,
                    "pgp": bool(e.pgp_public_key)} for e in person.emails],
        "socials": [{"id": str(s.id), "platform": s.platform, "handle": s.handle,
                     "profile_url": s.profile_url} for s in person.socials],
        "notes": [{"id": str(n.id), "title": n.title, "content": n.content, "category": n.category,
                   "event_date": n.event_date.isoformat() if n.event_date else None,
                   "recorded_at": n.recorded_at.isoformat(),
                   "is_confidential": n.is_confidential} for n in notes],
        "documents": [] if exclude_media else [
            {"id": str(d.id), "original_name": d.original_name, "mime_type": d.mime_type,
             "size_bytes": d.size_bytes, "sha256": d.sha256,
             "token": sign_file_token(d.id)} for d in person.documents],
    }


@app.patch("/api/persons/{person_id}")
def patch_person(person_id: uuid.UUID, payload: PersonPatch, db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(person, key, value)
    db.commit()
    reindex_person(db, person.id)
    return {"ok": True}


@app.delete("/api/persons/{person_id}")
def delete_person(person_id: uuid.UUID, db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    db.delete(person)
    db.execute(delete(SearchDoc).where(SearchDoc.person_id == person_id))
    db.add(AuditLog(action="delete", entity="person", entity_id=person_id, summary=person.full_name))
    db.commit()
    return {"ok": True}


@app.post("/api/relationships", status_code=201)
def create_relationship(payload: RelationshipIn, db: Session = Depends(get_db)):
    if payload.person_id == payload.target_person_id:
        raise HTTPException(status_code=400, detail="لا يمكن ربط الشخص بنفسه")
    if db.get(Person, payload.person_id) is None or db.get(Person, payload.target_person_id) is None:
        raise HTTPException(status_code=404, detail="أحد الطرفين غير موجود")
    rel = Relationship(**payload.model_dump())
    db.add(rel)
    db.commit()
    return {"ok": True, "id": str(rel.id)}


@app.post("/api/documents", status_code=201)
async def upload_documents(
    person_id: uuid.UUID = Form(...),
    description: str = Form(""),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="الشخص غير موجود")
    created, skipped = [], []
    for upload in files[:25]:
        original = sanitize_original_name(upload.filename or "file")
        ext = Path(original).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS or upload.size or 0 > MAX_FILE_BYTES:
            skipped.append({"name": original, "reason": "نوع/حجم غير مسموح"})
            continue
        payload_bytes = await upload.read()
        digest = hashlib.sha256(payload_bytes).hexdigest()
        stored_name = f"{uuid.uuid4()}{ext}"
        path = resolve_media_path(stored_name)
        path.write_bytes(payload_bytes)
        path.chmod(0o640)
        doc = Document(
            entity_type="person", entity_id=person_id, person_id=person_id, stored_name=stored_name,
            original_name=original, mime_type=upload.content_type or "application/octet-stream",
            size_bytes=len(payload_bytes), sha256=digest, description=description,
        )
        db.add(doc)
        created.append({"original_name": original, "sha256": digest, "size_bytes": len(payload_bytes)})
    db.commit()
    reindex_person(db, person_id)
    return {"ok": True, "created": created, "skipped": skipped}


@app.get("/api/documents/{document_id}/file")
def stream_document(document_id: uuid.UUID, token: str | None = None, download: bool = False,
                    db: Session = Depends(get_db)):
    if not verify_file_token(document_id, token):
        raise HTTPException(status_code=401, detail="رمز الوصول غير صالح أو منتهي")
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="المستند غير موجود")
    path = resolve_media_path(doc.stored_name)
    if not path.is_file():
        raise HTTPException(status_code=410, detail="الملف غير موجود على القرص")
    return FileResponse(
        path, media_type=doc.mime_type,
        filename=doc.original_name if download else None,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@app.get("/api/search")
def search(q: str = Query(min_length=1), limit: int = 20, db: Session = Depends(get_db)):
    return search_all(db, q, limit)


@app.post("/api/search/reindex")
def reindex(db: Session = Depends(get_db)):
    people = db.scalars(select(Person.id)).all()
    total = 0
    for person_id in people:
        total += reindex_person(db, person_id)
    return {"ok": True, "persons": len(people), "documents": total, "meilisearch": sync_meilisearch(db)}


@app.get("/api/dossier/{person_id}", response_class=HTMLResponse)
def dossier_html(
    request: Request,
    person_id: uuid.UUID,
    profile: Literal["full", "no_confidential", "no_media", "minimal"] = "full",
    db: Session = Depends(get_db),
):
    payload = read_person(person_id, profile, db)
    return templates.TemplateResponse(request=request, name="dossier.html", context={"d": payload})


@app.get("/api/dossier/{person_id}.pdf", response_class=Response)
def dossier_pdf(
    person_id: uuid.UUID,
    profile: Literal["full", "no_confidential", "no_media", "minimal"] = "full",
    db: Session = Depends(get_db),
):
    """تحويل الملف الجنائي إلى PDF عبر WeasyPrint (بدون أي اتصال خارجي)."""
    try:
        from weasyprint import HTML  # noqa: PLC0415
    except ImportError as exc:  # noqa: PERF203
        raise HTTPException(status_code=501, detail="WeasyPrint غير مثبّت في هذه الحاوية") from exc
    html = dossier_html(Request({"type": "http", "method": "GET", "path": "/"}), person_id, profile, db)
    pdf = HTML(string=html.body.decode("utf-8")).write_pdf()
    return Response(
        pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="dossier-{person_id}.pdf"'},
    )


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
