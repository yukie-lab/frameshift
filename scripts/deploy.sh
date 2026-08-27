#!/usr/bin/env bash
# Build and publish dist/ to the gh-pages branch that GitHub Pages serves.
set -euo pipefail

cd "$(dirname "$0")/.."
WORKTREE=.gh-pages

npm run build

git worktree remove --force "$WORKTREE" 2>/dev/null || true
if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git fetch -q origin gh-pages
  git worktree add -q -B gh-pages "$WORKTREE" origin/gh-pages
else
  git worktree add -q --detach "$WORKTREE"
  git -C "$WORKTREE" checkout -q --orphan gh-pages
  git -C "$WORKTREE" rm -rq --cached . 2>/dev/null || true
fi

find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R dist/. "$WORKTREE"/
touch "$WORKTREE/.nojekyll"

git -C "$WORKTREE" add -A
if git -C "$WORKTREE" diff --cached --quiet; then
  echo "gh-pages: no change"
else
  git -C "$WORKTREE" commit -q -m "Deploy $(git rev-parse --short HEAD)"
  git -C "$WORKTREE" push -q -u origin gh-pages
  echo "gh-pages: pushed"
fi

git worktree remove --force "$WORKTREE"
echo "https://yukie-lab.github.io/frameshift/"
