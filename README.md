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
