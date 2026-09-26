// Links a phone number to a ResolveIT user so Vapi phone calls from that number are
// attributed to them (caller ID). Usage:
//   pnpm db:set-phone <email> <phone>     e.g. pnpm db:set-phone employee@resolveit.local +14155550100
//   pnpm db:set-phone <email> --clear
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const [email, phoneArg] = process.argv.slice(2);

if (!email || !phoneArg) {
  console.error("Usage: pnpm db:set-phone <email> <phone | --clear>");
  process.exit(1);
}

// Same rules as src/server/phone/phoneNumber.ts.
function normalizePhoneNumber(value) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  if (!trimmed.startsWith("+") && digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

const phone = phoneArg === "--clear" ? null : normalizePhoneNumber(phoneArg);
if (phoneArg !== "--clear" && !phone) {
  console.error("That phone number is not valid. Use international format, e.g. +14155550100.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const result = await client.query(
    "UPDATE users SET phone_number = $2 WHERE email = $1 RETURNING role",
    [email.trim().toLowerCase(), phone],
  );
  if (!result.rowCount) {
    console.error("No user with that email.");
    process.exitCode = 1;
  } else {
    console.log(phone ? `Linked phone number to ${email} (${result.rows[0].role}).` : `Cleared phone number for ${email}.`);
  }
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? error.code : "UNKNOWN";
  console.error(code === "23505" ? "That phone number is already linked to another user." : `Update failed. Error code: ${code}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
