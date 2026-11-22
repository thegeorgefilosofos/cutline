# CUTLINE — The Things We Keep.

> *What ordinary moment would you keep forever?*
> When anything can be generated, what matters is what we choose to keep.

CUTLINE is an interactive exhibition piece. You share an ordinary memory; the system reads it
(light, place, motifs, the words that matter) and interprets it through three artistic directions.
You then direct the final work and keep it in the collection.

## The flow

1. **Memory** — write the moment, optionally a year and your name.
2. **Reading** — the moment is read: light, place, motifs, keywords.
3. **Directions** — three interpretations, rendered live:
   - **I. Afterglow** — an imagined photograph, film grain and date stamp.
   - **II. Index** — a Swiss typographic inventory around a photographic inset.
   - **III. Cut** — the image cut into strips, reassembled out of order, labelled with kept words.
4. **Studio** — you are the creative director: keep or cut words (what you keep changes what the
   image shows), switch direction, crop (4:5 / 1:1 / 16:9 / 3:1), light, grain, accent, and drag
   on the image to move the light and horizon. "Another take" reseeds.
5. **Kept** — a museum wall label with the struck-through memory and a downloadable print (PNG).
6. **Collection** — every kept work, stored locally in the browser.

All artwork is generated on canvas in the browser. Interpretation comes from Hermes via a small server, with a local fallback.

## Run (Windows PowerShell)

Requires Node.js 20 or newer (`node -v`).

```powershell
npm install
Copy-Item .env.example .env
notepad .env        # set NOUS_API_KEY (and optionally NOUS_MODEL), save, close
npm run dev         # API on :8787 + app on http://localhost:5173
```

Production-style (one process serves the built app and the API on http://localhost:8787):

```powershell
npm run build
npm start
```

macOS / Linux: the same commands, with `cp .env.example .env`.

Other scripts: `npm test` (server tests, no key needed), `npm run dev:api`, `npm run dev:web`.

## Hermes (Nous Research) interpretation

The browser never sees the key. It calls our own server, which calls Nous:

- `GET /api/status`: whether `NOUS_API_KEY` is configured (never its value), the model in use,
  Hermes model IDs listed by the authenticated `/v1/models` endpoint, and the last real request's
  outcome. `connected` is `true` only after an authenticated chat completion has succeeded.
- `POST /api/interpret` `{ text, year?, preferences? }`: asks Hermes for three distinct
  directions (one per rendering mode: afterglow, index, cut) as JSON, then validates the shape, the
  allowed lights and motifs, and that every kept word actually appears in the memory. Invalid output gets
  one repair attempt and is never passed to the browser.

Configuration (`.env`, git-ignored; never prefix with `VITE_`):

| Variable | |
|---|---|
| `NOUS_API_KEY` | required for Hermes |
| `NOUS_MODEL` | optional. If empty, a Hermes model is picked from the authenticated models list; nothing is guessed. Open `http://localhost:8787/api/status` to see the IDs your key can use. |
| `NOUS_BASE_URL` | optional, defaults to `https://inference-api.nousresearch.com/v1` |
| `PORT` | optional, defaults to 8787 |

**Fallback.** If the key is missing, the API fails, times out or returns invalid data, the
original deterministic local interpreter is used. The UI always labels the source: *Interpreted by
Hermes · model* or *Local interpreter · Hermes unavailable*. A local result is never shown as AI.

## Hermes Agent (optional, local)

With `INTERPRETER=hermes-agent` in `.env`, the server runs the locally installed Hermes Agent CLI in
one-shot mode (`hermes -z`) instead of calling the Nous API directly. The answer goes through the
same validator; on any failure the app falls back to the local interpreter and says so.

Safety: visitor text is untrusted and `-z` auto-approves tool use, so the server launches the binary
without a shell, with `-t todo`, the most harmless toolset (an in-session task list; no files, terminal, web or browser; configurable via `HERMES_AGENT_TOOLSETS`), `--ignore-rules`, in an
empty temporary folder, with a timeout. `GET /api/status` → `hermesAgent` shows whether it is
installed and whether a real run has succeeded (`verified`), and with which model.

The label reads *Hermes Agent · <model>*, plus *(not a Hermes model)* when the model is not Hermes.

### Setting up Hermes Agent on Windows

Run each line on its own in PowerShell:

```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
hermes portal
hermes -z "Reply with exactly: OK" -t todo
Set-Content -Path .env -Encoding ascii -Value "INTERPRETER=hermes-agent","HERMES_AGENT_PROVIDER=nous","HERMES_AGENT_TOOLSETS=todo","HERMES_AGENT_MODEL=","PORT=8787"
npm run dev
```

- `hermes portal` opens a browser to log in to Nous Portal.
- The `hermes -z` line should answer `OK`.
- Open a **new** PowerShell window after installing Node.js so `node` and `npm` are on the PATH.
- `-t none` is not a valid toolset; `todo` is the most restricted one.

### Verified status (22 Nov 2026, Windows 11)

- Hermes Agent v0.23.3 (Python 3.14), logged in via Nous Portal OAuth.
- A real CUTLINE run through Hermes Agent: three distinct directions, valid JSON on the first attempt,
  about 15 s. The directions changed the artwork's light, motifs and kept words, the kept work and
  PNG print carry the agent's title, and the work stays in the collection after a reload.
- `/api/status` → `hermesAgent.verified: true`, `lastRun.model: anthropic/claude-sonnet-5.5`,
  `hermesModelVerified: false`.
- **Hermes 4 models are not available:** `Hermes-4-405B` and `Hermes-4-70B` return
  "This model has been retired", both via a Nous API key and via Portal OAuth. The agent therefore runs
  on a non-Hermes model, and the app labels it so: *Hermes Agent · anthropic/claude-sonnet-5.5 (not a
  Hermes model)*.

## Structure

- `src/lib/analyze.ts` — the memory interpreter (light, place, motifs, keywords, title)
- `src/lib/render.ts` — the three generative directions and the print renderer
- `src/lib/interpret.ts` — browser client for `/api/interpret` + local fallback
- `server/` — Express API (`app.js`), Nous client (`nous.js`), Hermes Agent adapter (`hermesAgent.js`), response validation (`validate.js`), tests
- `src/components/*` — one component per stage
- `src/styles.css` — the design system (Space Grotesk / DM Mono, ivory, charcoal, vermilion, lime)
