import "server-only";
import { normalizePhoneNumber } from "@/server/phone/phoneNumber";
import { TRANSFER_MODES, type TransferMode } from "@/server/phone/vapiWebhook";

function transferMode(value: string | undefined): TransferMode {
  return (TRANSFER_MODES as readonly string[]).includes(value ?? "") ? value as TransferMode : "blind-transfer";
}

/** Server-only credentials and configuration. Nothing here may be sent to the browser. */
export const serverEnv = {
  openAiApiKey: process.env.OPENAI_API_KEY,
  databaseUrl: process.env.DATABASE_URL,
  authSecret: process.env.AUTH_SECRET,
  /** Personal IT support line. Used ONLY as the Vapi phone transfer destination; never shown to employees. */
  itSupportPhone: normalizePhoneNumber(process.env.IT_SUPPORT_PHONE) ?? undefined,
  /** Shared secret Vapi sends with every webhook request (Bearer token or X-Vapi-Secret). */
  vapiWebhookSecret: process.env.VAPI_WEBHOOK_SECRET?.trim() || undefined,
  /** How Vapi hands the live call to IT: blind (default) or a warm mode (requires Twilio numbers). */
  vapiTransferMode: transferMode(process.env.VAPI_TRANSFER_MODE?.trim()),
  /** The public ResolveIT AI phone line employees call. Safe to display. */
  resolveItAiPhoneNumber: process.env.RESOLVEIT_AI_PHONE_NUMBER?.trim() || undefined,
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
