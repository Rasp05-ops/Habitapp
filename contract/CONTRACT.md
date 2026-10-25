# API Contract (v0.1.0)

Two files are the source of truth. Both teams read them; neither team edits them alone.

| File | What it defines |
|---|---|
| `openapi.yaml` | Every endpoint, request, response and error code |
| `constants.json` | Game numbers: points, streak milestones, game unlocks, limits, habit catalog |

## Rules both sides follow

1. **Contract first.** To change anything, edit `openapi.yaml` / `constants.json`, get a review from the other side, then change code.
2. **Backend:** run `pytest` (it fails if the API's routes differ from the contract).
   **Frontend:** run `npm run gen:types` to regenerate `src/api/schema.d.ts`, then `npm run typecheck` (it fails if the UI uses fields that no longer exist).
3. **Base URL** `/api/v1`. JSON only (plus one multipart upload). Field names are `snake_case`.
4. **Auth:** `Authorization: Bearer <token>`. Phone number + one-time code. The same two calls log in existing users and create new accounts (`is_new_user` tells which). A new user has `name: null` until onboarding calls `PATCH /me`.
5. **Dates:** `YYYY-MM-DD` strings. "Today" and streaks use the **user's timezone** (`Asia/Kolkata` by default). Timestamps are ISO-8601 UTC. The weekly leaderboard always uses IST so everyone shares one week.
6. **Errors:** always `{"error": {"code": "...", "message": "..."}}`. The frontend switches on `code`. `message` is for developers only.
7. **No UI text from the backend.** The API returns codes and keys (`error.code`, `message_key`). All wording and translations (en/hi) live in the frontend `i18n.ts`. Habit and game names are the only localized text the API sends (`{en, hi}`).
8. **Lists are wrapped** in an object (`{"habits": [...]}`) so fields can be added later without breaking clients.
9. **Additive changes** (new optional field, new endpoint) are fine. Renaming, removing, or changing meaning needs a version bump in `info.version`.

## Game rules (numbers are in `constants.json`)

- **Habits:** pick up to 5 presets. Each is `tap` (just press) or `photo` (checked by Gemini).
- **Daily target:** how many habits the student must finish (1 to 5, default 3). Reaching it counts the day for the streak and gives a bonus.
- **Points:** 10 per verified habit, 5 if counted as `done_unverified`. Bonus +20 when the daily target is reached. Streak milestone bonuses at 3, 7, 14, 30 days.
- **Streak:** +1 for each day the target is reached. A missed day uses one of **2 freezes per month** and the streak survives. With no freeze left, the streak resets to 0. `best` is never lost.
- **Photo check:** accepted when Gemini says `ok` with confidence at least 0.7. Up to 3 attempts per habit per day. After the 3rd miss, the habit is counted as `done_unverified` (reduced points, no accusation). If Gemini is down, the API returns `503 VERIFICATION_UNAVAILABLE` and the attempt is **not** used. Re-sending an old photo returns `checkin.retry.reused`. Images are checked and discarded, never stored.
- **Games:** unlock at lifetime points (100 / 300 / 600). Lifetime points never decrease, so unlocks are permanent. Games run on the client; the backend only reports `unlocked`.
- **Leaderboard:** opt-in (`leaderboard_opt_in`, default off). Ranks this week's points, resets Monday 00:00 IST. Shows first name plus last initial only. `me` is null if the student is not opted in or has no points this week.

## Typical screen to endpoint map

| Screen | Calls |
|---|---|
| Login | `POST /auth/otp/request` → `POST /auth/otp/verify` |
| Onboarding (new user) | `PATCH /me` → `GET /habits/catalog` → `POST /habits` (x3) |
| Home | `GET /today` (one call has habits, streak, points, next unlock) |
| Do a habit | `POST /habits/{id}/check-ins` (tap JSON, or photo multipart) |
| Calendar | `GET /history/calendar?month=YYYY-MM` |
| Games | `GET /games` |
| Leaderboard | `GET /leaderboard/weekly` |

## Handling `CheckInResult.status`

| status | Meaning | UI |
|---|---|---|
| `done` | Counted | Celebrate; show `bonuses` if any |
| `done_unverified` | Counted at reduced points | Gentle "nice try" message |
| `retry` | Photo not accepted | Show `message_key` text; `retries_left` tells how many tries remain |
| `already_done` | Nothing changed | Show "already done" |

Every response includes `progress` (streak, points, next unlock), so the UI can update without a second call.
