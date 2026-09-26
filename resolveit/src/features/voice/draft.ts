import { CreateIncidentSchema, type CreateIncidentInput } from "@/features/incidents/validation";
import { serverOwnedFieldsIn, VoiceIncidentDraftSchema } from "./schema";

export type DraftProblem = "missing" | "forbidden";

/** The draft cannot be submitted yet. `fields` tells the voice agent what to fix. */
export class IncompleteVoiceDraftError extends Error {
  constructor(readonly fields: string[], readonly problem: DraftProblem = "missing") {
    super(problem === "forbidden"
      ? "The draft contains fields that only ResolveIT may set."
      : "Complete the required incident details before submitting.");
    this.name = "IncompleteVoiceDraftError";
  }
}

/**
 * Turns a voice agent's prepare_incident arguments into validated incident input.
 * Shared by the browser assistant and the phone line so both apply identical rules.
 */
export function buildVoiceIncidentInput(draft: unknown, transcript?: string): CreateIncidentInput {
  const forbidden = serverOwnedFieldsIn(draft);
  if (forbidden.length) {
    throw new IncompleteVoiceDraftError(forbidden, "forbidden");
  }

  const normalized = VoiceIncidentDraftSchema.safeParse(draft);
  if (!normalized.success) {
    throw new IncompleteVoiceDraftError(fieldsFromIssues(normalized.error.issues));
  }

  const text = transcript?.trim() ?? "";
  const parsed = CreateIncidentSchema.safeParse({
    ...normalized.data,
    source: "voice",
    ...(text ? { transcript: text.slice(-12000) } : {}),
  });

  if (!parsed.success) {
    throw new IncompleteVoiceDraftError(fieldsFromIssues(parsed.error.issues));
  }

  return parsed.data;
}

function fieldsFromIssues(issues: ReadonlyArray<{ path: PropertyKey[] }>): string[] {
  return [...new Set(issues.map((issue) => String(issue.path[0] ?? "incident")))];
}
