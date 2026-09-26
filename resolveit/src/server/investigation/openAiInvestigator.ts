import "server-only";
import { z } from "zod";
import type { Incident } from "@/features/incidents/types";
import type { InvestigationResult } from "@/features/decisions/engine";
import { serverEnv } from "@/server/config/env";

const investigationSchema = z.object({
  summary: z.string().min(1).max(1500),
  possibleCause: z.string().max(1500).nullable(),
  impact: z.string().max(1500).nullable(),
  recommendedSteps: z.array(z.string().min(1).max(500)).max(8),
  safeToResolve: z.boolean(),
  recommendedResolution: z.string().max(2000).nullable(),
  requiresHumanIntervention: z.boolean(),
  humanInterventionReason: z.string().max(1000).nullable(),
  missingInformation: z.array(z.string().max(200)).max(10),
}).strict();

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    possibleCause: nullableString,
    impact: nullableString,
    recommendedSteps: { type: "array", items: { type: "string" } },
    safeToResolve: { type: "boolean" },
    recommendedResolution: nullableString,
    requiresHumanIntervention: { type: "boolean" },
    humanInterventionReason: nullableString,
    missingInformation: { type: "array", items: { type: "string" } },
  },
  required: [
    "summary", "possibleCause", "impact", "recommendedSteps", "safeToResolve",
    "recommendedResolution", "requiresHumanIntervention", "humanInterventionReason", "missingInformation",
  ],
} as const;

const SYSTEM_PROMPT = [
  "Investigate this IT incident using only its supplied facts.",
  "Summarize what may be happening, the possible cause, and the business impact.",
  "List recommended troubleshooting steps for IT, and give a safe employee-performed resolution only when it is clearly reversible and low-risk.",
  "Decide whether human IT intervention is required. Weigh urgency, business impact, number of affected users, symptoms, whether the employee asked for a human, and whether the issue can be safely resolved without IT (for example: security incidents, data loss, outages affecting many users, hardware failure, or access changes require a human). Explain the reason briefly.",
  "Never claim an action was performed. If important facts are missing, say so. Do not classify severity or create, change, or escalate tickets.",
].join(" ");

const unavailable = (status: "not_configured" | "unavailable"): InvestigationResult => ({
  status,
  summary: null,
  possibleCause: null,
  impact: null,
  recommendedSteps: [],
  safeToResolve: false,
  recommendedResolution: null,
  requiresHumanIntervention: false,
  humanInterventionReason: null,
  missingInformation: [],
});

function extractOutputText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  if ("output_text" in payload && typeof payload.output_text === "string") return payload.output_text;
  if (!("output" in payload) || !Array.isArray(payload.output)) return null;
  const text = payload.output.flatMap((item: unknown) => {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) return [];
    return item.content.flatMap((part: unknown) =>
      part && typeof part === "object" && "type" in part && part.type === "output_text" && "text" in part && typeof part.text === "string"
        ? [part.text]
        : [],
    );
  }).join("");
  return text || null;
}

/** Only incident facts are shared with the model — never requester identity or internal IDs. */
function incidentFacts(incident: Incident) {
  return {
    title: incident.title,
    description: incident.description,
    category: incident.category,
    urgency: incident.urgency,
    affectedUsers: incident.affectedUsers,
    businessImpact: incident.businessImpact,
    affectedSystem: incident.affectedSystem,
    symptoms: incident.symptoms,
    startedAt: incident.startedAt,
    currentlyAffected: incident.currentlyAffected,
    errorMessages: incident.errorMessages,
    troubleshootingAttempted: incident.troubleshootingAttempted,
    additionalContext: incident.additionalContext,
    humanAssistanceRequested: incident.humanAssistanceRequested,
    source: incident.source,
    conversationTranscript: incident.transcript?.slice(0, 8000) ?? null,
  };
}

/** Advisory-only investigation. It has no access to ticket, escalation, or database operations. */
export async function investigateIncident(incident: Incident, apiKey = serverEnv.openAiApiKey, fetcher: typeof fetch = fetch): Promise<InvestigationResult> {
  if (!apiKey) return unavailable("not_configured");

  try {
    const response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        store: false,
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(incidentFacts(incident)) },
        ],
        text: { format: { type: "json_schema", name: "incident_investigation", strict: true, schema: responseSchema } },
      }),
    });
    if (!response.ok) return unavailable("unavailable");

    const outputText = extractOutputText(await response.json());
    if (!outputText) return unavailable("unavailable");
    const parsed = investigationSchema.safeParse(JSON.parse(outputText));
    if (!parsed.success || (parsed.data.safeToResolve && !parsed.data.recommendedResolution)) return unavailable("unavailable");
    return { status: "complete", ...parsed.data };
  } catch {
    return unavailable("unavailable");
  }
}
