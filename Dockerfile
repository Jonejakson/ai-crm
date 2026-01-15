FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Устанавливаем зависимости для pdfkit (нужны для работы с шрифтами и PDF)
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
# Устанавливаем зависимости без выполнения postinstall скриптов
RUN npm install --ignore-scripts

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Теперь запускаем prisma generate, когда схема уже скопирована
RUN npx prisma generate
# Создаем минимальный .env для сборки (DATABASE_URL будет переопределен в runtime)
RUN echo 'DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"' > .env
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build
RUN rm -f .env

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install wget for health checks and dependencies for pdfkit
RUN apk add --no-cache wget python3 make g++ fontconfig ttf-dejavu

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Копируем standalone сборку
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# pdfkit требует встроенные AFM-файлы (метрики шрифтов). В standalone-сборке они не попадают в output tracing,
# поэтому явно копируем их в место, откуда pdfkit пытается их читать.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdfkit/js/data ./.next/server/chunks/data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# В standalone режиме server.js находится в корне
CMD ["node", "server.js"]
