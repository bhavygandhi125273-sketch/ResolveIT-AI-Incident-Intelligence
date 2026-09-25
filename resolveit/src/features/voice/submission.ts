import { submitIncident } from "@/features/incidents/client";
import type { IncidentSubmissionResult } from "@/features/incidents/client";
import { VoiceIncidentSubmissionSchema } from "./schema";

export class IncompleteVoiceDraftError extends Error {
  constructor(readonly fields: string[]) {
    super("Complete the required incident details before submitting.");
    this.name = "IncompleteVoiceDraftError";
  }
}

/** Validate the agent's draft, then send it through the existing incident API. */
export async function submitVoiceIncidentDraft(draft: unknown, fetcher: typeof fetch = fetch): Promise<IncidentSubmissionResult> {
  const parsed = VoiceIncidentSubmissionSchema.safeParse(draft);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    throw new IncompleteVoiceDraftError(fields);
  }

  return submitIncident({ ...parsed.data, source: "voice" }, fetcher);
}
