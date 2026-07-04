# --- Étape 1 : dépendances ---
FROM node:20-bookworm-slim AS deps
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# --- Étape 2 : build ---
FROM node:20-bookworm-slim AS builder
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Copie les styles DSFR dans public/dsfr (gitignoré → absent du contexte de build).
# Chargés via <link href="/dsfr/..."> dans layout.tsx ; sans ça, page sans CSS.
RUN cp -r node_modules/@codegouvfr/react-dsfr/dsfr public/dsfr
# Base SQLite factice pour permettre `prisma generate` au build.
ENV DATABASE_URL="file:/tmp/build.db"
RUN npx prisma generate
RUN npm run build

# --- Étape 3 : runtime ---
FROM node:20-bookworm-slim AS runner
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Outils Prisma + client + scripts de seed/migration.
# (On n'utilise PAS .bin/prisma : COPY déréférence le symlink et casse la
#  résolution des .wasm. L'entrypoint appelle node_modules/prisma/build/index.js.)
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Sortie standalone Next
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma schema, seed, scripts et données seed
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/seed ./seed
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
