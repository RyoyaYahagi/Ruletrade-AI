#!/usr/bin/env bash
# Runs from the npm "prepare" script so every clone gets the repo's
# pre-commit guard without manual setup.
# Fallback: outside a git checkout (e.g. deploy builds that strip .git)
# hooks have nothing to protect, so exiting quietly is safe by design.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

git config core.hooksPath .githooks
