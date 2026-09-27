# Ruletrade-AI

Ruletrade-AI is a personal investment decision journal. It helps you record why you made a decision and compare your current thinking with those notes later. It does not provide investment advice or tell you to buy or sell.

## Run locally

Requirements: Node.js 20 and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The local SQLite database is created at `.data/ruletrade-mvp.sqlite` unless `RULETRADE_DATABASE_PATH` is set. Gemini runs on the server and requires `GEMINI_API_KEY`; `GEMINI_MODEL` selects the model.

## Run persistently on a Tailscale host

On the host machine, with Tailscale already connected, run:

```bash
bash scripts/setup-systemd-tailscale.sh
```

The interactive wizard builds with Node.js 24, rebuilds the SQLite native module for that runtime, installs and enables a systemd service, checks the local app, and configures tailnet-only HTTPS through Tailscale Serve [Tailscale Docs (2026/01), “tailscale serve command”](https://tailscale.com/docs/reference/tailscale-cli/serve). Node.js 20 reached end of life on March 24, 2026, while Node.js 24 is currently listed as LTS [Node.js (2026/09), “Node.js Releases”](https://nodejs.org/en/about/previous-releases), [Node.js (2026/03), “End-Of-Life”](https://nodejs.org/en/about/eol). The repository still specifies Node.js 20 in `.nvmrc` and `package.json`; aligning those project-wide settings and CI with the host wizard is a separate change. This wizard change does not modify them or the existing deployment workflow. The wizard binds the app to loopback and reuses the journal database path from `.env.local` when `RULETRADE_DATABASE_PATH` is set; otherwise, it uses `.data/ruletrade-mvp.sqlite`. The existing `.env.local` must contain `GEMINI_API_KEY` and `GEMINI_MODEL`; the wizard leaves that file untouched. Run the script in a host terminal with access to systemd and `sudo`; it stops if container detection identifies a container or if it cannot reach the systemd manager. It will not install, log in to, reset, or enable Tailscale, and it leaves existing Serve or Funnel settings untouched if they conflict.

Tailscale Serve makes this app reachable only within the tailnet, and the wizard's `--bg` setting keeps the Serve endpoint active across reboots and Tailscale restarts [Tailscale Docs (2026/01), “tailscale serve command”](https://tailscale.com/docs/reference/tailscale-cli/serve). The wizard does not configure public Funnel access.

The host must remain powered on, awake, and connected to Tailscale for the app to be reachable. The wizard does not change the host's power settings.

## Record and review

The home page accepts text or a voice recording. Ruletrade-AI prepares a structured draft for you to confirm before saving. The app preserves the original text or transcript and stores any answer to an optional follow-up question separately. Extracted fields and AI comparisons are derived data. Each new thought is saved as a separate timeline event.

On a stock page, you can review its decision timeline, compare a current thought with the full recorded history for that stock, and record transactions. `/transactions` shows the full transaction history. Unknown transaction prices remain empty. If an execution date was not in the original input, the confirmation form shows a date for you to confirm or change. AI output is limited to organizing notes and comparing your own past and current thinking; it does not make investment decisions.

You can set an optional review date when saving a decision. Due reviews appear when you open the app; the MVP does not send push, email, or scheduled notifications.

## Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

See [docs/architecture.md](docs/architecture.md) for the data model and application flow.

## Sources

[Tailscale Docs, 2026/01] Tailscale. "tailscale serve command." Tailscale Docs. https://tailscale.com/docs/reference/tailscale-cli/serve

[Node.js, 2026/09] Node.js. "Node.js Releases." Node.js. https://nodejs.org/en/about/previous-releases

[Node.js, 2026/03] Node.js. "End-Of-Life." Node.js. https://nodejs.org/en/about/eol
