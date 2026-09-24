# دليل النشر على Ubuntu Server (معزول عن الإنترنت)

## 0) المتطلبات

- Ubuntu Server 22.04 / 24.04 LTS (amd64 أو arm64).
- Docker Engine 24+ وDocker Compose v2.
- 2 غيغابايت ذاكرة على الأقل، و20 غيغابايت مساحة قرص.
- **لا يوجد أي مفتاح أو خدمة خارجية مطلوبة.**

## 1) تثبيت Docker (على جهاز متصل بالإنترنت — مرة واحدة)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"   # ثم اخرج وادخل من جديد
```

## 2) نقل المشروع إلى الجهاز المعزول (Air-gap)

كل الحزم مضمّنة في المستودع، و`package-lock.json` يضمن تثبيتاً قابلاً للتكرار.
لنقل المشروع بدون إنترنت:

```bash
# على جهاز متصل:
npm ci                                # تنزيل كل الحزم
npm run build                         # التأكد من سلامة البناء
tar -czf icims-offline.tar.gz \
    --exclude node_modules --exclude .next --exclude .data .

# ثم انقل icims-offline.tar.gz عبر وسيط تخزين موثوق، وعلى الخادم المعزول:
tar -xzf icims-offline.tar.gz -C /opt/icims && cd /opt/icims
npm ci --offline          # أو انقل مجلد node_modules نفسه مع الأرشيف
```

> بديل أصغر: انقل صور Docker جاهزة عبر `docker save` / `docker load`.

## 3) الإعداد والتشغيل

```bash
cd /opt/icims
cp .env.example .env

# توليد أسرار قوية (مطلوبة قبل أول تشغيل)
openssl rand -hex 32   # → APP_SECRET
openssl rand -hex 32   # # → MEILI_MASTER_KEY
# عدّل أيضاً: POSTGRES_PASSWORD

# تحديد مستوى الكشف:
#   127.0.0.1 → الوصول من الجهاز نفسه فقط
#   0.0.0.0   # → السماح لعناوين الشبكة المحلية (استخدم جدار حماية)
nano .env

docker compose build
docker compose up -d db meilisearch   # انتظر جاهزية قاعدة البيانات ومحرك البحث
docker compose up -d app nginx        # الجداول تُنشأ تلقائياً عند إقلاع app
```

> **الجداول تُنشأ تلقائياً** عند إقلاع حاوية `app` (بوابة المخطط الذاتية في `src/db/pool.ts`
> + `src/instrumentation.ts`)، مع إعادة محاولة إن كانت قاعدة البيانات لم تكتمل جاهزيتها.
> خدمة `migrate` في `docker-compose.yml` تبقى متاحة لمن يريد تطبيق المخطط صراحةً:
> `docker compose run --rm migrate`.

## 4) التحقق

```bash
docker compose ps
curl -s http://127.0.0.1:8080/api/health | python3 -m json.tool
# المتوقع: {"ok": true, "service": "icims-api", "checks": {"database": "متصل", ...}}

# إدخال بيانات تجريبية (إن كانت القاعدة فارغة)
curl -X POST http://127.0.0.1:8080/api/seed

# اختبار البحث الموحّد مع تطبيع العربية وتحمّل الخطأ المطبعي
curl -s "http://127.0.0.1:8080/api/search?q=%D8%A7%D8%AD%D9%85%D8%AF" | head -c 400
curl -s "http://127.0.0.1:8080/api/search?q=%D8%A7%D8%AD%D9%85%D8%A7%D8%AF" | head -c 400   # بدون همزة

# اختبار التصدير الجنائي
curl -s "http://127.0.0.1:8080/api/dossier/<UUID>?profile=no_confidential" | head -20
```

افتح المتصفح على: `http://<عنوان-الخادم>:8080`

## 5) فحص الأمان بعد التشغيل

```bash
# 1) تأكد أن قاعدة البيانات ومحرك البحث غير مكشوفين على المضيف
ss -ltnp | grep -E '5432|7700'        # يجب ألا يظهر أي استماع على 0.0.0.0

# 2) تأكد أن شبكة الخدمات الداخلية معزولة
docker network inspect icims_internal | grep -i internal   # "Internal": true

# 3) تأكد أن الوسائط خارج المجلد العام
docker compose exec app ls -la /data/media | head

# 4) تحقق أن التنزيل يرفض الرموز المفقودة/المنتهية
curl -i "http://127.0.0.1:8080/api/documents/<UUID>/file" | head -3     # 401
```

## 6) النسخ الاحتياطي والاستعادة

```bash
# نسخة احتياطية كاملة (قاعدة بيانات + وسائط)
docker compose exec -T db pg_dump -U icims -d icims | gzip > backup/icims-$(date +%F).sql.gz
docker run --rm -v icims_media_uploads:/data -v "$PWD/backup:/backup" alpine \
    tar -czf /backup/media-$(date +%F).tar.gz -C /data .

# الاستعادة
gunzip -c backup/icims-YYYY-MM-DD.sql.gz | docker compose exec -T db psql -U icims -d icims
docker run --rm -v icims_media_uploads:/data -v "$PWD/backup:/backup" alpine \
    tar -xzf /backup/media-YYYY-MM-DD.tar.gz -C /data
docker compose run --rm migrate
curl -X POST http://127.0.0.1:8080/api/search/reindex
```

## 7) تحويل الملف الجنائي إلى PDF من سطر الأوامر (WeasyPrint)

```bash
# داخل حاوية بايثون (لا اتصال خارجي مطلوب)
curl -s "http://127.0.0.1:8080/api/dossier/<UUID>?profile=full" -o /tmp/dossier.html
python3 -m pip install --no-index weasyprint   # أو استخدم حزمة محلية
python3 -m weasyprint /tmp/dossier.html /tmp/dossier.pdf
```

## 8) تحديث النظام

```bash
cd /opt/icims
git pull           # أو استبدال الملفات من الوسيط المحمول
docker compose build
docker compose run --rm migrate
docker compose up -d
curl -X POST http://127.0.0.1:8080/api/search/reindex
```

## 9) تشغيل طبقة FastAPI المرجعية (اختياري)

```bash
# فك التعليق عن خدمة `fastapi` في docker-compose.yml ثم:
docker compose up -d --build fastapi
# نقاط النهاية: /docs (Swagger) ، /api/persons ، /api/search ، /api/dossier/{id}.pdf
```

## 10) حل المشكلات الشائعة

| المشكلة | الحل |
| --- | --- |
| `500` عند فتح اللوحة | لم تُطبَّق التغييرات على المخطط: `docker compose run --rm migrate` |
| بطء البحث | `POST /api/search/reindex` ثم تحقّق من `docker compose logs meilisearch` |
| رفض رفع ملف | الامتداد/النوع خارج القائمة البيضاء، أو الحجم > 60 م.ب |
| `401` عند التنزيل | انتهت صلاحية الرمز (15 دقيقة) — أعد تحميل الصفحة للحصول على رمز جديد |
| الوصول من جهاز آخر مستحيل | `BIND_ADDR=0.0.0.0` في `.env` ثم `docker compose up -d nginx` |
