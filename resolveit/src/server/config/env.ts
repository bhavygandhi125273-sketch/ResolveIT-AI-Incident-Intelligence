import "server-only";

/** Server-only credentials and database configuration. */
export const serverEnv = {
  openAiApiKey: process.env.OPENAI_API_KEY,
  databaseUrl: process.env.DATABASE_URL,
} as const;

export function requireDatabaseUrl(): string {
  if (!serverEnv.databaseUrl) {
    throw new Error("DATABASE_URL is required to access the incident database.");
  }
  return serverEnv.databaseUrl;
}
