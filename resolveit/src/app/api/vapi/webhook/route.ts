import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/server/config/env";
import { getIncidentService } from "@/server/incidents/service";
import { runIncidentWorkflow } from "@/server/incidents/workflow";
import { handleVapiServerMessage } from "@/server/phone/vapiWebhook";

export const runtime = "nodejs";
// Ticket creation waits for the AI investigation (up to 20s); allow headroom on serverless hosts.
export const maxDuration = 60;

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Vapi phone-channel webhook. Authenticated by a shared secret, never by a user session. */
export async function POST(request: Request) {
  const expected = serverEnv.vapiWebhookSecret;
  if (!expected) {
    return Response.json({ error: "Phone channel is not configured." }, { status: 503 });
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const legacy = request.headers.get("x-vapi-secret");
  if (!secretMatches(bearer, expected) && !secretMatches(legacy, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await handleVapiServerMessage(body, {
      service: getIncidentService(),
      runWorkflow: runIncidentWorkflow,
      itSupportPhone: serverEnv.itSupportPhone,
      transferMode: serverEnv.vapiTransferMode,
    });
    return Response.json(result);
  } catch (error) {
    console.error("Vapi webhook failed.", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
