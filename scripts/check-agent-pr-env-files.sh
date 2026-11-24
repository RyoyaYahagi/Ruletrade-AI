#!/usr/bin/env bash
set -euo pipefail

while IFS= read -r -d '' path; do
  case "${path##*/}" in
    .env.local|.env.production|.env.development)
      printf 'Agent PR must not modify %q\n' "$path" >&2
      exit 1
      ;;
  esac
done
