import { submitIncident } from "@/features/incidents/client";
import type { IncidentSubmissionResult } from "@/features/incidents/client";
import { buildVoiceIncidentInput } from "./draft";

export { IncompleteVoiceDraftError, type DraftProblem } from "./draft";

/**
 * Browser gateway from a voice-agent draft to the incident API. Validation is shared with
 * the phone line; a complete draft is submitted automatically.
 */
export async function submitVoiceIncidentDraft(
  draft: unknown,
  fetcher: typeof fetch = fetch,
): Promise<IncidentSubmissionResult> {
  const transcript = draft && typeof draft === "object" && typeof (draft as { transcript?: unknown }).transcript === "string"
    ? (draft as { transcript: string }).transcript
    : undefined;

  return submitIncident(buildVoiceIncidentInput(draft, transcript), fetcher);
}
