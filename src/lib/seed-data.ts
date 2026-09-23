/**
 * بيانات تجريبية (أسماء وشبكة علاقات وملاحظات) لتشغيل النظام واختبار البحث والتصدير.
 * كل الأسماء والأحداث خيالية بالكامل ولا تشير إلى أشخاص حقيقيين.
 */
import { db } from "@/db";
import {
  emails,
  notes,
  persons,
  phones,
  relationships,
  socials,
  type EmailType,
  type NoteCategory,
  type PhoneLabel,
  type RelationshipType,
  type Sensitivity,
} from "@/db/schema";
import { countPersons, logAudit } from "@/db/queries";
import { reindexAll } from "@/lib/search";
import { normalizeEmail, toE164 } from "@/lib/validate";

type PersonSeed = {
  fullName: string;
  aliases: string;
  dateOfBirth: string | null;
  nationality: string;
  occupation: string;
  address: string;
  summary: string;
  reliability: number;
  sensitivity: Sensitivity;
  phones: {
    number: string;
    label: PhoneLabel;
    whatsapp?: boolean;
    signal?: boolean;
    telegram?: boolean;
    carrierNotes?: string;
  }[];
  emails: { address: string; type: EmailType; pgpPublicKey?: string }[];
  socials: { platform: string; handle: string; profileUrl?: string }[];
  notes: {
    title: string;
    content: string;
    category: NoteCategory;
    eventDate: string | null;
    isConfidential?: boolean;
  }[];
};

