# =============================================================
#  طبقة FastAPI المرجعية — صورة إنتاجية معزولة
#  تتضمّن مكتبات نظام WeasyPrint (pango/cairo) لتوليد PDF محلياً.
# =============================================================
FROM python:3.12-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MEDIA_DIR=/data/media

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 \
        libffi-dev curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 1001 icims \
    && mkdir -p /data/media && chown -R icims:icims /data/media

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=icims:icims . /srv

USER icims
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
