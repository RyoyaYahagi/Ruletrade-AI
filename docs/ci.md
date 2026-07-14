# CI / Automation

## GitHub Actions

Workflows in `.github/workflows/`:

### `ci.yml`

Runs on every PR:

- Typecheck
- Lint
- Test
- Build
- SQLite schema check
- Ownership check audit
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
- `sqlite-schema-check`

## Local CI Check

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Runs all CI checks locally.
