"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { highlightParts } from "@/lib/arabic";
import { SENSITIVITY_BADGES, SENSITIVITY_LABELS, SEARCH_ENTITY_LABELS } from "@/lib/constants";
import type { SearchResponse } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/", label: "لوحة التحكم", icon: "bi-speedometer2" },
  { href: "/persons", label: "الملفات", icon: "bi-person-vcard" },
  { href: "/network", label: "شبكة العلاقات", icon: "bi-diagram-3" },
  { href: "/settings", label: "الإعدادات", icon: "bi-shield-lock" },
];

function Highlighted({ text, tokens }: { text: string; tokens: string[] }) {
  const parts = highlightParts(text, tokens);
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>,
      )}
    </>
  );
}

function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=8`,
          { signal: controller.signal },
        );
        const payload = (await res.json()) as SearchResponse;
        setResult(payload);
        setOpen(true);
      } catch {
        /* تجاهل الإلغاء */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const tokens = (result?.query ?? query).trim().split(/\s+/).filter((t) => t.length > 1);

  return (
    <div className="icims-search-wrap" ref={wrapRef}>
      <div className="input-group">
        <span className="input-group-text bg-white text-body-secondary border-0">
          <i className={`bi ${loading ? "bi-arrow-repeat spin" : "bi-search"}`} />
        </span>
        <input
          className="form-control border-0"
          placeholder="ابحث فوراً: اسم، رقم هاتف، بريد، حساب، محتوى ملاحظة، مستند…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => result && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && query.trim().length > 1) {
              setOpen(false);
              router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            }
          }}
          aria-label="البحث الموحّد"
        />
        {query && (
          <button
            className="btn btn-outline-secondary border-0"
            type="button"
            onClick={() => {
              setQuery("");
              setResult(null);
              setOpen(false);
            }}
            aria-label="مسح"
          >
            <i className="bi bi-x-lg" />
          </button>
        )}
      </div>

      {open && result && (
        <div className="icims-search-results bg-body border list-group">
          <div className="d-flex justify-content-between align-items-center px-3 py-2 small text-body-secondary bg-body-tertiary">
            <span>
              <i className="bi bi-lightning-charge-fill text-warning" /> {result.persons.length} ملف
              مطابق — {result.tookMs} مللي ثانية
            </span>
            <span>{result.engine === "meilisearch" ? "Meilisearch" : "فهرس محلي"}</span>
          </div>
          {result.persons.length === 0 && (
            <div className="px-3 py-3 text-body-secondary small">
              لا نتائج. البحث يتحمّل الأخطاء المطبعية ويوحّد أشكال الحروف العربية (أ/ا، ة/ه، ي/ى).
            </div>
          )}
          {result.persons.map((person) => (
            <Link
              key={person.personId}
              href={`/persons/${person.personId}`}
              className="icims-hit"
              onClick={() => setOpen(false)}
            >
              <div className="d-flex justify-content-between align-items-start gap-2">
                <strong className="text-body">
                  <Highlighted text={person.fullName} tokens={tokens} />
                </strong>
                <span className={`badge ${SENSITIVITY_BADGES[person.sensitivity]}`}>
                  {SENSITIVITY_LABELS[person.sensitivity]}
                </span>
              </div>
              <div className="small text-body-secondary">
                موثوقية {person.reliability}/5 — {person.hits.length} تطابق
              </div>
              <div className="mt-1 d-flex flex-column gap-1">
                {person.hits.slice(0, 3).map((hit) => (
                  <span key={hit.entityId} className="small text-body-secondary">
                    <i className="bi bi-chevron-left me-1" />
                    <span className="badge text-bg-light border me-1">
                      {SEARCH_ENTITY_LABELS[hit.entityType]}
                    </span>
                    <Highlighted text={hit.title} tokens={tokens} />
                  </span>
                ))}
              </div>
            </Link>
          ))}
          {query.trim().length > 1 && (
            <Link
              href={`/search?q=${encodeURIComponent(query.trim())}`}
              className="icims-hit text-center small fw-semibold"
              onClick={() => setOpen(false)}
            >
              عرض كل النتائج <i className="bi bi-arrow-left" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-bs-theme") as "dark" | "light") || "dark";
    setTheme(current);
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-bs-theme", next);
    try {
      localStorage.setItem("icims-theme", next);
    } catch {
      /* تخزين غير متاح */
    }
  }, [theme]);

  return (
    <button className="btn btn-sm btn-outline-light" onClick={toggle} title="تبديل الوضع الليلي">
      <i className={`bi ${theme === "dark" ? "bi-moon-stars-fill" : "bi-sun-fill"}`} />
    </button>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isPrint = pathname?.includes("/dossier");

  return (
    <>
      {!isPrint && (
        <nav className="navbar navbar-expand-lg icims-navbar sticky-top py-2">
          <div className="container-fluid px-3 px-lg-4">
            <Link className="navbar-brand icims-brand d-flex align-items-center gap-2" href="/">
              <i className="bi bi-shield-fill-check fs-4" />
              <span className="d-none d-sm-inline">منظومة التحقيق</span>
            </Link>

            <button
              className="navbar-toggler border-0 text-white"
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="تبديل القائمة"
            >
              <i className="bi bi-list fs-3" />
            </button>

            <div className={`collapse navbar-collapse ${menuOpen ? "show" : ""}`}>
              <div className="d-flex flex-column flex-lg-row w-100 gap-3 align-items-lg-center mt-3 mt-lg-0">
                <div className="d-flex flex-column flex-lg-row gap-1">
                  {NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`icims-nav-link ${pathname === item.href ? "active" : ""}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      <i className={`bi ${item.icon} me-1`} />
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="flex-grow-1 d-flex justify-content-lg-end">
                  <SearchBar />
                </div>
                <Link className="btn btn-sm btn-warning fw-semibold" href="/persons/new">
                  <i className="bi bi-person-add me-1" />
                  ملف جديد
                </Link>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className={isPrint ? "py-3 px-2" : "container py-4"}>{children}</main>

      {!isPrint && (
        <footer className="border-top py-3 mt-4 small text-body-secondary">
          <div className="container d-flex flex-wrap justify-content-between gap-2">
            <span>
              <i className="bi bi-ethernet me-1" />
              نسخة محلية معزولة (Air-gap) — لا اتصال بأي خدمة خارجية.
            </span>
            <span>
              <i className="bi bi-lock-fill me-1" />
              كل الوسائط مخزّنة خارج المجلد العام وتُبث عبر رموز موقّعة مؤقتة.
            </span>
          </div>
        </footer>
      )}

      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
