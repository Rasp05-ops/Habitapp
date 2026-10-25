# Habit Hero (student habit app)

## Production baseline

The backend supports SQLite for local development and PostgreSQL for production through
`DATABASE_URL`. Production must use a managed PostgreSQL database, a strong `JWT_SECRET`,
`APP_ENV=prod`, a real `GEMINI_API_KEY`, and an explicit HTTPS frontend origin.

Before deploying:

1. Create the database and set `DATABASE_URL`.
2. Run the checked-in migrations in `backend/migrations/` against PostgreSQL with your provider's migration tool or `psql`.
3. Set secrets in the hosting provider's secret manager; do not commit `.env`.
4. Build the frontend with `VITE_API_BASE` pointing at the deployed API.
5. Run backend and frontend tests in CI.
6. Enable automated database backups and monitor `/api/v1/health`.

The development server is intentionally not a production server. Use a process manager
or managed web service to run Uvicorn with multiple workers only after the database is
configured.

## Deploy with Vercel + Render

### Render backend

1. Create a Render Blueprint from this repository; [render.yaml](./render.yaml) provisions
   the web service and PostgreSQL database.
2. Set the secret `GEMINI_API_KEY` in Render.
3. Set `CORS_ORIGINS` to the exact Vercel URL, for example
   `https://habit-hero.vercel.app` (comma-separate additional trusted origins).
4. Set `STORY_VIDEO_IDS` to a comma-separated list of approved YouTube video IDs.
   The IDs rotate daily in the order of `STORIES` in `backend/app/rules.py`; provide
   one ID per story to avoid a blank video on any day.
5. Render runs `migrate.py` before Uvicorn and exposes `/api/v1/health` as its health check.

### Vercel frontend

1. Import the repository into Vercel.
2. Set the project root directory to `frontend`; [frontend/vercel.json](./frontend/vercel.json)
   supplies the Vite build settings.
3. Add the Vercel environment variable:
   `VITE_API_BASE=https://<your-render-service>.onrender.com/api/v1`
4. Redeploy after setting the variable.

Do not put `DATABASE_URL`, `JWT_SECRET`, or `GEMINI_API_KEY` in Vercel. They belong only
in Render's backend environment. After the first deploy, verify:

```text
https://<your-render-service>.onrender.com/api/v1/health
```

```
contract/   shared API contract (openapi.yaml + constants.json + CONTRACT.md)  <- unchanged, still the source of truth
backend/    FastAPI, in-memory store, mock Gemini verifier, 18 tests incl. regression tests for every fixed hole
frontend/   React + TypeScript + Vite. Phone: bottom tab bar. Laptop: sidebar. Dark / light / auto theme. EN + हिन्दी
```
See **CHANGES.md** for everything that was fixed and why.

## Run the backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                  # REQUIRED: without APP_ENV=dev the app runs in production mode
uvicorn app.main:app --reload         # http://localhost:8000/docs (dev only)
pytest
```
Dev login: enter any username (3–30 letters, numbers, or underscores) and password (8+ characters). The first use creates the account; repeat use logs in.
Photo checks use a **mock** (a real JPEG/PNG/WebP of 1 KB or more passes) until you set `GEMINI_API_KEY`.

## Run the frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxies /api to :8000). Open it on your phone via your LAN IP too.
npm test             # game-logic unit tests (Memory Match, Word Guess, Sudoku)
npm run build        # typecheck + production build
```

## Going to production checklist
- `APP_ENV=prod`, a random `JWT_SECRET` (the server refuses to start otherwise), `GEMINI_API_KEY`, real `CORS_ORIGINS`
- Plug an SMS provider into `routes/auth.py` (marked TODO), replace `store.py` with Postgres
- Run behind HTTPS and start uvicorn with `--proxy-headers` so the per-IP OTP limit sees real client IPs
- Serve `frontend/dist` and proxy `/api` to the backend (or set `VITE_API_BASE`)
