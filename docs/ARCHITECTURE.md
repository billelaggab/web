# المخطط المعماري — منظومة إدارة جهات الاتصال والاستخبارات

## 1) نظرة عامة على الحاويات والشبكات

```
                 ┌───────────────────────────────┐
   المتصفح ────► │  nginx (edge)  :80 فقط        │  ← المنفذ الوحيد المكشوف
                 └───────────────┬───────────────┘
                                 │ شبكة edge (bridge)
                 ┌───────────────┴───────────────┐
                 │  app (Next.js server) :3000   │  ← الواجهة + REST API
                 └───┬───────────────┬───────────┘
                     │               │
        شبكة internal │               │ شبكة internal
        ┌─────────────┴───┐   ┌───────┴────────────┐
        │ postgres :5432  │   │ meilisearch :7700  │
        └─────────────────┘   └────────────────────┘

  مجلدات مسمّاة: icims_pgdata ، icims_meili_data ، icims_media_uploads
  شبكة `internal` معلَّمة `internal: true` → لا مسار للخروج إلى الإنترنت.
```

## 2) شجرة الملفات (التنفيذ الجاهز)

```
.
├── Dockerfile                  # بناء متعدد المراحل (deps → builder → runner)
├── docker-compose.yml          # app + db + meilisearch + nginx + migrate
├── nginx/default.conf          # الوكيل العكسي + ترويسات الأمان + حدود الرفع
├── .env.example                # كل متغيرات البيئة موثّقة
├── drizzle.config.json
├── src
│   ├── db
│   │   ├── index.ts            # تجمّع اتصالات PostgreSQL (pg Pool + Drizzle)
│   │   ├── schema.ts           # كل الجداول والفهارس والقيود المرجعية
│   │   └── queries.ts          # استعلامات القراءة (الملف الكامل، الإحصاءات، الشبكة)
│   ├── lib
│   │   ├── arabic.ts           # التطبيع العربي + ليفنشتاين + تظليل النتائج
│   │   ├── search.ts           # فهرس البحث + خط أنابيب الفهرسة + طبقة Meilisearch
│   │   ├── security.ts         # HMAC، تعقيم الأسماء، SHA-256، حماية المسار
│   │   ├── validate.ts         # تحقق المدخلات (نظير Pydantic) + أخطاء HTTP
│   │   ├── markdown.ts         # Markdown آمن ضد XSS
│   │   ├── dossier-html.ts     # قالب الملف الجنائي المستقل (HTML/PDF)
│   │   ├── constants.ts        # قواميس التسميات العربية
│   │   ├── media-urls.ts       # توليد روابط موقّعة (للخادم فقط)
│   │   ├── seed-data.ts        # بيانات تجريبية
│   │   └── types.ts            # أنواع المشتركة (Dossier, SearchHit, …)
│   ├── components              # AppShell, PersonCard, PersonForm, PersonProfile,
│   │                           # PrintControls, NetworkGraph, SettingsPanel, ui
│   └── app                     # App Router: الصفحات + مسارات REST
│       ├── page.tsx            # لوحة التحكم
│       ├── persons/            # القائمة، جديد، [id]، [id]/edit، [id]/dossier
│       ├── search, network, settings
│       └── api/                # health, persons, records, documents, search, dossier, seed
├── public/fonts                # خطوط Tajawal/Cairo المحلية (تُنسخ يدوياً)
├── docs                        # هذه الوثيقة + دليل النشر
└── reference/fastapi           # مرجع FastAPI + SQLAlchemy + WeasyPrint
```

### 2.1) مكافئ بنية React + Vite (إن فُصلت الواجهة)

```
frontend/
├── index.html                  # <html lang="ar" dir="rtl">
├── vite.config.ts              # plugins: [react()], base: '/'
├── package.json                # react-bootstrap, bootstrap, bootstrap-icons, axios, react-router-dom
└── src
    ├── main.jsx                # import 'bootstrap/dist/css/bootstrap.rtl.min.css'
    │                           # import 'bootstrap-icons/font/bootstrap-icons.css'
    ├── App.jsx                 # <BrowserRouter> + <Routes> + <Navbar/>
    ├── api/client.js           # axios instance (baseURL = '/api')
    ├── components
    │   ├── SearchBar.jsx       # بحث فوري + List Group + تظليل
    │   ├── PersonCard.jsx
    │   ├── DossierView.jsx     # الملف المطبوع (d-print-*)
    │   ├── FileDropzone.jsx
    │   └── Lightbox.jsx
    └── pages                   # Dashboard, Persons, PersonProfile, Dossier, Network, Settings
```

