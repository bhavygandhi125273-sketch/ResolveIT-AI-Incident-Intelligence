// Creates (or resets) a ResolveIT account with a strong random password, printed once.
// Usage:
//   pnpm user:create <email> <EMPLOYEE|IT_ADMIN> "<Display Name>"
// Uses DATABASE_URL from the shell if set, otherwise from .env.local.
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import nextEnv from "@next/env";
import pg from "pg";

const scrypt = promisify(scryptCallback);
nextEnv.loadEnvConfig(process.cwd());

const [emailArg, roleArg, ...nameParts] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const role = roleArg?.trim().toUpperCase();
const displayName = nameParts.join(" ").trim();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["EMPLOYEE", "IT_ADMIN"].includes(role) || !displayName) {
  console.error('Usage: pnpm user:create <email> <EMPLOYEE|IT_ADMIN> "<Display Name>"');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

// Same format as src/server/auth/session.ts: salt:scrypt(password, salt, 64).
const password = randomBytes(12).toString("base64url");
const salt = randomBytes(16).toString("hex");
const passwordHash = `${salt}:${(await scrypt(password, salt, 64)).toString("hex")}`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const result = await client.query(
    `INSERT INTO users (email, password_hash, role, display_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, display_name = EXCLUDED.display_name
     RETURNING (xmax = 0) AS created`,
    [email, passwordHash, role, displayName],
  );
  console.log(`${result.rows[0].created ? "Created" : "Updated"} ${role} account for ${email}.`);
  console.log(`Password (shown once, store it safely): ${password}`);
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? error.code : "UNKNOWN";
  console.error(code === "42P01" ? "The users table does not exist. Run `pnpm db:migrate` first." : `Failed. Error code: ${code}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
