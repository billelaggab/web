/**
 * محرّك التطبيع العربي + المطابقة الضبابية (تحمّل الأخطاء المطبعية).
 * يعمل بالكامل بدون أي اتصال خارجي، ويُستخدم في البحث الموحّد وفي فهرسة Meilisearch.
 */

/** الحركات والتشكيل والتطويل */
const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

/**
 * تطبيع النص العربي:
 *  - إزالة التشكيل والتطويل
 *  - توحيد (أ/إ/آ/ٱ) -> ا ، (ة) -> ه ، (ى) -> ي ، (ؤ) -> و ، (ئ) -> ي
 *  - توحيد الأرقام العربية-الهندية إلى اللاتينية
 *  - إزالة علامات الترقيم مع الحفاظ على @ . + - _ لصالح البريد وأرقام الهاتف
 */
export function normalizeArabic(input: string): string {
  if (!input) return "";
  const base = input
    .normalize("NFKC")
    .replace(TASHKEEL, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627") // آ إ أ ٱ -> ا
    .replace(/\u0629/g, "\u0647") // ة -> ه
    .replace(/\u0649/g, "\u064A") // ى -> ي
    .replace(/\u0624/g, "\u0648") // ؤ -> و
    .replace(/\u0626/g, "\u064A") // ئ -> ي
    .replace(/[\u06A9]/g, "\u0643") // ک -> ك
    .replace(/[\u06AF]/g, "\u0643") // گ -> ك
    .replace(/[\u06CC]/g, "\u064A"); // ی -> ي

  return base
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/[^0-9a-z\u0600-\u06FF@._+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** تقطيع الاستعلام إلى كلمات دالّة (تجاهل كلمات الوقف القصيرة) */
const STOP_WORDS = new Set([
  "في",
  "من",
  "على",
  "الى",
  "عن",
  "مع",
  "هذا",
  "هذه",
  "الذي",
  "التي",
  "and",
  "the",
  "of",
]);

export function tokenize(input: string): string[] {
  return normalizeArabic(input)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** مسافة ليفنشتاين مع حد أقصى لتقليل الكلفة الحسابية */
export function levenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let best = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < best) best = curr[j];
    }
    if (best > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** هل الكلمة مطابقة (تامة أو بتشابه كافٍ لتحمّل خطأ مطبعي)؟ */
export function fuzzyMatch(word: string, token: string): number {
  const w = normalizeArabic(word);
  if (!w) return 0;
  if (w === token) return 1;
  if (token.length >= 4 && w.startsWith(token)) return 0.85;
  if (w.includes(token) && token.length >= 3) return 0.7;
  const allowed = token.length <= 4 ? 1 : token.length <= 7 ? 2 : 3;
  const dist = levenshtein(w, token, allowed);
  if (dist <= allowed) return Math.max(0.35, 1 - dist / (token.length + 1));
  return 0;
}

export type HighlightPart = { text: string; hit: boolean };

/** تظليل الكلمات المطابقة داخل نص أصلي (يُستخدم في نتائج البحث) */
export function highlightParts(text: string, tokens: string[]): HighlightPart[] {
  if (!text) return [];
  const chunks = text.split(/(\s+)/);
  const out: HighlightPart[] = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
    if (/^\s+$/.test(chunk)) {
      out.push({ text: chunk, hit: false });
      continue;
    }
    const bare = chunk.replace(/^[^\p{L}\p{N}@._+-]+|[^\p{L}\p{N}@._+-]+$/gu, "");
    if (bare && tokens.some((t) => fuzzyMatch(bare, t) > 0)) {
      const start = chunk.indexOf(bare);
      const end = start + bare.length;
      if (start > 0) out.push({ text: chunk.slice(0, start), hit: false });
      out.push({ text: bare, hit: true });
      if (end < chunk.length) out.push({ text: chunk.slice(end), hit: false });
    } else {
      out.push({ text: chunk, hit: false });
    }
  }
  return out;
}

/** مقتطف قصير حول أول تطابق */
export function snippet(text: string, tokens: string[], len = 160): string {
  if (!text) return "";
  if (text.length <= len) return text;
  const idx = tokens
    .map((t) => normalizeArabic(text).indexOf(t))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0];
  const start = idx && idx > 40 ? idx - 40 : 0;
  return `${start > 0 ? "…" : ""}${text.slice(start, start + len)}…`;
}
