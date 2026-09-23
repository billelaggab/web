/**
 * تحقق صارم من المدخلات (نظير Pydantic في FastAPI) — يرفض أي حقل غير صحيح قبل الوصول لقاعدة البيانات.
 */
import { normalizeArabic } from "@/lib/arabic";

export class HttpError extends Error {
  status: number;
  details?: Record<string, string>;
  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function badRequest(message: string, details?: Record<string, string>): never {
  throw new HttpError(400, message, details);
}

export function notFound(message = "السجل غير موجود"): never {
  throw new HttpError(404, message);
}

export function jsonBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    badRequest("جسم الطلب يجب أن يكون كائن JSON صحيحاً");
  }
  return value as Record<string, unknown>;
}

export function optString(value: unknown, field: string, max = 4000): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") badRequest(`الحقل ${field} يجب أن يكون نصاً`, { [field]: "نص مطلوب" });
  const trimmed = value.trim();
  if (trimmed.length > max) {
    badRequest(`الحقل ${field} يتجاوز الطول المسموح (${max})`, { [field]: `الحد الأقصى ${max}` });
  }
  return trimmed;
}

export function reqString(value: unknown, field: string, min = 1, max = 4000): string {
  const out = optString(value, field, max);
  if (out === undefined || out.length < min) {
    badRequest(`الحقل ${field} مطلوب`, { [field]: "قيمة غير صالحة" });
  }
  return out;
}

export function optBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return undefined;
}

export function optInt(value: unknown, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    badRequest(`القيمة يجب أن تكون رقماً صحيحاً بين ${min} و ${max}`);
  }
  return n;
}

export function optOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    badRequest(`القيمة في ${field} غير مسموحة`, { [field]: allowed.join(" | ") });
  }
  return value as T;
}

export function optUuid(value: unknown, field: string): string | undefined {
  const s = optString(value, field, 64);
  if (s === undefined) return undefined;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    badRequest(`المعرّف في ${field} غير صالح`);
  }
  return s.toLowerCase();
}

export function reqUuid(value: unknown, field: string): string {
  const out = optUuid(value, field);
  if (!out) badRequest(`المعرّف في ${field} مطلوب`);
  return out;
}

export function optDate(value: unknown, field: string): string | undefined {
  const s = optString(value, field, 40);
  if (s === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    badRequest(`التاريخ في ${field} يجب أن يكون بصيغة YYYY-MM-DD`, { [field]: "YYYY-MM-DD" });
  }
  return s;
}

export function optArray(value: unknown, field: string, max = 200): unknown[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) badRequest(`الحقل ${field} يجب أن يكون مصفوفة`);
  if (value.length > max) badRequest(`عدد العناصر في ${field} يتجاوز الحد (${max})`);
  return value;
}

/** تحويل الأرقام العربية-الهندية وإزالة الفواصل ثم التحقق من صيغة E.164 */
export function toE164(raw: string): string {
  const normalized = normalizeArabic(raw).replace(/[^\d+]/g, "");
  let candidate = normalized;
  if (candidate.startsWith("00")) candidate = `+${candidate.slice(2)}`;
  if (/^\d{8,15}$/.test(candidate)) candidate = `+${candidate}`;
  if (!/^\+[1-9]\d{7,14}$/.test(candidate)) {
    badRequest("رقم الهاتف يجب أن يكون بصيغة E.164 مثل +966512345678", { number: "E.164" });
  }
  return candidate;
}

export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function normalizeEmail(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!isEmailLike(value)) {
    badRequest("البريد الإلكتروني غير صالح", { address: "مثال: name@example.com" });
  }
  return value;
}

export function sanitizeUrl(raw: string | undefined): string {
  if (!raw) return "";
  const value = raw.trim();
  if (!value) return "";
  if (/^(https?:\/\/|mailto:)/i.test(value)) return value;
  return "";
}

/** استجابة خطأ موحّدة */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(
      { ok: false, error: error.message, details: error.details ?? null },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : "خطأ غير متوقع";
  return Response.json({ ok: false, error: message }, { status: 500 });
}
