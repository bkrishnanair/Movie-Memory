# Movie Memory

Save a favorite movie, see your Google profile, and discover a short fact about the movie.
Built with TypeScript, Next.js App Router, React, Tailwind CSS, Postgres, Prisma,
Google OAuth, and the OpenAI Responses API.

**Variant A: backend caching and correctness.** I chose this to focus on data ownership,
concurrent requests, and failure handling. It fits my backend experience while keeping
the interface small. Variant B's movie editing and client cache are outside this scope.

[Submission summary](docs/submission.md) · [Build milestones](docs/build-plan.md)

## Run locally

Use Node.js 24 LTS (`nvm use`) and Postgres 16 or later.

```sh
git clone https://github.com/bkrishnanair/Movie-Memory.git
cd Movie-Memory
npm ci
cp .env.example .env
```

Create an empty Postgres database with your local administrator or hosted provider.
For a local installation with the `postgres` role, for example:

```sh
createdb -h localhost -U postgres movie_memory
```

Fill in `.env`, then run:

```sh
npm run db:deploy
npm run dev
```

Open http://localhost:3000. `npm ci` generates the Prisma client. For production mode,
run `npm run build` followed by `npm start`. The landing page and build work without
credentials; signing in and generating facts require the services below.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `NEXTAUTH_URL` | App URL; use `http://localhost:3000` locally |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google web application OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `FACT_PROVIDER` | `openai` (default) or `gemini` |
| `OPENAI_API_KEY` | Required when using OpenAI |
| `OPENAI_MODEL` | Optional; defaults to `gpt-4.1-mini` |
| `GEMINI_API_KEY` | Required when using Gemini |
| `GEMINI_MODEL` | Optional; defaults to `gemini-3.1-flash-lite` |

Keep `.env` out of Git. Never prefix these secrets with `NEXT_PUBLIC_`.

### Optional Gemini setup

