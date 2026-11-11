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

## Acceptance checks for the remaining work

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

## Before the second commit

Configure a development Postgres connection, a Google OAuth web application, and a session
secret in the local `.env` file. The callback URL is
`http://localhost:3000/api/auth/callback/google`. Add the Google account as a test user
if the OAuth application is in testing mode. Add an OpenAI API key and model before the
fact-generation milestone. Do not put credentials in issues, commits, or screenshots.
