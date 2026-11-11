# Movie Memory

A small app for saving a favorite movie and discovering a fun fact about it.
Built with TypeScript, Next.js App Router, React, Tailwind CSS, Postgres, and Prisma.

## Current progress

Google OAuth, database-backed sessions, onboarding, and the dashboard are implemented.
The dashboard now requests a fact from a server-only OpenAI integration and saves it to
Postgres. The request is limited to 10 seconds with automatic retries disabled. Variant A adds a 60-second database cache, shared in-progress requests within one server
process, and stale fallback on generation failure.

The app-side session flow has been tested against Postgres. Google's real consent and
callback flow still needs verification with a configured OAuth application.

## Chosen variant

**Variant A: backend caching and correctness.**

This keeps the interface small and puts the work into ownership checks, concurrent
requests, and failure handling. It also builds on my experience with backend services
and preventing concurrent RSVP updates in Huddle.

Fact-generation behavior:

- Reuse the newest fact for the current user and movie while its age is under 60 seconds.
- At 60 seconds or later, generate and store a new fact.
- Share one in-progress generation between overlapping requests for the same user and movie.
- If generation fails, return the last saved fact. If there is none, show a friendly error.

See [the build plan](docs/build-plan.md) for the commit sequence and acceptance checks.

## Run locally

Use Node.js 24 LTS, npm, and Postgres 16 or later. With nvm installed, run `nvm use`.

```sh
git clone https://github.com/bkrishnanair/Movie-Memory.git
cd Movie-Memory
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:3000. The landing page, unit tests, and production build work
without service credentials. Database commands require a running Postgres instance
and a valid `DATABASE_URL` in `.env`.

### Database setup

Create an empty database using your local Postgres administrator account or hosted
Postgres provider. For example, on a local installation with the `postgres` role:

```sh
createdb -h localhost -U postgres movie_memory
```

Update `DATABASE_URL` to match that database and its credentials, then apply the
checked-in migration:

```sh
npm run db:deploy
npm run db:generate
```

When intentionally changing the schema during development:

```sh
npm run db:migrate -- --name describe_change
npm run db:generate
```

Use a separate development database for migrations. Generated Prisma files are ignored;
`npm ci`, `npm run typecheck`, and `npm run build` regenerate the client from the schema.

### Environment variables

| Variable | Purpose | Required now? |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string | For authentication and database commands |
| `NEXTAUTH_URL` | Application URL, initially `http://localhost:3000` | For authentication |
| `NEXTAUTH_SECRET` | Session secret | For authentication |
| `GOOGLE_CLIENT_ID` | Google OAuth application ID | For authentication |
| `GOOGLE_CLIENT_SECRET` | Google OAuth application secret | For authentication |
| `OPENAI_API_KEY` | Server-side fact generation | For movie facts |
| `OPENAI_MODEL` | Model available to the configured account | For movie facts |

Never commit `.env` or put secrets in variables prefixed with `NEXT_PUBLIC_`.
The example contains placeholders only.

### Configure Google sign-in

1. In Google Cloud, configure the OAuth consent screen and create a web application
   OAuth client. Add your Google account to the test users while the app is in testing mode.
2. Set `http://localhost:3000` as the authorized JavaScript origin and
   `http://localhost:3000/api/auth/callback/google` as the authorized redirect URI.
3. Copy the client ID and secret into the local `.env`. Generate a session secret with
   `openssl rand -base64 32` and put the result in `NEXTAUTH_SECRET`.
4. Fill in `DATABASE_URL`, apply migrations with `npm run db:deploy`, and restart the app.
5. Open `http://localhost:3000`, sign in, save a movie, log out, and sign in again.
   The second visit should go straight to the dashboard.

Keep the hostname consistent: use `localhost`, not `127.0.0.1`, for this configuration.
For a deployed app, register its HTTPS callback URL and update `NEXTAUTH_URL` accordingly.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

`npm run lint` is available for lint checks. `npm run db:validate` validates the schema
when `DATABASE_URL` is set; it does not connect to the database.

The 58 unit tests cover movie validation, session-based ownership, server-side rejection,
database errors, onboarding routing, profile fallbacks, provider output, and fact persistence. The title length
limit uses JavaScript string length (UTF-16 code units), consistently with HTML input
limits. The onboarding action calls the validator before writing a movie.

