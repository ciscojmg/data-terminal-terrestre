#!/usr/bin/env bash
# Regenera el historial con varios commits (Conventional Commits) y autor local.
# Ejecutar desde la raíz del repo: bash scripts/setup-git-history.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git config user.name "Francisco Mujica"
git config user.email "franciscomujica.01@gmail.com"

if git rev-parse --git-dir >/dev/null 2>&1; then
  rm -rf .git
fi

git init -b main

git add .gitignore data/.gitkeep
git commit -m "chore: ignorar datos generados y mantener carpeta data"

git add package.json package-lock.json
git commit -m "chore: dependencias npm y metadatos del proyecto"

git add src/config.js src/http-fetch.js src/parser.js
git commit -m "feat(parser): configuración, cliente HTTP y parseo HTML"

git add src/scrape.js src/refresh-from-web.js src/repair-desconocidas.js
git commit -m "feat(scraper): barrido completo, refresh y reparación de cooperativas"

git add scripts/terminal-scrape.js scripts/ndjson-to-json.js
git commit -m "feat(cli): script unificado terminal-scrape y exportación NDJSON→JSON"

git add README.md
git commit -m "docs: README con uso, esquema de datos y estructura"

echo "Listo. Historial con $(git rev-list --count HEAD) commits."
git log --oneline
