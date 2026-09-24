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

/* ------------------------- ترجمة أخطاء PostgreSQL إلى عربية ------------------------- */

type PgErrorLike = { code?: string; message?: string };

/** يبحث في سلسلة الأسباب (cause chain) عن رمز خطأ PostgreSQL معروف */
function describeDatabaseError(error: unknown): { message: string; status: number } | null {
  const chain: unknown[] = [];
  let current: unknown = error;
  while (current && typeof current === "object" && chain.length < 6) {
    chain.push(current);
    const cause = (current as { cause?: unknown }).cause;
    if (cause && typeof cause === "object") current = cause;
    else break;
  }

  for (const item of chain) {
    if (!item || typeof item !== "object") continue;
    const code = (item as PgErrorLike).code;
    const message = (item as PgErrorLike).message ?? "";

    switch (code) {
      case "42P01":
      case "42703":
        return {
          message:
            "الجدول أو العمود غير موجود في قاعدة البيانات. جارٍ إنشاء المخطط تلقائياً — أعد المحاولة بعد لحظات.",
          status: 503,
        };
      case "ECONNREFUSED":
      case "ETIMEDOUT":
      case "EAI_AGAIN":
        return {
          message:
            "تعذّر الاتصال بخادم PostgreSQL. تأكد أن الحاوية/الخدمة تعمل وأن DATABASE_URL صحيح.",
          status: 503,
        };
      case "28P01":
        return { message: "فشلت مصادقة PostgreSQL (اسم مستخدم أو كلمة مرور غير صحيحة).", status: 503 };
      case "3D000":
        return { message: "قاعدة البيانات المحدّدة في DATABASE_URL غير موجودة.", status: 503 };
      case "53300":
        return { message: "تجاوز الحد الأقصى لاتصالات قاعدة البيانات. أعد المحاولة بعد لحظات.", status: 503 };
      case "23505":
        return { message: "سجل مكرر: توجد قيمة فريدة مطابقة مسبقاً.", status: 409 };
      case "23503":
        return { message: "مرجع غير صالح: السجل المرتبط غير موجود أو حُذف.", status: 409 };
      case "23502":
        return { message: "حقل إلزامي ناقص في السجل.", status: 400 };
      case "22P02":
        return { message: "قيمة غير صالحة لصيغة الحقل (معرّف UUID أو رقم أو تاريخ).", status: 400 };
      case "22007":
      case "22008":
        return { message: "صيغة التاريخ غير صالحة (المتوقع YYYY-MM-DD).", status: 400 };
      case "22001":
        return { message: "قيمة أطول من الحد المسموح للحقل.", status: 400 };
      case "57014":
        return { message: "انتهت مهلة الاستعلام في قاعدة البيانات.", status: 504 };
    }

    if (/relation "[^"]+" does not exist/i.test(message)) {
      return {
        message:
          "الجدول غير موجود في قاعدة البيانات. جارٍ إنشاء المخطط تلقائياً — أعد المحاولة بعد لحظات.",
        status: 503,
      };
    }
    if (/ECONNREFUSED|connection terminated unexpectedly|too many clients/i.test(message)) {
      return { message: "تعذّر الاتصال بقاعدة البيانات أو اكتظاظ الاتصالات.", status: 503 };
    }
  }
  return null;
}

/** استجابة خطأ موحّدة (رسالة عربية واضحة + النص الأصلي للتشخيص) */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(
      { ok: false, error: error.message, details: error.details ?? null },
      { status: error.status },
    );
  }

  const raw = error instanceof Error ? error.message : "خطأ غير متوقع";
  const described = describeDatabaseError(error);
  if (described) {
    return Response.json(
      { ok: false, error: described.message, raw, kind: "database" },
      { status: described.status },
    );
  }
  return Response.json({ ok: false, error: raw, kind: "unexpected" }, { status: 500 });
}
