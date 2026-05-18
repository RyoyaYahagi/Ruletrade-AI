# Rollback

Rollback strategy depends on the change type.

## App-only changes

Use Vercel rollback when safe.

## Feature-gated changes

Disable the feature flag or stop switch.

## DB migration changes

Prefer forward-fix unless a safe rollback migration exists.

## Important Rule

Never assume application rollback reverts database or external provider state. DB migrations are not automatically rolled back by Vercel rollback.
