import "server-only";

/** Server-only credentials and database configuration. */
export const serverEnv = {
  openAiApiKey: process.env.OPENAI_API_KEY,
  databaseUrl: process.env.DATABASE_URL,
  authSecret: process.env.AUTH_SECRET,
} as const;

export function requireDatabaseUrl(): string {
  if (!serverEnv.databaseUrl) {
    throw new Error("DATABASE_URL is required to access the incident database.");
  }

  return serverEnv.databaseUrl;
}

export function requireAuthSecret(): string {
  if (!serverEnv.authSecret) {
    throw new Error("AUTH_SECRET is required for user authentication.");
  }

  return serverEnv.authSecret;
}