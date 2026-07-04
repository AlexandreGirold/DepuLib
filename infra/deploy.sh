#!/usr/bin/env bash
# Redéploiement : pull main + rebuild. Le .env (secrets) n'est pas dans git.
set -euo pipefail
cd /home/debian/depulib
git fetch --quiet origin main
git reset --hard origin/main
docker compose up -d --build
echo "deploy ok: $(git rev-parse --short HEAD)"
