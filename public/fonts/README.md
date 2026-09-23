# الخطوط المحلية (Air-gap)

النظام لا يستدعي أي خط من الإنترنت. ضع ملفات `woff2` للخطوط العربية هنا لتُستخدم في الواجهة
والتقارير المطبوعة (الأسماء المطلوبة في `src/app/globals.css`):

```
public/fonts/Tajawal-Regular.woff2
public/fonts/Tajawal-Bold.woff2
public/fonts/Cairo-Regular.woff2
```

- المصدر (على جهاز متصل): https://fonts.google.com/specimen/Tajawal ، https://fonts.google.com/specimen/Cairo
- نزّل الملفات ثم انقلها إلى هذا المجلد عبر وسيط تخزين موثوق.
- في غياب الملفات يستخدم المتصفح خطوط النظام العربية (`Noto Naskh Arabic`, `Segoe UI`, `Tahoma`)
  دون أي اتصال خارجي.
- لدمج الخطوط داخل ملف PDF عبر WeasyPrint، ضعها أيضاً في `/usr/share/fonts/truetype/` داخل
  الحاوية ثم شغّل `fc-cache -f`.
