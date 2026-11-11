import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.TEST_DATABASE_URL;
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
if (!databaseUrl) throw new Error("Set TEST_DATABASE_URL to a migrated, disposable test database.");
const database = new URL(databaseUrl);
const base = new URL(baseUrl);
if (!["localhost", "127.0.0.1"].includes(base.hostname) || base.protocol !== "http:") {
  throw new Error("Run the smoke check against a local HTTP server only.");
}
if (!/_(test|check)$/.test(database.pathname)) {
  throw new Error("The disposable database name must end in _test or _check.");
}

const client = new pg.Client({ connectionString: databaseUrl });
const userA = `check-${randomUUID()}`;
const userB = `check-${randomUUID()}`;
const tokenA = randomUUID();
const tokenB = randomUUID();
const expiredToken = randomUUID();

async function request(path, token, init = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("Cookie", `next-auth.session-token=${token}`);
  return fetch(new URL(path, base), { ...init, headers, redirect: "manual" });
}

async function expectRedirect(path, token, destination) {
  const response = await request(path, token);
  // Next.js can send a redirect in the HTML after streaming has started.
  if (response.status === 200) {
    const html = await response.text();
    const refresh = html.match(/<meta[^>]+http-equiv="refresh"[^>]+content="[^";]*;url=([^"]+)"/);
    assert.equal(refresh?.[1], destination, `${path}: expected a streamed redirect`);
    return;
  }
  assert.equal(response.status, 307, path);
  assert.equal(new URL(response.headers.get("location"), base).pathname, destination);
}

await client.connect();
try {
  await client.query(
    'INSERT INTO "User" ("id", "name", "email", "favoriteMovie", "updatedAt") VALUES ($1, NULL, $2, NULL, NOW()), ($3, $4, $5, $6, NOW())',
    [userA, "new@example.test", userB, "Returning viewer", "returning@example.test", "Arrival"],
  );
  await client.query(
    'INSERT INTO "Session" ("id", "sessionToken", "userId", "expires") VALUES ($1, $2, $3, NOW() + INTERVAL \'1 hour\'), ($4, $5, $6, NOW() + INTERVAL \'1 hour\'), ($7, $8, $3, NOW() - INTERVAL \'1 hour\')',
    [randomUUID(), tokenA, userA, randomUUID(), tokenB, userB, randomUUID(), expiredToken],
  );

  await expectRedirect("/dashboard", null, "/");
  await expectRedirect("/onboarding", null, "/");
  await expectRedirect("/dashboard", "invalid-session", "/");
  await expectRedirect("/dashboard", expiredToken, "/");
  const newUserSession = await (await request("/api/auth/session", tokenA)).json();
  assert.equal(newUserSession.user?.id, userA, "new user's database session should be valid");
  await expectRedirect("/", tokenA, "/onboarding");
  await expectRedirect("/dashboard", tokenA, "/onboarding");
  assert.equal((await request("/onboarding", tokenA)).status, 200);
  await expectRedirect("/", tokenB, "/dashboard");
  await expectRedirect("/onboarding", tokenB, "/dashboard");

  const session = await (await request("/api/auth/session", tokenB)).json();
  assert.equal(session.user.id, userB);
  assert.equal(session.user.email, "returning@example.test");

  const dashboard = await (await request(`/dashboard?userId=${userA}`, tokenB)).text();
  assert.ok(dashboard.includes("Arrival"));
  assert.ok(dashboard.includes("returning@example.test"));
  assert.ok(!dashboard.includes("new@example.test"));

  // Complete onboarding in the test fixture, then verify a new request reads the DB.
  await client.query('UPDATE "User" SET "favoriteMovie" = $1 WHERE "id" = $2', ["Interstellar", userA]);
  const updated = await (await request("/dashboard", tokenA)).text();
  assert.ok(updated.includes("Interstellar"));
  assert.ok(updated.includes("Movie fan"));
  assert.ok(!updated.includes("Arrival"));

  // Exercise the real sign-out handler with its CSRF cookie and token.
  const csrfResponse = await request("/api/auth/csrf", tokenB);
  const { csrfToken } = await csrfResponse.json();
  const cookies = csrfResponse.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
  const signedOut = await fetch(new URL("/api/auth/signout", base), {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: [`next-auth.session-token=${tokenB}`, ...cookies].join("; "),
    },
    body: new URLSearchParams({ csrfToken, callbackUrl: baseUrl, json: "true" }),
  });
  assert.equal(signedOut.status, 200);
  const remaining = await client.query('SELECT "id" FROM "Session" WHERE "sessionToken" = $1', [tokenB]);
  assert.equal(remaining.rowCount, 0);
  await expectRedirect("/dashboard", tokenB, "/");

  console.log("Auth smoke check passed: protected routes, expired sessions, onboarding routing, ownership, profile fallback, and session revocation.");
  console.log("This uses test database sessions; it does not verify Google's consent or callback flow.");
} finally {
  await client.query('DELETE FROM "User" WHERE "id" IN ($1, $2)', [userA, userB]);
  await client.end();
}
