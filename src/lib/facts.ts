import "server-only";
import { getDb } from "@/lib/db";
import { generateMovieFact } from "@/lib/openai";
import type { FactResult } from "@/lib/fact-types";

export async function getFactForUser(userId: string, movie: string): Promise<FactResult> {
  const text = await generateMovieFact(movie);
  const saved = await getDb().fact.create({ data: { userId, movie, text } });
  return {
    fact: { id: saved.id, movie: saved.movie, text: saved.text, createdAt: saved.createdAt.toISOString() },
    source: "generated",
  };
}
