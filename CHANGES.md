# What changed

## Bugs and loopholes fixed (each has a regression test in `backend/tests/test_api.py`)
| # | Problem | Fix |
|---|---|---|
| 1 | **Point farming**: delete a habit, re-add it, check in again = points again (4 cycles paid 60 instead of 30) | Check-ins and photo attempts are keyed by habit *type* per day, not by habit id |
| 2 | **Unreachable goal**: daily target 5 with only 2 habits could never be met, so no streak | Target is capped to the habits you actually have |
| 3 | **Lost streak day**: lowering the target after finishing never counted the day | New idempotent `settle_day()` runs on check-in, target change and habit removal; bonus is paid once |
| 4 | **Crash**: a blank name (`"   "`) was accepted, then `/leaderboard` returned HTTP 500 for everyone | Names are trimmed/validated; display-name code is safe |
| 5 | **OTP brute force**: unlimited guesses on a 6-digit code | Code is burned after 5 wrong tries; plus per-IP request limit (SMS-pumping); constant-time compare |
| 6 | **Fail-open production**: unset `APP_ENV` meant everyone's code was `123456`; default JWT secret was public | Anything but `APP_ENV=dev` is production; app refuses to start with a weak/missing `JWT_SECRET` |
| 7 | **Fake photos**: any bytes labelled `image/jpeg` passed | File type is checked from the bytes (magic numbers), not the header |
| 8 | **Re-sending the same photo** with 1 byte changed beat the reuse check | Perceptual hash (Pillow) catches re-compressed / resized copies |
| 9 | **Mock verifier in production**: no Gemini key = every photo accepted | Mock only runs in dev; production without a key returns 503 |
| 10 | **Server freeze**: the blocking Gemini call ran on the event loop, stalling all users | Runs in a thread pool, with a per-user lock so double-taps can't double-pay |
| 11 | **Timezone hopping** could replay a day | "Today" can never move backwards for a user |
| 12 | Unlimited-size uploads parsed before checking | Early request-size guard, 1-file multipart limit |
| 13 | Tied leaderboard scores got arbitrary ranks | Ties share a rank (1, 1, 3) |
| 14 | Onboarding could be "completed" with no name / no habits | Server validates |
| 15 | Stack traces / odd error shapes on unexpected errors | Global handler returns the contract error shape; details only in logs; `/docs` is dev-only; security headers added |
| 16 | `.env.example` had `KEY=   # comment` which python-dotenv reads as the **value** | Comments on their own lines (+ guard in code) |

## Frontend (was a 2-screen stub)
Login (language switch, OTP autofill, resend timer) · 3-step onboarding · Home dashboard (progress ring, streak + freezes, points, next-unlock bar, habit cards with photo/tap check-in, retries dots, confetti) · Calendar · Games hub with locks · Leaderboard (podium, opt-in) · Profile (habits, goal, language, theme, timezone, logout).
Also fixed: no error handling (blank screen on network failure), double-tap double-submit, expired token not returning to login, `localStorage` crashing in private mode, HEIC/unsupported photos.

## Games (they did not exist in the frontend; logic is pure TS with 19 unit tests)
- **Memory Match**: Fisher–Yates shuffle, board locks during a mismatch, double-click on one card can't count as a pair, 3 difficulty levels, best score saved
- **Word Guess**: correct duplicate-letter scoring (two-pass), keyboard colours never downgrade, physical + on-screen keyboard, stats
- **Sudoku**: generator guarantees exactly **one** solution, conflict + mistake highlighting, notes, 3 hints, keyboard support, timer

## Judgement calls (change if you disagree)
- **Photo fallback is still generous by design**: after 3 failed photos a habit counts as `done_unverified` (5 pts), so determined users can farm it. That is your contract's rule, so I left it. Consider requiring a *different* real photo per attempt or capping unverified habits per day.
- Streak milestone bonuses can be re-earned after a streak is lost (arguably intended).
- Word Guess accepts any 5 letters (no big dictionary shipped); answers come from ~600 common words.
- Games run on the client (per contract), so unlocks are enforced by the UI only. Nothing at stake, since games award no points.
- In-memory store: data resets on restart. Needs a real DB before launch.