const SEED: PersonSeed[] = [
  {
    fullName: "أحمد سليم الحارثي",
    aliases: "أبو سليم, الصقر, A.H",
    dateOfBirth: "1978-04-12",
    nationality: "سعودي",
    occupation: "رجل أعمال — مقاولات وتجارة مواد بناء",
    address: "الرياض — حي الملقا — مجمع تجاري رقم 14",
    summary:
      "**الخلاصة الاستقصائية:** شخصية محورية في شبكة وسطاء عقود حكومية. تظهر اسمه في ثلاث شركات وسيطة تتقاطع ملكيتها مع أقارب مباشرين.\n\n- يتنقل بين ثلاث دول خلال الشهر\n- يستخدم أرقاماً مؤقتة للتواصل مع الموردين\n- لا توجد أصول مسجلة باسمه مباشرة",
    reliability: 4,
    sensitivity: "top_secret",
    phones: [
      {
        number: "+966501234567",
        label: "personal",
        whatsapp: true,
        carrierNotes: "شريحة مسبقة الدفع تُجدَّد كل 60 يوماً",
      },
      { number: "+966598765432", label: "work", whatsapp: true, telegram: true },
      { number: "+971551112233", label: "burner", signal: true, carrierNotes: "رقم إماراتي مؤقت" },
    ],
    emails: [
      { address: "a.alharthi@nedaa-contracting.example", type: "primary" },
      { address: "harthi1978@mailbox.example", type: "leaked" },
      {
        address: "a.harthy@protonmail.example",
        type: "secure",
        pgpPublicKey:
          "-----BEGIN PGP PUBLIC KEY BLOCK-----\nmQINBGZ0... (بلوك مفتاح تجريبي)\n-----END PGP PUBLIC KEY BLOCK-----",
      },
    ],
    socials: [
      { platform: "X (تويتر)", handle: "@abu_salem_sa", profileUrl: "https://x.com/example" },
      { platform: "لينكدإن", handle: "ahmed-alharthi-79", profileUrl: "https://linkedin.com/example" },
    ],
    notes: [
      {
        title: "اجتماع مطار الملك خالد — بوابة خاصة",
        content:
          "**الحضور:** أحمد سليم الحارثي + شخصان لم تُحدَّد هويتهما.\n\n- وصل على متن رحلة خاصة قبل منتصف الليل\n- استُقبل بمركبة غير مسجلة رسمياً\n- مدة الاجتماع 40 دقيقة في صالة كبار الشخصيات",
        category: "meeting",
        eventDate: "2024-11-03",
      },
      {
        title: "مسار تحويلات مالية عبر وسيط",
        content:
          "تحويلات متكررة بمبالغ صغيرة (أقل من عتبة الإبلاغ) إلى حساب شركة وسيطة في دبي، مجموعها يقارب 1.8 مليون خلال 9 أشهر.",
        category: "financial",
        eventDate: "2025-01-18",
        isConfidential: true,
      },
      {
        title: "تحقق خلفي: السجل التجاري",
        content:
          "- ثلاث شركات تأسست خلال 14 شهراً\n- العنوان المشترك: مكتب محاسبة واحد\n- الشريك المؤسس قريب من الدرجة الثانية",
        category: "background",
        eventDate: "2025-02-02",
      },
    ],
  },
  {
    fullName: "نادية فؤاد المصري",
    aliases: "المستشارة, N.F.M",
    dateOfBirth: "1985-09-30",
    nationality: "مصري",
    occupation: "محامية — تحكيم تجاري دولي",
    address: "القاهرة — الزمالك — شارع محمد مظلوم 12",
    summary:
      "محامية متخصصة في التحكيم. تمثّل إحدى الشركات الوسيطة في نزاع عقود. تُعد نقطة الوصول القانونية للشبكة.",
    reliability: 5,
    sensitivity: "confidential",
    phones: [
      { number: "+201001234567", label: "work", whatsapp: true, signal: true },
      { number: "+201223344556", label: "personal" },
    ],
    emails: [
      { address: "nadia@masri-law.example", type: "primary" },
      { address: "n.fouad@tutanota.example", type: "secure" },
    ],
    socials: [{ platform: "لينكدإن", handle: "nadia-masri-arbitration" }],
    notes: [
      {
        title: "مذكرة موقف في نزاع العقد 44/2023",
        content:
          "وقّعت مذكرة موقف تُقلّص مسؤولية الشركة الوسيطة عن ضمانات الأداء، مقابل تعديل لاحق في بنود الغرامة.",
        category: "background",
        eventDate: "2024-09-21",
      },
      {
        title: "تسريب: مراسلات داخلية حول أتعاب غير مفوترة",
        content:
          "مستندات تشير إلى أتعاب لم تُفوتر رسمياً مقابل خدمات تمثيل غير معلنة في ملفين تحكيميين.",
        category: "leak",
        eventDate: "2025-03-11",
        isConfidential: true,
      },
    ],
  },
  {
    fullName: "طلال بن راشد الدوسري",
    aliases: "التاجر, T.R",
    dateOfBirth: "1991-01-05",
    nationality: "كويتي",
    occupation: "وسيط تجاري — استيراد وتصدير",
    address: "الكويت — السالمية — برج المكاتب 7",
    summary: "وسيط يربط الموردين بالجهات الحكومية. يظهر في محاضر اجتماعين مع الحارثي.",
    reliability: 3,
    sensitivity: "confidential",
    phones: [
      { number: "+96599887766", label: "work", whatsapp: true, telegram: true },
      { number: "+96555443322", label: "burner", carrierNotes: "شريحة بيانات فقط" },
    ],
    emails: [{ address: "t.dosari@gulftrade.example", type: "primary" }],
    socials: [
      { platform: "تيليجرام", handle: "@trader_tr", profileUrl: "https://t.me/example" },
      { platform: "إنستغرام", handle: "tr.alsalem" },
    ],
    notes: [
      {
        title: "محضر اجتماع مقهى — السالمية",
        content: "اجتماع مفتوح نوقش فيه تحويل مستندات عبر وسيط ثالث لتفادي الرقابة الجمركية.",
        category: "meeting",
        eventDate: "2024-12-09",
      },
    ],
  },
  {
    fullName: "مروان خليل أبو زيد",
    aliases: "المدير, أبو خليل",
    dateOfBirth: "1969-06-17",
    nationality: "أردني",
    occupation: "موظف حكومي — إدارة المشتريات",
    address: "عمّان — عبدون — شقة 22",
    summary:
      "مسؤول سابق في لجنة المشتريات. صلاحياته كانت تغطي توقيع العقود دون تصعيد للمراجعة القانونية.",
    reliability: 4,
    sensitivity: "top_secret",
    phones: [
      { number: "+962790001122", label: "personal", whatsapp: true },
      { number: "+9626500099", label: "work" },
    ],
    emails: [
      { address: "m.abuzaid@gov-procurement.example", type: "primary" },
      { address: "m.khalil77@mailbox.example", type: "leaked" },
    ],
    socials: [],
    notes: [
      {
        title: "سلسلة موافقات استثنائية",
        content:
          "خمس موافقات استثنائية متتالية لنفس المورّد خلال سنة واحدة، ثلاثة منها في الأسبوع الأخير من السنة المالية.",
        category: "background",
        eventDate: "2024-12-28",
      },
      {
        title: "إفادة مصدر حول مكافآت نقدية",
        content: "مصدر موثوق أكد وجود مبالغ نقدية تُسلَّم داخل مكتب المحامية المعنية بالملف.",
        category: "leak",
        eventDate: "2025-04-02",
        isConfidential: true,
      },
    ],
  },
  {
    fullName: "سلمى يوسف النجار",
    aliases: "الأخت سلمى",
    dateOfBirth: "1994-03-08",
    nationality: "لبناني",
    occupation: "باحثة ومصدر صحفي",
    address: "بيروت — الحمرا — بناية 9",
    summary: "مصدر رئيسي للملف. لديها اطلاع داخلي على مستندات الشركات الوسيطة.",
    reliability: 5,
    sensitivity: "confidential",
    phones: [
      { number: "+96170123456", label: "personal", signal: true, whatsapp: true },
      { number: "+96176543210", label: "burner", signal: true },
    ],
    emails: [{ address: "salma.n@protonmail.example", type: "secure" }],
    socials: [{ platform: "X (تويتر)", handle: "@salma_research" }],
    notes: [
      {
        title: "بروتوكول التواصل الآمن",
        content: "- التواصل عبر سيجنال فقط\n- رسائل تختفي بعد 24 ساعة\n- لا تُذكر الأسماء في الرسائل النصية",
        category: "background",
        eventDate: "2025-01-05",
      },
    ],
  },
  {
    fullName: "فادي جورج حنا",
    aliases: "المحاسب",
    dateOfBirth: "1983-11-25",
    nationality: "سوري",
    occupation: "محاسب قانوني معتمد",
    address: "دمشق — المزة — مكتب 104",
    summary: "محاسب الشركات الوسيطة الثلاث. يمتلك الدفاتر الأصلية والفواتير.",
    reliability: 2,
    sensitivity: "public",
    phones: [{ number: "+963955112233", label: "work", whatsapp: true }],
    emails: [{ address: "fadi@hanna-audit.example", type: "primary" }],
    socials: [],
    notes: [
      {
        title: "دفاتر غير مطابقة",
        content: "فرق جوهرية بين فواتير المورد وسجلات الاستلام في مواقع التنفيذ.",
        category: "financial",
        eventDate: "2025-02-20",
      },
    ],
  },
];

