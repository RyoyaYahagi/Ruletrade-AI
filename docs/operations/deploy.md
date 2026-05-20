# Deploy

## Production Deploy

See `docs/release.md` for the release process.

## Environment Variables

See `docs/operations/env-vars.md`.

## Rollback

If a deploy causes issues, revert the last merge and redeploy.

## Smoke Test

After deploy, verify:

- login works
- rule session creation works
- AI review works
- RLS blocks cross-user access