Verified for this milestone: unit tests, TypeScript checks, production build, and both
migrations against isolated local Postgres 16. The HTTP smoke check exercises protected routes,
invalid/expired sessions, incomplete/complete onboarding routing, ownership, profile fallback,
and sign-out with CSRF validation. It creates test sessions directly in a disposable database
and cleans up its records afterwards. This does not verify Google's consent or callback flow.

To repeat the HTTP smoke check, migrate a disposable database whose name ends in `_test`
or `_check`. In one terminal, start the app with that database as `DATABASE_URL`, a
`NEXTAUTH_SECRET`, and Google configuration. In another terminal:

```sh
TEST_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/movie_memory_test" \
  node scripts/check-auth.mjs
```

The server and script must use the same test database. The script only accepts a local HTTP
server (`TEST_BASE_URL` defaults to `http://localhost:3000`). For this smoke check alone,
nonempty placeholder Google credentials work because it never contacts Google. Real
Google credentials are required for a person to sign in. Never use test placeholders in
the deployed app.

The runtime dependency audit is clean. The full audit currently reports a moderate
`minimatch` issue through the development lint dependencies; the available automatic fix
did not resolve it. No major-version dependency override has been forced.

## Architecture

One Next.js application owns the pages and server operations. Prisma connects directly
to Postgres; there is no separate backend deployment. `src/lib/db.ts` is server-only
and creates a shared connection pool lazily, so loading the landing page does not require
a database connection.

### Data model

- `User` stores profile details and a nullable `favoriteMovie`. A missing movie means
  onboarding is incomplete; no extra onboarding flag is needed.
- `Account` and `Session` support Google OAuth with database-backed sessions.
  Provider account IDs are unique within each provider. Names and photos are nullable.
- `Fact` stores the owning user, the movie used to generate the text, and a creation time.
  The composite index on `(userId, movie, createdAt DESC)` supports finding the latest
  fact without scanning every user's history.
- Foreign keys prevent orphaned records. Deleting a user also deletes their accounts,
  sessions, and facts. Foreign keys do not replace authorization: server queries must
  still restrict access to the user from the verified session.
- Timestamps use Postgres `timestamptz`, and the Prisma connection uses UTC. This avoids
  treating valid sessions as expired when a local database uses a different timezone.

### Implemented sign-in and onboarding flow

1. The server checks the session. Signed-out visitors see the landing page.
2. Signed-in users without a saved movie go to onboarding, including users who abandoned
   an earlier onboarding attempt. Users with a saved movie go to the dashboard.
3. The server trims and validates the submitted title, then saves it to the session user.
   It does not accept a user ID from the form.
4. The onboarding write is conditional on `favoriteMovie` being null, so concurrent tabs
   cannot overwrite a completed choice. The server invalidates the page data and redirects.
5. The dashboard displays the user's profile and saved movie. Missing names/photos have
   fallbacks; a broken photo also falls back. Logout revokes the database session.

Private pages render dynamically and check their session on each request. The server action
checks it again before writing, even if the user previously opened the form. NextAuth handles
OAuth state/PKCE and CSRF protection for sign-in/sign-out; Next.js handles the server-action
POST and origin checks. Account linking remains at the library's secure default.

`POST /api/fact` reads the user's movie from Postgres, calls OpenAI, saves the result, and
returns it. The request never accepts an owner or movie from the browser. Responses are
private and not cached by the browser. The server reuses a saved fact for 60 seconds and returns stale data on generation failure.

### Tradeoffs

- A title is free text. A movie catalog and title lookup are outside the exercise.
- Each fact stores its own movie title so history remains meaningful if the user changes
  their favorite in a future version.
- The in-progress map is local to one server process. It handles overlapping
  requests there, but cannot coordinate multiple instances or survive a restart. This
  limitation is acceptable for the selected exercise approach and must be revisited before
  scaling out.
- Successful generation does not verify factual accuracy. The app will request concise facts,
  but verified sources would require additional work.

### With two more hours

Replace process-local generation coordination with a database-backed lease if the app needs
multiple instances, add a browser-level regression check for the complete sign-in flow,
and improve how ambiguous movie titles are communicated.
