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
  echo "[entrypoint] Base vide → seed + embeddings + résumés IA"
  node prisma/seed.cjs
  node scripts/embed.cjs || echo "[entrypoint] embeddings: fallback pseudo (déjà posés par le seed)"
  # Pré-génère les résumés IA (dossiers + amendements) pour un affichage instantané.
  node scripts/warm.cjs || echo "[entrypoint] résumés: génération paresseuse au premier clic (fallback)"
else
  echo "[entrypoint] Base déjà peuplée ($COUNT dossiers) → pas de re-seed"
fi

echo "[entrypoint] Démarrage du serveur Next.js…"
exec node server.js