const RELATIONSHIP_SEED: {
  source: string;
  target: string;
  type: RelationshipType;
  confidence: "confirmed" | "suspected";
  contextNotes: string;
}[] = [
  {
    source: "أحمد سليم الحارثي",
    target: "نادية فؤاد المصري",
    type: "lawyer",
    confidence: "confirmed",
    contextNotes: "تمثيل قانوني موثّق في نزاع العقد 44/2023.",
  },
  {
    source: "أحمد سليم الحارثي",
    target: "طلال بن راشد الدوسري",
    type: "business_partner",
    confidence: "confirmed",
    contextNotes: "شراكة في صفقتي توريد عبر شركة وسيطة.",
  },
  {
    source: "أحمد سليم الحارثي",
    target: "مروان خليل أبو زيد",
    type: "accomplice",
    confidence: "suspected",
    contextNotes: "خمس موافقات استثنائية لنفس المجموعة من الموردين.",
  },
  {
    source: "مروان خليل أبو زيد",
    target: "نادية فؤاد المصري",
    type: "associate",
    confidence: "suspected",
    contextNotes: "لقاءان في مكتب المحامية دون سجل مواعيد رسمي.",
  },
  {
    source: "طلال بن راشد الدوسري",
    target: "فادي جورج حنا",
    type: "business_partner",
    confidence: "confirmed",
    contextNotes: "توقيع المحاسب على القوائم المالية للشركة الوسيطة.",
  },
  {
    source: "سلمى يوسف النجار",
    target: "أحمد سليم الحارثي",
    type: "whistleblower",
    confidence: "confirmed",
    contextNotes: "مصدر توثيق مستندات الشركات الوسيطة.",
  },
  {
    source: "نادية فؤاد المصري",
    target: "فادي جورج حنا",
    type: "adversary",
    confidence: "suspected",
    contextNotes: "خلاف حول تسليم الدفاتر الأصلية.",
  },
];

