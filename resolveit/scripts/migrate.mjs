import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Copy .env.example to .env.local and configure the local database.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query("CREATE TABLE IF NOT EXISTS resolveit_schema_migrations (name varchar(255) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const applied = await client.query("SELECT name FROM resolveit_schema_migrations");
  const appliedNames = new Set(applied.rows.map((row) => row.name));
  const migrationNames = (await readdir(resolve("database/migrations")))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of migrationNames) {
    if (appliedNames.has(name)) continue;
    const migrationSql = await readFile(resolve("database/migrations", name), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(migrationSql);
      await client.query("INSERT INTO resolveit_schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log("Applied database migration:", name);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  console.log("Database schema is up to date.");
} catch (error) {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "UNKNOWN";
  console.error("Database migration failed. Error code:", code);
  process.exitCode = 1;
} finally {
  await client.end();
}