## 3) مخطط قاعدة البيانات

```
persons (1) ──┬──< phones        (person_id → persons.id, CASCADE)
              ├──< emails        (… + pgp_public_key)
              ├──< socials       (platform, handle, profile_url)
              ├──< notes         (category, event_date, recorded_at, is_confidential)
              ├──< documents     (entity_type, entity_id, stored_name, sha256, mime, size)
              ├──< relationships (source_person_id, target_person_id → persons.id)  ← ذاتي المرجع
              └──< search_docs   (entity_type, entity_id, normalized, weight)       ← فهرس البحث

audit_log  (action, entity, entity_id, summary, actor, created_at)
```

- كل المعرّفات `uuid` مع `gen_random_uuid()`.
- فهارس: أسماء، حساسية، تواريخ، أرقام هواتف، بريد، معرّفات، بصمات SHA-256.
- قيد فريد على `(entity_type, entity_id)` في `search_docs` وعلى الثلاثية
  `(source, target, type)` في `relationships` لمنع التكرار.
- حذف أي شخص يحذف تباعياً كل السجلات المرتبطة + مستندات الفهرس الخاصة به.

## 4) خط أنابيب الفهرسة (Write-through)

```
عملية كتابة (POST/PATCH/DELETE)
        │
        ├─► PostgreSQL (المصدر الموثوق) ──► سجل التدقيق (audit_log)
        │
        └─► reindexPerson(personId)
                ├── حذف مستندات الفهرس القديمة لهذا الملف
                ├── إعادة بنائها من: person + phones + emails + socials + notes + documents
                ├── normalized = normalizeArabic(title + subtitle + body)
                └── إدراجها مع وزن (person=10, phone/email=6, note=5, social/doc=4)

إعادة البناء الكامل: POST /api/search/reindex  →  reindexAll() + syncToMeilisearch()
```

**تطبيع العربية** (`src/lib/arabic.ts`):

| المدخل | المخزَّن/المُطابَق |
| --- | --- |
| أ إ آ ٱ | ا |
| ة | ه |
| ى ، ی | ي |
| ؤ | و |
| ئ | ي |
| التشكيل والتطويل | يُحذف |
| الأرقام العربية-الهندية | 0-9 |

**التحمّل للأخطاء:** لكل كلمة استعلام يُحسب أفضل تطابق عبر `fuzzyMatch` (تطابق تام = 1،
بادئة = 0.85، احتواء = 0.7، ليفنشتاين ≤ 1–3 حسب طول الكلمة = 0.35…0.9). يجب أن تتحقق كل
الكلمات، والنتيجة النهائية = مجموع النتائج × الوزن، ثم تُجمَّع النتائج لكل ملف شخص.

**Meilisearch (اختياري):** عند ضبط `MEILISEARCH_HOST` يُستعلم الفهرس البعيد أولاً؛ وعند أي
خطأ أو مهلة 1.5 ثانية يتراجع النظام تلقائياً إلى طبقة PostgreSQL المحلية. المخططان متطابقان
(`id, entityType, entityId, personId, title, subtitle, body, normalized, weight`).

## 5) أمن بث الوسائط

```
1. الرفع: multipart → تعقيم الاسم الأصلي → قائمة بيضاء للامتداد وMIME → حد 60 م.ب
          → storedName = randomUUID() + امتداد → SHA-256 → كتابة 0640 داخل MEDIA_DIR
2. القراءة: /api/documents/:id/file?token=…
          token = {exp}.base64url(HMAC_SHA256(documentId + "." + exp, APP_SECRET))
          صلاحية 15 دقيقة → 401 عند الانتهاء أو التلاعب (مقارنة timing-safe)
3. لا يُخدم أي ملف من المجلد العام؛ ولا يُكشف مسار التخزين في أي استجابة.
```

## 6) قواعد الطباعة

- `@page { size: A4; margin: 14mm 12mm 16mm 12mm }`.
- `page-break-inside: avoid` على `.note-card`, `table`, `tr`, `.page-block`.
- `thead { display: table-header-group }` لتكرار رؤوس الجداول في كل صفحة.
- `page-break-after: avoid` على عناوين الأقسام.
- العلامة المائية طبقة ثابتة `position: fixed` تظهر في كل صفحة، وكل عناصر التحكم تحمل
  `d-print-none`.
- مرشّح التعقيم يُطبَّق على الخادم (`getDossier(profile)`) لا على العميل — لذا لا يُرسل
  المحتوى السري إلى المتصفح أصلاً عند استثناءه.
