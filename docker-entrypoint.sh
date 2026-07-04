#!/bin/sh
set -e

echo "[entrypoint] Préparation de la base de données…"
mkdir -p /data /data/uploads

# Applique le schéma (crée la base si absente) — idempotent.
# Appel direct du CLI Prisma (le symlink .bin n'est pas embarqué).
node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss

# Seed si la base est vide (aucun dossier).
COUNT=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.dossier.count().then(c=>{console.log(c);return p.\$disconnect()}).catch(()=>{console.log(0)})")
if [ "$COUNT" = "0" ]; then
  echo "[entrypoint] Base vide → seed + embeddings"
  node prisma/seed.cjs
  node scripts/embed.cjs || echo "[entrypoint] embeddings: fallback pseudo (déjà posés par le seed)"
else
  echo "[entrypoint] Base déjà peuplée ($COUNT dossiers) → pas de re-seed"
fi

# Actualités « Quoi de neuf ? » : charge seed/actus.json si aucune actualité en base
# (idempotent grâce à la dédup). Le JSON est produit hors-ligne par `npm run parse-actus`.
ACTUS=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.actualite.count().then(c=>{console.log(c);return p.\$disconnect()}).catch(()=>{console.log(0)})")
if [ "$ACTUS" = "0" ]; then
  echo "[entrypoint] Aucune actualité → seed-actus"
  node scripts/seed-actus.cjs || echo "[entrypoint] seed-actus: échec (démarrage quand même)"
else
  echo "[entrypoint] Actualités déjà présentes ($ACTUS) → pas de chargement"
fi

echo "[entrypoint] Démarrage du serveur Next.js…"
exec node server.js
