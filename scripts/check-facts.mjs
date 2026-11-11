import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import pg from "pg";

const databaseUrl = process.env.TEST_DATABASE_URL;
const base = new URL(process.env.TEST_BASE_URL ?? "http://localhost:3000");
if (!databaseUrl || !/_(test|check)$/.test(new URL(databaseUrl).pathname)) {
  throw new Error("Set TEST_DATABASE_URL to a disposable database ending in _test or _check.");
}
if (!["localhost", "127.0.0.1"].includes(base.hostname) || base.protocol !== "http:") {
  throw new Error("Run the smoke check against a local HTTP server only.");
}

let calls = 0;
let fail = false;
const provider = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/v1/responses") {
    response.writeHead(404).end();
    return;
  }
  calls += 1;
  response.setHeader("Content-Type", "application/json");
  if (fail) {
    response.writeHead(500).end(JSON.stringify({ error: { message: "Private fixture error", type: "server_error" } }));
    return;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString());
  const { movie } = JSON.parse(payload.input);
  await new Promise((resolve) => setTimeout(resolve, 150));
  response.end(JSON.stringify({
    id: `resp_${randomUUID()}`, object: "response", created_at: Math.floor(Date.now() / 1000), status: "completed",
    model: "gpt-4.1-mini",
    output: [{ id: `msg_${randomUUID()}`, type: "message", role: "assistant", status: "completed",
      content: [{ type: "output_text", text: `Test fact for ${movie}.`, annotations: [] }] }],
  }));
});
await new Promise((resolve, reject) => {
  provider.once("error", reject);
  provider.listen(4011, "127.0.0.1", resolve);
});

const client = new pg.Client({ connectionString: databaseUrl });
const a = `check-${randomUUID()}`;
const b = `check-${randomUUID()}`;
const tokenA = randomUUID();
const tokenB = randomUUID();

async function fact(token, extra = {}) {
  const response = await fetch(new URL("/api/fact?userId=other&movie=Alien", base), {
    method: "POST", headers: token ? { Cookie: `next-auth.session-token=${token}` } : {}, ...extra,
  });
  return { response, body: await response.json() };
}

await client.connect();
try {
  await client.query(
    'INSERT INTO "User" ("id", "favoriteMovie", "updatedAt") VALUES ($1, $3, NOW()), ($2, $3, NOW())', [a, b, "Arrival"],
  );
  await client.query(
    'INSERT INTO "Session" ("id", "sessionToken", "userId", "expires") VALUES ($1, $2, $3, NOW() + INTERVAL \'1 hour\'), ($4, $5, $6, NOW() + INTERVAL \'1 hour\')',
    [randomUUID(), tokenA, a, randomUUID(), tokenB, b],
  );
  assert.equal((await fact(null)).response.status, 401);
  assert.equal(calls, 0);
  const [first, second] = await Promise.all([fact(tokenA), fact(tokenA)]);
  assert.equal(first.response.status, 200);
  assert.equal(first.body.source, "generated");
  assert.equal(first.body.fact.id, second.body.fact.id);
  assert.equal(first.body.fact.movie, "Arrival");
  assert.equal(calls, 1, "overlapping requests must make one provider call");
  const storedA = await client.query('SELECT "id" FROM "Fact" WHERE "userId" = $1', [a]);
  assert.equal(storedA.rowCount, 1);

  assert.equal((await fact(tokenA)).body.source, "cached");
  assert.equal(calls, 1);
  const other = await fact(tokenB);
  assert.notEqual(other.body.fact.id, first.body.fact.id);
  assert.equal(calls, 2, "a different user needs their own fact");

  await client.query('UPDATE "Fact" SET "createdAt" = NOW() - INTERVAL \'61 seconds\' WHERE "userId" = $1', [a]);
  const regenerated = await fact(tokenA);
  assert.equal(regenerated.body.source, "generated");
  assert.notEqual(regenerated.body.fact.id, first.body.fact.id);
  assert.equal(calls, 3);

  await client.query('UPDATE "Fact" SET "createdAt" = NOW() - INTERVAL \'61 seconds\' WHERE "userId" = $1', [a]);
  fail = true;
  const stale = await fact(tokenA);
  assert.equal(stale.response.status, 200);
  assert.equal(stale.body.source, "stale");
  assert.equal(calls, 4, "provider errors must not trigger automatic SDK retries");
  assert.ok(new Date(stale.body.fact.createdAt).getTime() < Date.now() - 60_000);
  const afterFailure = await client.query('SELECT "id" FROM "Fact" WHERE "userId" = $1', [a]);
  assert.equal(afterFailure.rowCount, 2, "failed generation must not save another fact");

  await client.query('DELETE FROM "Fact" WHERE "userId" = $1', [b]);
  const unavailable = await fact(tokenB);
  assert.equal(unavailable.response.status, 503);
  assert.equal(unavailable.body.error, "We couldn't load a movie fact. Please try again.");
  fail = false;
  assert.equal((await fact(tokenB)).body.source, "generated", "a failed request must release the guard");

  const denied = await fact(tokenA, { headers: { Cookie: `next-auth.session-token=${tokenA}`, Origin: "https://another-site.example" } });
  assert.equal(denied.response.status, 403);
  console.log("Fact smoke check passed: ownership, concurrent generation, cache reuse, expiry, stale fallback, provider failure, retry, and origin checks.");
  console.log("Provider responses came from a local fixture; no OpenAI requests were made.");
} finally {
  await client.query('DELETE FROM "User" WHERE "id" IN ($1, $2)', [a, b]);
  await client.end();
  await new Promise((resolve) => provider.close(resolve));
}
