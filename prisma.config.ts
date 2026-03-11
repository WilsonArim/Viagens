
// This file is used by Prisma CLI commands (migrate, generate, studio).
// The dotenv import loads .env for local CLI use only.
// On Vercel, env vars are injected automatically by the platform.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
