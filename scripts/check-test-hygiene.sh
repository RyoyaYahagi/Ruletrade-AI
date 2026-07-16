#!/usr/bin/env bash
# CI gate for AGENTS.md "Testing rules": tests must never be disabled or
# focused to make checks pass. A prose rule alone gets diluted; this makes
# it mechanical.
set -euo pipefail

pattern='\b(it|test|describe)\.(skip|only)\s*\(|\b(xit|xdescribe|xtest|fit|fdescribe)\s*\('

matches=$(grep -RInE "$pattern" tests \
  --include='*.test.ts' --include='*.test.tsx' \
  --include='*.spec.ts' --include='*.spec.tsx' || true)

if [ -n "$matches" ]; then
  echo "Disabled or focused tests are not allowed (.skip / .only / x-prefixed):"
  echo "$matches"
  exit 1
fi

echo "check:test-hygiene OK"
