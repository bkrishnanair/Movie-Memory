# Build plan

Target session: November 11, 2026, 3:00-6:00 PM America/New_York.
These are planning windows, not recorded work times. Commit each working milestone when
its checks pass; Git records the actual commit time.

## Commit sequence

| Target window | Commit | Done when |
| --- | --- | --- |
| 3:00-3:35 | `Set up application foundation and database schema` | Landing page builds; initial migration applies; movie validation tests pass; setup and remaining plan are documented. |
| 3:35-4:20 | `Add Google sign-in and movie onboarding` | Sign-in creates a user/session; missing movie routes to onboarding; validated movie persists; returning user reaches dashboard; logout and route protection work. |
| 4:20-4:50 | `Generate and save movie facts` | Authenticated requests use the saved movie; OpenAI runs server-side with a timeout; generated text is saved; the dashboard handles loading and errors. |
| 4:50-5:30 | `Cache facts and guard concurrent requests` | Under-60-second facts are reused; simultaneous requests share generation; failures return stale data where available; required cache and authorization tests pass. |
| 5:30-6:00 | `Finish verification and submission documentation` | Fresh setup works; tests, typecheck, and build pass; README describes actual behavior; usage note and submission links are ready. |

## Scope

Complete the base implementation and Variant A only. Use one Next.js app and one Postgres
database. Keep the interface to the landing page, onboarding, and dashboard. Do not add
movie search, ratings, recommendations, inline editing, Redis, or a separate API service.

## First commit

- [x] Next.js App Router, strict TypeScript, React, and Tailwind.
- [x] A responsive landing page with an explicitly unavailable sign-in button.
- [x] Prisma models for users, provider accounts, sessions, and saved facts.
- [x] A migration and a server-only reusable database connection.
- [x] Movie-title validation: trim, require at least one character, maximum 120.
- [x] Unit tests for malformed input and length boundaries.
- [x] README, environment example, and ignored local secrets/build artifacts.

## Second commit

Message: `Add Google sign-in and movie onboarding`.
Implementation, app-side checks, and real Google login are complete.

- [x] Google OAuth route handlers with database sessions and a typed session user ID.
- [x] Sign-in/logout controls, pending states, and friendly errors.
- [x] Session checks on the landing page, onboarding, dashboard, and save action.
- [x] Trim and validate input; derive ownership from the session.
- [x] Persist the first movie without allowing a second tab to overwrite it.
- [x] Show name, email, optional photo, saved movie, and logout on the dashboard.
- [x] Add missing/broken photo and missing name fallbacks.
- [x] Store timezone-aware timestamps and make database connections use UTC.
- [x] Pass 31 unit tests, TypeScript checks, and production build.
- [x] Verify real database sessions, route protection, session expiry, ownership, and logout
  through local HTTP requests using `scripts/check-auth.mjs`.
- [x] Verify the actual Google consent and callback flow with the selected account.

The remaining milestones are recorded below.

## Third commit

Message: `Generate and save movie facts`.

- Server-only OpenAI request with a 10-second timeout, no automatic retries, and a short output limit.
- Authenticated fact endpoint reads the movie from the database and saves the result.
- Dashboard fact display with loading, error, refresh, and retry behavior.
- 45 tests pass, along with TypeScript and production build checks. Provider tests use a mock;
  the live API check is recorded in the final verification section.

## Fourth commit

Message: `Cache facts and guard concurrent requests`.

- Guard the cache lookup and generation with one promise per user and movie.
- Reuse facts younger than 60 seconds; return stale data on failure without changing its age.
- Release the guard on success or failure so later requests can proceed.
- 58 unit tests, TypeScript, and production build pass.
- Live HTTP checks against a local provider fixture pass for concurrency, persistence, cache
  expiry, user isolation, failure, fallback, and retry.

## Acceptance checks for final verification

### Authentication and onboarding

- A signed-out visitor to `/` sees a working Google sign-in button.
- A signed-out visitor to `/dashboard` or onboarding returns to the landing page.
- A signed-in user without a saved movie sees onboarding.
- Whitespace-only, missing, or excessively long input is rejected on the server.
- The submitted movie belongs to the user from the session, never a submitted user ID.
- Returning users see their stored movie, name, email, photo if present, and logout.
- Missing name/photo have sensible display fallbacks.
- Logout ends the session; direct navigation cannot recover private content.

### Facts, caching, and concurrent requests

- Every fact is queried by the session user's ID and their saved movie.
- A fact 59,999 milliseconds old is fresh; a fact exactly 60,000 milliseconds old is expired.
- Two overlapping requests for the same user and movie share one generation.
- Separate users with the same movie do not share cached facts or in-progress work.
- Register in-progress work before yielding control; recheck storage inside the guarded work
  so a request with an earlier cache miss does not unnecessarily regenerate a newly saved fact.
- A failed request clears the in-progress entry so the next request can retry.
- Provider timeout/error returns the latest stored fact without changing its original timestamp.
- Without a stored fact, show a friendly error and a retry path.
- No API secret reaches browser code, logs, or Git history.

### Tests and review

- Use a controlled clock for cache boundaries and a fake provider for deterministic tests.
- Prove authorization for signed-out requests and another user's data.
- Make two requests before a delayed fake provider resolves; assert one call and one saved result.
- Verify failure with and without a saved fact, then prove a subsequent request can succeed.
- Run the real Google sign-in and real provider flow after credentials are configured.
- Record exactly which checks ran and any verification gaps.
- Add the assessment's short tool-use disclosure in the submission documentation, describing
  assistance and human verification plainly. Keep code and commit messages about implementation.

## Learning checkpoints

After each commit, explain one behavior without reading the implementation:

1. Why does `Fact` contain both `userId` and `movie`, and what does its index help find?
2. Why must the server use the session's user ID instead of trusting a hidden form field?
3. What happens if generation succeeds but saving the fact fails?
4. Why does a cache not prevent two requests from starting the same work?
5. What would fail if two server instances each had their own in-progress map?

## Final verification

Message: `Finish verification and submission documentation`.

- 58 unit tests, lint, TypeScript, and production build pass.
- Both migrations and both HTTP smoke scripts passed with isolated Postgres databases.
- Resolved the fact-loading effect lint issue and the PostCSS export warning.
- README contains setup, architecture, limits, tradeoffs, and tool-use disclosure.
- Added an editable submission summary and a one-page PDF.
- Google consent/callback, onboarding, movie persistence, logout, route protection, and return
  to the dashboard were verified in the browser.
- The real OpenAI provider returned `credit_balance_exhausted`; successful live OpenAI
  generation remains unverified. The app returned a friendly error.

All five planned implementation/documentation milestones are represented in local Git.
Only the first milestone has been pushed. Do not describe pending live checks as passed.

## Additional provider change

Message: `Add optional Gemini fact generation`.

- Added explicit `FACT_PROVIDER` selection; OpenAI remains the repository default.
- Configured Gemini locally at the user's request, without automatic fallback to OpenAI.
- Reused the installed SDK with Google's compatible endpoint and a separate server-side key.
- 68 tests, lint, TypeScript, and production build pass.
- Real Gemini generation, database persistence, and cache reuse passed.
- Updated setup and submission notes to distinguish the Gemini demo from the required
  OpenAI integration. All additional commits remain local.
