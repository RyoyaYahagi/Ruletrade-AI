# Release Process

## Versioning

Ruletrade-AI uses SemVer-style versions.

During MVP development:

- 0.x releases are unstable MVP milestones
- 1.0.0 means closed beta readiness

## Before Release

Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Also run DB/RLS and E2E smoke tests when relevant.

## Release Steps

1. Confirm milestone issues are done
2. Run release checklist
3. Update CHANGELOG.md
4. Tag release
5. Deploy
6. Run smoke tests
7. Write release notes
