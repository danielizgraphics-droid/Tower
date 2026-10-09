#!/usr/bin/env bash
# Builds the game and publishes dist/ to the gh-pages branch (GitHub Pages),
# where it installs on a phone's home screen as a full-screen app.
set -euo pipefail
cd "$(dirname "$0")/.."
npx vite build
remote=$(git remote get-url origin)
tmp=$(mktemp -d)
cp -r dist/. "$tmp"
touch "$tmp/.nojekyll"
cd "$tmp"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name || echo deploy)" -c user.email="$(git -C "$OLDPWD" config user.email || echo deploy@localhost)" \
  commit -qm "Deploy $(git -C "$OLDPWD" rev-parse --short HEAD)"
git push -qf "$remote" gh-pages
rm -rf "$tmp"
echo "Published to gh-pages"
