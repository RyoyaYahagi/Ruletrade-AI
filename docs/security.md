# Security

Ruletrade-AI stores investment profiles, rule drafts, answers, AI reviews, and
quality checks as user-owned data. Authentication is not the only boundary:
the MVP branch uses SQLite by default, and Supabase Row Level Security remains
the production-style backstop when `DB_PROVIDER=supabase`.

## SQLite MVP Mode

SQLite mode is intended for MVP development without Docker or Supabase Auth. It
uses a server-side development user and stores data in
`.data/ruletrade-mvp.sqlite` by default.

SQLite does not provide Supabase RLS, so API routes and services must keep
explicit `user_id` filters for user-owned records. Browser code must not open
the SQLite database directly. Server-only database modules remain the boundary
for rule drafts, AI reviews, rate-limit counters, cost counters, and logs.

## Row Level Security

When `DB_PROVIDER=supabase`, the rule creation tables use policies scoped to
the `authenticated` role:

- `app_users`
- `investor_profiles`
- `rule_design_sessions`
- `rule_versions`
- `rule_questions`
- `rule_answers`
- `rule_reviews`
- `rule_quality_checks`

Users can only read and write rows they own. For `app_users`, ownership is
`id = auth.uid()`. For the other rule creation tables, ownership is
`user_id = auth.uid()`.

Insert policies use `with check` so a user cannot create a row for another
user. Update policies use both `using` and `with check` so a user cannot update
another user's row or change an owned row to another owner.

Rule creation tables allow delete for development and MVP workflow cleanup,
except `app_users` and `investor_profiles`. Account and profile deletion should
go through an explicit account lifecycle flow.

## API Ownership Checks

RLS is the database-level backstop only in Supabase mode. API routes and server
actions should always use `requireUser` and resource ownership checks for
important operations so the app can return intentional errors, write audit logs,
and avoid relying on database policy alone for user experience.

Service-role access bypasses RLS. Modules that use service-role credentials must
stay server-only, must not be imported from browser code, and should perform
explicit authorization before touching user-owned resources.

## Manual Verification

Use `tests/safety/rule_creation_rls_checks.sql` to inspect enabled RLS,
policies, and policy indexes when running the Supabase path.

Behavioral RLS checks require two real authenticated users. Supabase SQL editor
queries may run with elevated privileges, so confirm row isolation through the
app or a Supabase client using anon/authenticated tokens.
