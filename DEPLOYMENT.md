# Production Deployment Guide

This guide deploys the application using:

```text
Frontend: Vercel
Backend: Render Web Service
Database: Render PostgreSQL
AI verification: Gemini API
Story videos: YouTube embeds
```

## 1. Repository requirements

Push the latest code to GitHub. The repository should contain:

```text
render.yaml
backend/
  app/
  migrations/
  migrate.py
  requirements.txt
frontend/
  package.json
  vercel.json
contract/
```

Important deployment files:

- [render.yaml](./render.yaml)
- [frontend/vercel.json](./frontend/vercel.json)
- [backend/migrate.py](./backend/migrate.py)
- [backend/migrations/001_initial.sql](./backend/migrations/001_initial.sql)

Do not commit `.env` files, database credentials, JWT secrets, or Gemini keys.

## 2. Create a Gemini API key

Create an API key in Google AI Studio and keep it private.

The key belongs only in Render. Do not put it in:

- Frontend source code
- Vercel environment variables
- GitHub
- `frontend/.env`
- Public documentation

## 3. Prepare seven story videos

The app rotates through seven stories based on the current IST date.

For a YouTube URL such as:

```text
https://www.youtube.com/watch?v=ABC123xyz
```

The video ID is:

```text
ABC123xyz
```

Choose seven videos that:

- You are allowed to embed
- Allow YouTube embedding
- Match the corresponding story and questions
- Are suitable for your audience

The order must match the stories in [rules.py](./backend/app/rules.py).

Example:

```env
STORY_VIDEO_IDS=abc123,def456,ghi789,jkl012,mno345,pqr678,stu901
```

Production refuses to start if fewer than seven video IDs are configured.

## 4. Deploy the Render backend

### Recommended: Render Blueprint

1. Open the Render dashboard.
2. Select **New**.
3. Select **Blueprint**.
4. Connect the GitHub repository.
5. Select the branch containing `render.yaml`.
6. Review the services.
7. Confirm the Blueprint.

The Blueprint provisions:

- A Render web service
- A Render PostgreSQL database
- Database connection configuration
- A generated JWT secret
- Health checks

The backend uses:

```text
Root directory: backend
Runtime: Python
Build command: pip install -r requirements.txt
Start command: python migrate.py && uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health check: /api/v1/health
```

Do not use `uvicorn app.main:app --reload` in production.

### Manual Render setup

If you do not use the Blueprint, create:

1. A Render PostgreSQL database.
2. A Render Python web service.
3. The web service environment variables listed below.

Use the PostgreSQL connection string supplied by Render:

```env
DATABASE_URL=postgresql+psycopg://...
```

Use the internal Render database URL where possible.

## 5. Render environment variables

In the Render backend service, open **Environment → Environment Variables** and add:

```env
APP_ENV=prod
DATABASE_URL=postgresql+psycopg://...
JWT_SECRET=<strong-random-secret>
CORS_ORIGINS=https://your-project.vercel.app
GEMINI_API_KEY=<your-gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash
STORY_VIDEO_IDS=id1,id2,id3,id4,id5,id6,id7
```

Generate a JWT secret locally with PowerShell:

```powershell
py -3.12 -c "import secrets; print(secrets.token_urlsafe(64))"
```

Do not use the development secret:

```text
dev-only-secret-never-use-in-production-0123456789
```

### CORS configuration

Use the exact Vercel frontend origin:

```env
CORS_ORIGINS=https://your-project.vercel.app
```

Do not include:

- A trailing slash
- `/api`
- `/api/v1`
- Quotes
- `*`

Correct:

```env
CORS_ORIGINS=https://habit-hero.vercel.app
```

Multiple trusted frontend domains are comma-separated:

```env
CORS_ORIGINS=https://habit-hero.vercel.app,https://habithero.com
```

## 6. Deploy the Render backend

After setting the Render environment variables:

1. Trigger a deploy.
2. Watch the build logs.
3. Confirm dependencies install.
4. Confirm the migration completes.
5. Confirm Uvicorn starts.
6. Copy the Render service URL.

The start command runs:

```bash
python migrate.py
```

The migration creates:

- `users`
- `habits`
- `checkins`
- `points_ledger`
- `user_state`

Verify the backend:

```text
https://your-render-service.onrender.com/api/v1/health
```

Expected response:

```json
{
  "status": "ok"
}
```

Do not deploy the frontend until this endpoint returns successfully.

