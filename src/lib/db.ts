import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { db?: PrismaClient };

export function getDb(): PrismaClient {
  if (globalForDb.db) return globalForDb.db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to connect to Postgres.");
  }

  // Reuse the pool across requests and development hot reloads.
  globalForDb.db = new PrismaClient({
    // Prisma's date decoder expects Postgres to return timestamps in UTC.
    adapter: new PrismaPg({ connectionString, options: "-c timezone=UTC" }),
  });

  return globalForDb.db;
}
