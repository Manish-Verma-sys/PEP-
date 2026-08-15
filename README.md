# RegWatch — Regulatory Early-Warning System

A full-stack demo app that monitors regulatory signals (FSSAI, FDA, EFSA, Codex),
maps them to R&D focus areas, and generates decision-useful insights per alert.
Built as a product prototype for an R&D technology-intelligence function.

> **Prototype notice:** the bundled dataset is illustrative/fictional so the app
> runs out-of-the-box. Generated insights are intended for human review, not as
> regulatory guidance.

## Live data (real-time)

When REGWATCH_LIVE=true (the default), every page load triggers backend research:
the server asks Gemini with Google Search grounding to find current FDA / EFSA /
FSSAI / Codex developments relevant to food and beverage R&D, returns structured JSON,
and drives all four pages from it - Overview, Alert feed, Portfolio, and Scouting.
Each alert carries a source link for verification. Results are cached ~15 minutes so
refreshes are fast and quota-safe. A seed dataset is the fallback, so the app never
shows a blank page. The same Gemini key powers per-alert analysis.

## What's inside

- **Backend** (`server/`): a small Express server exposing a JSON API and serving the UI.
- **Insight engine** (`server/insights.js`): provider-agnostic. Works with zero config
  using rule-based insights, or calls a remote LLM if you provide a key.
- **Live sources** (`server/sources.js`): optional real-feed layer (openFDA wired in), off by default.
- **Frontend** (`public/`): a single-page app with five screens — Overview, Alert feed,
  Alert detail (with generated analysis), Portfolio impact, Scouting handoff.

## Screens

1. **Overview** — daily radar: critical count, top signals, engine status.
2. **Alert feed** — searchable, filterable list (regulator / severity / focus).
3. **Alert detail** — what changed, exposed SKUs, and a generated analysis fetched live.
4. **Portfolio impact** — exposure aggregated by focus area.
5. **Scouting handoff** — turns a regulatory signal into scouting candidates.

## Run locally

Requires Node 18+.

```bash
npm install
cp .env.example .env      # optional; app works without it
npm start
# open http://localhost:3000
```

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `REGWATCH_API_KEY` | *(empty)* | Your API key. Server-side only, never sent to the browser. |
| `REGWATCH_PROVIDER` | `gemini` | `gemini`, `local` (no key), `anthropic`, or `openai`. |
| `REGWATCH_MODEL` | provider default | Optional model override. |
| `REGWATCH_LIVE` | `false` | `true` enables the live source-fetch layer. |
| `PORT` | `3000` | Render sets this automatically. |

The app runs fully in `local` mode with **no key**. To use an LLM for insights,
set `REGWATCH_PROVIDER` to match your key type and put the key in `REGWATCH_API_KEY`.

## Deploy on Render

1. Push this repo to GitHub.
2. On Render: **New → Web Service**, connect the repo. (The included `render.yaml`
   can also be used via **New → Blueprint**.)
3. Settings: Runtime **Node**, Build `npm install`, Start `npm start`.
4. Under **Environment**, add `REGWATCH_API_KEY` (your Gemini key) and set
   `REGWATCH_PROVIDER=gemini`. **Never** commit the key to the repo — enter it in the dashboard.
   The insight engine calls the Gemini API (`gemini-2.0-flash` by default; override with `REGWATCH_MODEL`).
5. Deploy. Render provides the public URL.

## Security notes

- The API key is only ever read on the server, from an environment variable.
  It is never embedded in client code or sent to the browser.
- `.env` is gitignored. If a key is ever committed or shared, **rotate it.**

## API reference

| Endpoint | Returns |
|---|---|
| `GET /api/health` | engine + live status |
| `GET /api/overview` | headline stats + top signals |
| `GET /api/alerts?reg=&sev=&focus=&q=` | filtered alert list |
| `GET /api/alerts/:id` | one alert |
| `GET /api/alerts/:id/insight` | generated analysis for an alert |
| `GET /api/portfolio` | focus-area exposure aggregation |

## License

MIT — see LICENSE.
