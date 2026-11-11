import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Generating types does not require a live database or a connection string.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