## 7. Deploy the Vercel frontend

1. Open the Vercel dashboard.
2. Select **Add New Project**.
3. Import the GitHub repository.
4. Set the project root directory to:

```text
frontend
```

5. Use:

```text
Framework preset: Vite
Build command: npm run build
Install command: npm ci
Output directory: dist
```

The repository already includes [frontend/vercel.json](./frontend/vercel.json).

## 8. Vercel environment variable

In Vercel project settings, add:

```env
VITE_API_BASE=https://your-render-service.onrender.com/api/v1
```

Configure it for the Production environment. Configure Preview as well if preview deployments should use the backend.

Do not add these to Vercel:

```text
DATABASE_URL
JWT_SECRET
GEMINI_API_KEY
```

Those are backend-only secrets.

After changing `VITE_API_BASE`, create a new Vercel deployment because Vite injects it at build time.

## 9. Finish CORS configuration

After Vercel gives you the final URL, update Render:

```env
CORS_ORIGINS=https://your-final-project.vercel.app
```

For a custom domain:

```env
CORS_ORIGINS=https://habithero.com
```

Save the variable and restart or redeploy the Render service.

## 10. Production smoke test

### Backend

```text
[ ] Render build succeeds
[ ] Migration succeeds
[ ] Backend starts
[ ] /api/v1/health returns {"status":"ok"}
[ ] PostgreSQL connection works
[ ] Production API docs are not exposed
[ ] CORS contains the exact Vercel origin
[ ] Gemini key is configured
[ ] Seven story video IDs are configured
```

### Authentication

```text
[ ] Create-account mode works
[ ] Onboarding opens after registration
[ ] Logout works
[ ] Existing user can log in
[ ] Incorrect password is rejected
[ ] Unknown username is not silently registered
```

### Habit tracking

```text
[ ] Habits persist after refresh
[ ] Tap check-ins work
[ ] Photo check-ins reach Gemini
[ ] Invalid photos are rejected
[ ] Daily goal points work
[ ] Streak points work
[ ] Leaderboard data persists
```

### Story feature

```text
[ ] Story page loads
[ ] The correct daily video loads
[ ] Quiz starts locked
[ ] YouTube completion unlocks the quiz
[ ] Three questions are displayed
[ ] Correct answers award 10 points
[ ] Duplicate submissions do not award points twice
[ ] Story progress survives refresh
[ ] A different story appears on the next IST day
```

## 11. Common errors

### `DATABASE_URL must be set`

Add the Render PostgreSQL connection string:

```env
DATABASE_URL=postgresql+psycopg://...
```

### `Production deployments must use PostgreSQL`

Do not use a SQLite URL in production:

```env
DATABASE_URL=sqlite:///...
```

### Browser CORS error

Set Render to the exact frontend origin:

```env
CORS_ORIGINS=https://your-real-vercel-domain.vercel.app
```

Then restart Render.

### `VITE_API_BASE` not working

Check that the URL includes:

```text
/api/v1
```

Then redeploy Vercel.

### Story video is blank

Check:

```env
STORY_VIDEO_IDS=id1,id2,id3,id4,id5,id6,id7
```

Also confirm that the YouTube video allows embedding.

### Gemini verification unavailable

Check:

```env
APP_ENV=prod
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

Then restart Render.

## 12. Recommended production operations

Enable:

- Automated PostgreSQL backups
- Database monitoring
- Render deploy notifications
- Error monitoring such as Sentry
- A paid always-on Render plan for real users
- HTTPS custom domains
- Separate Preview and Production environment variables

Keep the database and backend in the same Render region.

## Final environment summary

### Render

```env
APP_ENV=prod
DATABASE_URL=postgresql+psycopg://...
JWT_SECRET=<random-secret>
CORS_ORIGINS=https://your-project.vercel.app
GEMINI_API_KEY=<gemini-key>
GEMINI_MODEL=gemini-2.5-flash
STORY_VIDEO_IDS=id1,id2,id3,id4,id5,id6,id7
```

### Vercel

```env
VITE_API_BASE=https://your-render-service.onrender.com/api/v1
```

Recommended deployment order:

```text
1. Push code to GitHub
2. Deploy Render backend and PostgreSQL
3. Verify /api/v1/health
4. Deploy Vercel frontend
5. Copy the Vercel URL
6. Set CORS_ORIGINS in Render
7. Restart Render
8. Run the smoke-test checklist
```