export async function seedDemoData(force = false): Promise<{ created: number; skipped: boolean }> {
  const existing = await countPersons();
  if (existing > 0 && !force) return { created: 0, skipped: true };

  const nameToId = new Map<string, string>();

  for (const seed of SEED) {
    const [person] = await db
      .insert(persons)
      .values({
        fullName: seed.fullName,
        aliases: seed.aliases,
        dateOfBirth: seed.dateOfBirth,
        nationality: seed.nationality,
        occupation: seed.occupation,
        address: seed.address,
        summary: seed.summary,
        reliability: seed.reliability,
        sensitivity: seed.sensitivity,
      })
      .returning();
    if (!person) continue;
    nameToId.set(seed.fullName, person.id);

    if (seed.phones.length) {
      await db.insert(phones).values(
        seed.phones.map((p) => ({
          personId: person.id,
          number: toE164(p.number),
          label: p.label,
          whatsapp: p.whatsapp ?? false,
          signal: p.signal ?? false,
          telegram: p.telegram ?? false,
          carrierNotes: p.carrierNotes ?? "",
        })),
      );
    }
    if (seed.emails.length) {
      await db.insert(emails).values(
        seed.emails.map((e) => ({
          personId: person.id,
          address: normalizeEmail(e.address),
          type: e.type,
          pgpPublicKey: e.pgpPublicKey ?? "",
        })),
      );
    }
    if (seed.socials.length) {
      await db.insert(socials).values(
        seed.socials.map((s) => ({
          personId: person.id,
          platform: s.platform,
          handle: s.handle,
          profileUrl: s.profileUrl ?? "",
        })),
      );
    }
    if (seed.notes.length) {
      await db.insert(notes).values(
        seed.notes.map((n) => ({
          personId: person.id,
          title: n.title,
          content: n.content,
          category: n.category,
          eventDate: n.eventDate,
          isConfidential: n.isConfidential ?? false,
        })),
      );
    }
  }

  for (const rel of RELATIONSHIP_SEED) {
    const sourceId = nameToId.get(rel.source);
    const targetId = nameToId.get(rel.target);
    if (!sourceId || !targetId) continue;
    await db
      .insert(relationships)
      .values({
        sourcePersonId: sourceId,
        targetPersonId: targetId,
        type: rel.type,
        confidence: rel.confidence,
        contextNotes: rel.contextNotes,
      })
      .onConflictDoNothing();
  }

  const result = await reindexAll();
  await logAudit("seed", "database", null, `إدخال بيانات تجريبية (${result.persons} ملف)`);

  return { created: result.persons, skipped: false };
}
