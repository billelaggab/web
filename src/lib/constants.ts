/** قواميس التسميات العربية المستخدمة في الواجهة والتقارير — بدون أي مصدر خارجي */

export const APP_NAME = "منظومة التحقيق";
export const APP_SHORT = "I.C.I.M.S";
export const CLASSIFICATION_WATERMARK = "سري — ملف تحقيقي";

export const SENSITIVITY_LABELS = {
  public: "عام",
  confidential: "سري",
  top_secret: "سري للغاية",
} as const;

export const SENSITIVITY_BADGES = {
  public: "text-bg-success",
  confidential: "text-bg-warning",
  top_secret: "text-bg-danger",
} as const;

export const SENSITIVITY_ORDER = { public: 1, confidential: 2, top_secret: 3 } as const;

export const PHONE_LABELS = {
  personal: "شخصي",
  work: "عمل",
  burner: "رقم مؤقت (Burner)",
} as const;

export const EMAIL_TYPE_LABELS = {
  primary: "أساسي",
  leaked: "مُسرَّب",
  secure: "آمن (Proton/PGP)",
} as const;

export const NOTE_CATEGORY_LABELS = {
  meeting: "محضر اجتماع",
  financial: "مسار مالي",
  background: "تحقق خلفي",
  leak: "تسريب من مصدر",
} as const;

export const NOTE_CATEGORY_ICONS = {
  meeting: "bi-people-fill",
  financial: "bi-cash-coin",
  background: "bi-person-vcard-fill",
  leak: "bi-droplet-half",
} as const;

export const RELATIONSHIP_LABELS = {
  lawyer: "محامٍ",
  business_partner: "شريك تجاري",
  relative: "قريب / نسَب",
  accomplice: "شريك في فعل",
  adversary: "خصم / طرف مقابل",
  whistleblower: "مُبلِّغ عن فساد",
  associate: "معرفة / ارتباط",
} as const;

export const CONFIDENCE_LABELS = {
  confirmed: "مؤكَّدة",
  suspected: "مشتبه بها",
} as const;

export const SEARCH_ENTITY_LABELS = {
  person: "ملف شخص",
  phone: "رقم هاتف",
  email: "بريد إلكتروني",
  social: "حساب تواصل",
  note: "ملاحظة استخبارية",
  document: "مستند/وسيط",
} as const;

export const RELIABILITY_HINTS = [
  "غير موثوق (١)",
  "ضعيف (٢)",
  "متوسط (٣)",
  "جيد (٤)",
  "عالي الموثوقية (٥)",
];

export const DOSSIER_PROFILES = {
  full: { label: "الملف الكامل", excludeConfidential: false, excludeMedia: false },
  no_confidential: {
    label: "باستثناء الاستخبارات السرية",
    excludeConfidential: true,
    excludeMedia: false,
  },
  no_media: {
    label: "باستثناء الوسائط",
    excludeConfidential: false,
    excludeMedia: true,
  },
  minimal: {
    label: "ملف مُعقَّم (بدون سرية وبدون وسائط)",
    excludeConfidential: true,
    excludeMedia: true,
  },
} as const;

export type DossierProfileKey = keyof typeof DOSSIER_PROFILES;

export const PLATFORM_OPTIONS = [
  "X (تويتر)",
  "فيسبوك",
  "تيليجرام",
  "إنستغرام",
  "لينكدإن",
  "واتساب",
  "سيجنال",
  "يوتيوب",
  "تيك توك",
  "منتدى/موقع آخر",
];

export const NATIONALITY_OPTIONS = [
  "مصري",
  "سعودي",
  "إماراتي",
  "قطري",
  "أردني",
  "لبناني",
  "سوري",
  "عراقي",
  "مغربي",
  "تونسي",
  "جزائري",
  "سوداني",
  "ليبي",
  "كويتي",
  "عُماني",
  "بحريني",
  "يمني",
  "فلسطيني",
  "بريطاني",
  "أمريكي",
  "فرنسي",
  "ألماني",
  "تركي",
  "روسي",
  "صيني",
  "إيراني",
  "أخرى",
];
