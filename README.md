# Movie Memory

A small app for saving a favorite movie and discovering a fun fact about it.
Built with TypeScript, Next.js App Router, React, Tailwind CSS, Postgres, and Prisma.

## Current progress

The first milestone provides the landing page, database schema and initial migration,
shared database client, and tested movie-title validation. Google sign-in, onboarding,
the dashboard, and OpenAI integration are planned next. The sign-in button is deliberately
disabled until authentication is connected.

## Chosen variant

**Variant A: backend caching and correctness.**

This keeps the interface small and puts the work into ownership checks, concurrent
requests, and failure handling. It also builds on my experience with backend services
and preventing concurrent RSVP updates in Huddle.

The planned behavior is:

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
| `DATABASE_URL` | Postgres connection string | For database commands |
| `NEXTAUTH_URL` | Application URL, initially `http://localhost:3000` | Next milestone |
| `NEXTAUTH_SECRET` | Session secret | Next milestone |
| `GOOGLE_CLIENT_ID` | Google OAuth application ID | Next milestone |
| `GOOGLE_CLIENT_SECRET` | Google OAuth application secret | Next milestone |
| `OPENAI_API_KEY` | Server-side fact generation | Fact milestone |
| `OPENAI_MODEL` | Model available to the configured account | Fact milestone |

Never commit `.env` or put secrets in variables prefixed with `NEXT_PUBLIC_`.
The example contains placeholders only. Set up Google as a web application with
`http://localhost:3000/api/auth/callback/google` as the authorized redirect URI
for the next milestone.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

`npm run lint` is available for lint checks. `npm run db:validate` validates the schema
when `DATABASE_URL` is set; it does not connect to the database.

The current tests cover trimming, missing or wrongly typed input, whitespace-only titles,
one-character titles, international titles, and the 120-character boundary. The length
limit uses JavaScript string length (UTF-16 code units), consistently with HTML input
limits. Server-side handlers will call the same validator before writing a movie.

First-milestone verification: all 14 unit tests, TypeScript checks, and the production
build passed. The initial migration was applied to an isolated local Postgres 16 database
and deployed again to a second empty database. A database smoke check verified fact lookup,
nullable profile fields, foreign keys, and deletion of a user's dependent facts. The landing
page was also inspected in a browser. Authentication and provider calls have not yet been tested.

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
- `Account` and `Session` prepare for Google OAuth with database-backed sessions.
  Provider account IDs are unique within each provider. Names and photos are nullable.
- `Fact` stores the owning user, the movie used to generate the text, and a creation time.
  The composite index on `(userId, movie, createdAt DESC)` supports finding the latest
  fact without scanning every user's history.
- Foreign keys prevent orphaned records. Deleting a user also deletes their accounts,
  sessions, and facts. Foreign keys do not replace authorization: server queries must
  still restrict access to the user from the verified session.

### Planned request flow

1. The server checks the session. Signed-out visitors see the landing page.
2. Signed-in users without a saved movie go to onboarding, including users who abandoned
   an earlier onboarding attempt. Users with a saved movie go to the dashboard.
3. The server trims and validates the submitted title, then saves it to the session user.
   It does not accept a user ID from the form.
4. Fact requests read that user's movie from Postgres, check the saved fact's age, and
   coordinate generation before calling OpenAI. The browser never receives the API key.
5. The dashboard handles loading, a missing name or photo, stale fallback, and unavailable facts.

### Tradeoffs

- A title is free text. A movie catalog and title lookup are outside the exercise.
- Each fact stores its own movie title so history remains meaningful if the user changes
  their favorite in a future version.
- The planned in-progress map is local to one server process. It handles overlapping
  requests there, but cannot coordinate multiple instances or survive a restart. This
  limitation is acceptable for the selected exercise approach and must be revisited before
  scaling out.
- Successful generation does not verify factual accuracy. The app will request concise facts,
  but verified sources would require additional work.

### With two more hours

Replace process-local generation coordination with a database-backed lease if the app needs
multiple instances, add a browser-level regression check for the complete sign-in flow,
and improve how ambiguous movie titles are communicated.
