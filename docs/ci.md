# CI / Automation

## GitHub Actions

Workflows in `.github/workflows/`:

### `ci.yml`

Runs on every PR:

- Typecheck
- Lint
- Test
- Build
- DB Migration check
- RLS policy check
- Secret scan

### `security.yml`

Runs weekly:

- Dependency audit
- Secret scan
- AI safety regression check

## PR Requirements

Before merge, CI must pass:

- `typecheck`
- `lint`
- `test`
- `build`
- `db-migration-check`

## Local CI Check

```bash
pnpm ci:check
```

Runs all CI checks locally.