The assessment requires OpenAI, so it remains the default and fully implemented path.
For local use without OpenAI credit, set `FACT_PROVIDER=gemini` and `GEMINI_API_KEY`
in `.env`. Restart the app after changing providers. Gemini uses the existing SDK through
[Google's compatibility endpoint](https://ai.google.dev/gemini-api/docs/openai), so no extra
package is needed. It never automatically falls back to OpenAI.

The default Gemini model has a [free tier](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-lite),
subject to the account's quota and billing configuration. No billing setup is performed
by this app. A Gemini-only demonstration does not verify the required OpenAI live path.
The durable cache remains per user/movie; switching providers can reuse an existing fact
until the cache expires.

### Google configuration

Configure a Google OAuth consent screen and a web application OAuth client. While in
testing mode, add the Google accounts that will test the app. Register:

- JavaScript origin: `http://localhost:3000`
- Redirect URI: `http://localhost:3000/api/auth/callback/google`

Use `localhost` consistently. Restart the app after changing credentials. A deployed app
needs its own HTTPS callback and matching `NEXTAUTH_URL`.

### Migrations

`npm run db:deploy` applies the checked-in migrations without changing their history.
For an intentional schema change in a development database:

```sh
npm run db:migrate -- --name describe_change
npm run db:generate
```

## Architecture

### One application and one database

Next.js serves the pages, onboarding server action, and fact endpoint. Prisma connects
to Postgres through a lazily created, shared connection pool. There is no separate
backend service or cache server. Client components handle buttons, form feedback,
profile-photo fallback, and fact loading. Authentication, database access, and provider
calls remain on the server.

| Record | Responsibility |
| --- | --- |
| `User` | Google profile and nullable `favoriteMovie`; null means onboarding is incomplete |
| `Account` | Google provider account linked to a user |
| `Session` | Database-backed session with an expiration time |
| `Fact` | Owner, movie title, generated text, and creation time |

A composite index on `(userId, movie, createdAt DESC)` supports the newest-fact lookup.
Facts keep their movie title independently of the user record. Foreign keys prevent
orphaned records and cascade on user deletion. Timestamps use `timestamptz`, with UTC
connections, so database timezone settings do not shift session expiry or cache ages.

### Authentication and ownership

`src/lib/auth.ts` configures Google OAuth and resolves the current user from the verified
session. The landing page sends users with no saved movie to onboarding and returning
users to the dashboard. Both private pages check authentication on every request.

The onboarding action checks the session again, trims the title, and requires 1-120
characters using JavaScript's UTF-16 length, consistent with the HTML input limit.
It writes only to the session user's record. A conditional update requires the current
movie to be null, preventing two onboarding tabs from overwriting a completed choice.
Missing names or photos have fallbacks; logout revokes the database session.

NextAuth handles OAuth state/PKCE and sign-in/sign-out CSRF protection. Next.js protects
server-action POSTs. `POST /api/fact` rejects a supplied mismatched Origin, authenticates
the request, and reads the saved movie. It never trusts a submitted user ID or movie.
Private responses use `Cache-Control: private, no-store`.

### Cache, concurrency, and failure handling

`src/lib/facts.ts` owns the complete lookup/generation/save operation:

1. Register a shared promise for the current user and movie before asynchronous work begins.
   Overlapping requests in the same Node process reuse that promise.
2. Query the newest stored fact inside that guarded work. If its age is nonnegative and
   less than 60,000 milliseconds, return it. Exactly 60 seconds is expired.
3. Otherwise, request a fact, save it, and return the saved record. Different users have
   separate records and separate in-progress work, even for the same movie.
4. On provider or save failure, return the last saved fact with a stale marker and its
   original timestamp. With no saved fact, return a friendly error. Always release the
   in-progress entry so future requests can retry.

The database is the durable cache. The process-local map holds only unfinished work.
It does **not** coordinate multiple instances or survive a restart; this implementation
assumes one Node process. A distributed deployment needs database-backed coordination.

`src/lib/movie-fact-provider.ts` uses a 10-second timeout, no automatic retries, and a short
output limit. OpenAI uses the Responses API with `store: false`; optional Gemini uses
Google's compatible Chat Completions endpoint. Both validate completed text before saving. Only the movie title is sent as input. The prompt treats it as data,
asks for concise text, and allows an unknown-movie response. Empty, incomplete, unknown,
or oversized results are rejected. Provider details and credentials are not returned
to the browser. React renders fact text normally rather than as HTML.

The dashboard stays usable while facts load. Refresh within the cache window reuses the
fact; loading, stale-data, and retry states are visible. Generated facts are not independently
fact-checked, and a free-text title may be ambiguous.

### Tradeoffs and two more hours

A single Next.js app and process-local coordination keep this assessment small. There is
no movie catalog, editing flow, Redis, or separate backend. The cache limits successful
generation frequency but is not a general rate limiter; repeated failures can retry.

With two more hours, I would prioritize a repeatable browser regression for onboarding,
return visits, and logout, then clearer handling of ambiguous movie titles. Before using
multiple app instances, I would replace the in-progress map with a database-backed lease
and add a test proving coordination between two processes.

## Verification

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

All pass: **68 tests across 7 suites**. Coverage includes validation, authorization,
onboarding routing, persistence, provider output validation, exact cache boundaries,
concurrent requests, user isolation, stale fallback, retry after failure, and explicit
provider selection without automatic fallback.
Both migrations also applied successfully to an empty local Postgres 16 database.

### Repeatable HTTP checks

Use a **disposable** database whose name ends in `_test` or `_check`. Set `DATABASE_URL`
to that database and apply migrations. Start a separate app instance with that database,
a session secret, nonempty Google placeholders, and these test-only provider settings:

```sh
FACT_PROVIDER=openai OPENAI_API_KEY=test-only \
  OPENAI_BASE_URL=http://127.0.0.1:4011/v1 npm start
```

Then, in another terminal with `TEST_DATABASE_URL` set to the same disposable database:

```sh
node scripts/check-auth.mjs
node scripts/check-facts.mjs
```

The scripts create and remove their own records. They accept only a local HTTP server
(`TEST_BASE_URL` defaults to `http://localhost:3000`). The fact script owns a delayed
provider fixture on port 4011 and makes no paid calls. Do not use these placeholder
credentials or provider settings for normal use.

Both HTTP checks passed: real Postgres sessions, route protection, expiry, ownership,
CSRF-validated logout, simultaneous generation, persistence, cache expiry, user isolation,
stale fallback, friendly errors, and recovery. They seed sessions directly and therefore
do not verify Google's consent/callback flow.

**Live service status:** Google consent/callback, first-time onboarding, saving a movie,
logout, signed-out route protection, and returning-user dashboard were verified in the
browser. Gemini generated a real fact, which was saved in Postgres and reused on refresh.
The local demo uses Gemini. The OpenAI live request returned `429 / credit_balance_exhausted`;
successful OpenAI generation remains unverified. Its success and failure paths pass automated
checks with mocked responses and the local HTTP provider fixture.

The production dependency audit is clean. The full audit reports a moderate `minimatch`
issue through development lint dependencies; the automatic fix did not resolve it. No
incompatible major-version override was forced.

## Tool use

- Codex assisted with planning, implementation, test cases, debugging, and documentation.
- Checks included unit tests, type checking, lint, a production build, and HTTP tests
  against Postgres and a local provider fixture. Live-service gaps are recorded above.
- The included build plan lists code paths and questions for reviewing the submitted work.
