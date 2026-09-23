/**
 * طبقة الأمان: تخزين الوسائط خارج المجلد العام + رموز وصول موقّعة (HMAC) + تعقيم أسماء الملفات.
 * الهدف: منع أي عملية من قراءة مسار التخزين مباشرة أو تنفيذ Path Traversal.
 */
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const SECRET =
  process.env.APP_SECRET ??
  process.env.MEDIA_SECRET ??
  "icims-airgap-default-secret-change-me";

export const MEDIA_DIR =
  process.env.MEDIA_DIR ?? path.join(process.cwd(), ".data", "uploads");

/** امتدادات مسموحة فقط (قائمة بيضاء) */
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp",
  ".pdf", ".txt", ".md", ".csv", ".json",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".odt", ".ods", ".mp3", ".wav", ".ogg", ".mp4", ".webm",
  ".zip",
]);

const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "text/", "audio/", "video/"];
const ALLOWED_MIME_EXACT = new Set([
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export async function ensureMediaDir(): Promise<string> {
  await fs.mkdir(MEDIA_DIR, { recursive: true, mode: 0o750 });
  return MEDIA_DIR;
}

/** تعقيم الاسم الأصلي: يُحفظ في قاعدة البيانات فقط ولا يُستخدم في مسار القرص أبداً */
export function sanitizeOriginalFilename(raw: string): string {
  const base = path.basename(raw ?? "file")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const safe = base.length > 0 ? base : "file";
  return safe.length > 140 ? safe.slice(safe.length - 140) : safe;
}

export function isAllowedExtension(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

export function isAllowedMime(mime: string): boolean {
  if (ALLOWED_MIME_EXACT.has(mime)) return true;
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

/** اسم التخزين النهائي: UUID عشوائي + امتداد منقّى */
export function buildStoredName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "");
  return `${randomUUID()}${ext}`;
}

const STORED_NAME_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(\.[a-z0-9]{1,8})?$/i;

/**
 * الحماية من Path Traversal: الاسم يجب أن يكون UUID صارم، والمسار الناتج يجب أن يبقى داخل MEDIA_DIR.
 */
export function resolveMediaPath(storedName: string): string | null {
  if (!storedName || !STORED_NAME_RE.test(storedName)) return null;
  const root = path.resolve(MEDIA_DIR);
  const target = path.resolve(root, storedName);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

export function sha256Buffer(buf: Buffer | Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

/* --------------------------- رموز الوصول الموقّعة (صلاحية زمنية) --------------------------- */

function hmac(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function signFileToken(documentId: string, ttlSeconds = 900): string {
  const exp = Date.now() + ttlSeconds * 1000;
  const payload = `${documentId}.${exp}`;
  return `${exp}.${hmac(payload)}`;
}

export function verifyFileToken(documentId: string, token: string | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = hmac(`${documentId}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
