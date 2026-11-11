import "server-only";
import { getDb } from "@/lib/db";
import { generateMovieFact } from "@/lib/openai";
import type { FactResult } from "@/lib/fact-types";

const CACHE_MS = 60_000;
type SavedFact = { id: string; movie: string; text: string; createdAt: Date };

const globalForFacts = globalThis as unknown as {
  movieFactRequests?: Map<string, Promise<FactResult>>;
};
// Shared only within this Node process, including during development hot reloads.
const inProgress = globalForFacts.movieFactRequests ??= new Map<string, Promise<FactResult>>();

function result(fact: SavedFact, source: FactResult["source"]): FactResult {
  return { fact: { id: fact.id, movie: fact.movie, text: fact.text, createdAt: fact.createdAt.toISOString() }, source };
}

export function getFactForUser(userId: string, movie: string): Promise<FactResult> {
  const key = JSON.stringify([userId, movie]);
  const existing = inProgress.get(key);
  if (existing) return existing;

  // Defer the work until after the promise is registered. The guarded lookup always
  // sees the latest saved fact, even if the preceding request has just completed.
  const pending = Promise.resolve().then(async () => {
    const db = getDb();
    const latest = await db.fact.findFirst({
      where: { userId, movie },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const age = latest ? Date.now() - latest.createdAt.getTime() : Infinity;
    if (latest && age >= 0 && age < CACHE_MS) return result(latest, "cached");

    try {
      const text = await generateMovieFact(movie);
      const saved = await db.fact.create({ data: { userId, movie, text } });
      return result(saved, "generated");
    } catch (error) {
      if (latest) return result(latest, "stale");
      throw error;
    }
  }).finally(() => {
    inProgress.delete(key);
  });

  inProgress.set(key, pending);
  return pending;
}
