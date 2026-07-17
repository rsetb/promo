# Imagem de produção para o EasyPanel.
# Multi-stage: as dependências de build não vão para a imagem final.
#
# Base Debian (não Alpine) de propósito: o better-sqlite3 é um módulo nativo e
# tem binário pronto para glibc. Em Alpine (musl) não há prebuild e ele teria
# que ser compilado, exigindo python/make/g++ na imagem.

FROM node:22-bookworm-slim AS base

# ---------------------------------------------------------------- dependências
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------- build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `npm run build` gera data/seed.json e depois compila o Next.
# Sem DATABASE_PATH aqui: a conexão é preguiçosa (src/db/index.ts) e todas as
# rotas são dinâmicas, então nada abre o banco durante o build.
RUN npm run build

# --------------------------------------------------------------------- runtime
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Não rodar como root.
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migrations e catálogo inicial, aplicados no start do container.
# data/seed.json é gerado pelo `npm run build` (scripts/build-seed.ts), onde
# existe tsx; a imagem final não precisa de tsx nem dos fontes TypeScript.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/data/seed.json ./data/seed.json
# O build standalone só inclui os arquivos que o app importa; o migrator não é
# um deles, então trazemos o pacote completo do drizzle-orm.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

# O BANCO VIVE AQUI. Este diretório PRECISA ser um volume no EasyPanel — sem
# volume, o arquivo fica na camada gravável do container e o catálogo inteiro é
# perdido no primeiro redeploy.
ENV DATABASE_PATH=/data/app.db
RUN mkdir -p /data && chown nextjs:nodejs /data
VOLUME /data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
