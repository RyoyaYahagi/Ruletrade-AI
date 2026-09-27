#!/usr/bin/env bash
# CI backstop for the .data leak incident: a runtime SQLite DB was once
# committed and pushed to the public repo. .gitignore alone cannot prevent
# this (git add -f bypasses it; already-tracked files ignore it), so CI
# fails whenever a database artifact is tracked anywhere in the tree.
set -euo pipefail

# Match the root runtime data directory, hidden .data directories, and SQLite files.
# Ordinary nested data directories (such as src/app/data) contain application code.
pattern='^data/|(^|/)\.data/|\.sqlite(-shm|-wal)?$'

tracked=$(git ls-files | grep -E "$pattern" || true)

if [ -n "$tracked" ]; then
  echo "Database artifacts must never be tracked by git:"
  echo "$tracked"
  echo "Remove them with: git rm --cached <file>"
  exit 1
fi

echo "check:repo-hygiene OK"
