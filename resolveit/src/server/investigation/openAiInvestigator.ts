import "server-only";
import { z } from "zod";
import type { Incident } from "@/features/incidents/types";
import type { InvestigationResult } from "@/features/decisions/engine";
import { serverEnv } from "@/server/config/env";

const investigationSchema = z.object({
  summary: z.string().min(1).max(1500),
  safeToResolve: z.boolean(),
  recommendedResolution: z.string().max(2000).nullable(),
  missingInformation: z.array(z.string().max(200)).max(10),
}).strict();

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    safeToResolve: { type: "boolean" },
    recommendedResolution: { anyOf: [{ type: "string" }, { type: "null" }] },
    missingInformation: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "safeToResolve", "recommendedResolution", "missingInformation"],
} as const;

const unavailable = (status: "not_configured" | "unavailable"): InvestigationResult => ({
  status,
  summary: null,
  safeToResolve: false,
  recommendedResolution: null,
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
          {
            role: "system",
            content: "Investigate this IT incident using only its supplied facts. Give safe employee-performed troubleshooting only when clearly reversible and low-risk. Never claim an action was performed. If important facts are missing, say so. Do not classify severity or create, change, or escalate tickets.",
          },
          { role: "user", content: JSON.stringify(incident) },
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
