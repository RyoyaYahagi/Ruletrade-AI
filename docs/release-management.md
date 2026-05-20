# Release Management

Ruletrade-AI releases use:

- release plans
- release checklist
- changelog entries
- release risk assessments
- release approvals
- rollback strategy

## Required before release

- no failed release checklist items
- no open critical release risks
- rollback strategy exists
- changelog exists
- sensitive changes approved

## Sensitive changes

- DB migration
- RLS change
- env change
- AI prompt change
- privacy change
- billing change
- webhook / cron change

## Release gates

`evaluateReleaseGates(releasePlanId)` checks:

1. rollback strategy exists (if required)
2. changelog entries exist (if required)
3. sensitive changes have approvals
4. no failed/blocked checklist items
5. no open critical risks

## Hotfix workflow

1. Confirm incident
2. Consider stop switch / maintenance mode
3. Create hotfix release plan
4. Minimize scope
5. Run required tests only
6. Verify on deploy preview
7. Deploy to production
8. Check logs / health
9. Record in changelog
10. Create postmortem / follow-up issue

## Versioning

MVP phase:

- 0.1.0 internal alpha
- 0.2.0 private beta
- 0.3.0 expanded beta
- 0.4.0 release candidate
- 0.5.0 public landing / open beta preparation

SemVer-style:

- MAJOR: breaking changes, public API / data model changes
- MINOR: feature additions, beta phase updates
- PATCH: bugfix / hotfix / small UI fix
