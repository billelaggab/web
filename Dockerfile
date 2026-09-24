# =============================================================
#  منظومة إدارة جهات الاتصال والاستخبارات — صورة الإنتاج
#  بناء متعدد المراحل، مستخدم غير جذري، بدون أي اتصال خارجي.
# =============================================================

# ---------- المرحلة 1: التبعيات ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
COPY package.json package-lock.json ./
RUN npm install

# ---------- المرحلة 2: البناء ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 DOCKER_BUILD=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL وقت البناء غير مستخدم (كل الصفحات ديناميكية) — يُمرَّر وقت التشغيل فقط.
RUN DATABASE_URL=postgres://dummy:dummy@localhost:5432/dummy npm run build

# ---------- المرحلة 3: التشغيل ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    MEDIA_DIR=/data/media

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 icims \
    && useradd --system --uid 1001 --gid icims --create-home icims \
    && mkdir -p /data/media \
    && chown -R icims:icims /data/media

COPY --from=builder --chown=icims:icims /app/.next/standalone ./
COPY --from=builder --chown=icims:icims /app/.next/static ./.next/static
COPY --from=builder --chown=icims:icims /app/public ./public

USER icims
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
