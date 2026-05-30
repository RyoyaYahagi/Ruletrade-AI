# AI Agent Development Workflow

Ruletrade-AI uses AI coding agents carefully.

Agents may help with:

- small implementation tasks
- tests
- documentation
- simple refactors
- schema additions

Agents must not:

- access secrets
- deploy to production
- change production environment variables
- weaken RLS
- bypass safety checks
- change legal boundaries
- make broad refactors without instruction

## Agent-safe tasks

A task is agent-safe when:

- scope is small
- allowed files are listed
- forbidden files are listed
- tests are clear
- security impact is low

## Human review

All agent PRs require human review.

Critical areas require careful review:

- Auth
- RLS
- Security
- Billing
- Privacy
- Legal
- AI Safety

## Agent labels

- `agent:safe` — safe for agent assignment
- `agent:needs-human-design` — needs human design before agent implements
- `agent:do-not-assign` — do not assign to agent
- `agent:review-carefully` — assignable, but review carefully

## Forbidden actions

- Do not edit `.env.local`.
- Do not write secrets in code.
- Do not use `NEXT_PUBLIC_` for secrets.
- Do not use `SUPABASE_SERVICE_ROLE_KEY` from client.
- Do not call AI providers from client components.
- Do not disable RLS.
- Do not use `any` to suppress type errors.
- Do not add `eslint-disable` without reason.
- Do not delete or skip tests to pass CI.
- Do not add buy/sell recommendation wording.

## Run log

Agent work is recorded in `docs/agent-runs/`.

## Skill policy

Recurring agent procedures should be documented as reusable skills.

See `AGENTS.md` and `.github/instructions/` for path-specific rules.
