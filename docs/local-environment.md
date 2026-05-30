# Local Environment

## Supabase Local Stack

```bash
# Start
pnpm supabase:start

# Status
pnpm supabase:status

# Stop
pnpm supabase:stop

# Reset
pnpm supabase:reset
```

## Common Issues

### Node.js version mismatch

Use nvm or fnm:

```bash
nvm use 20
```

### Docker not running

Supabase local requires Docker. Start Docker Desktop or Docker daemon.

### Port conflicts

Supabase uses ports 54321-54326. Kill conflicting processes or change ports in `supabase/config.toml`.

### Migration fails

```bash
pnpm supabase:reset
pnpm supabase:migrate
```

### Missing env vars

Copy from `.env.example` and fill in your keys.

## Seed Data

```bash
pnpm db:seed
```

## Mock Providers

For local development without real AI/Stripe:

```text
MOCK_AI_PROVIDER=true
MOCK_STRIPE=true
```
