import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const { Pool } = pg;

function loadEnvFile() {
  try {
    const content = readFileSync(".env.local", "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const equalsIndex = trimmed.indexOf("=");

      if (equalsIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    throw new Error(
      "Could not read .env.local. Make sure it exists in the project root.",
    );
  }
}

loadEnvFile();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing from .env.local.",
  );
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");

  const derivedKey = scryptSync(
    password,
    salt,
    64,
  );

  return `${salt}:${derivedKey.toString("hex")}`;
}

const users = [
  {
    email: "employee@resolveit.local",
    password: "employee123",
    role: "EMPLOYEE",
    displayName: "ResolveIT Employee",
  },
  {
    email: "it@resolveit.local",
    password: "it123",
    role: "IT_ADMIN",
    displayName: "ResolveIT IT Admin",
  },
];

const pool = new Pool({
  connectionString: databaseUrl,
});

try {
  for (const user of users) {
    const passwordHash = hashPassword(user.password);

    await pool.query(
      `INSERT INTO users
        (email, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email)
       DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         display_name = EXCLUDED.display_name`,
      [
        user.email,
        passwordHash,
        user.role,
        user.displayName,
      ],
    );

    console.log(`Created/updated: ${user.email}`);
  }

  console.log("");
  console.log("ResolveIT test accounts are ready.");
  console.log("");
  console.log("Employee:");
  console.log("  Email: employee@resolveit.local");
  console.log("  Password: employee123");
  console.log("");
  console.log("IT Admin:");
  console.log("  Email: it@resolveit.local");
  console.log("  Password: it123");
} finally {
  await pool.end();
}