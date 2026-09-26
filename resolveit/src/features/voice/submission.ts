import { submitIncident } from "@/features/incidents/client";
import type { IncidentSubmissionResult } from "@/features/incidents/client";
import { VoiceIncidentSubmissionSchema } from "./schema";

export class IncompleteVoiceDraftError extends Error {
  constructor(readonly fields: string[]) {
    super("Complete the required incident details before submitting.");
    this.name = "IncompleteVoiceDraftError";
  }
}

/**
 * Submits a voice incident automatically.
 *
 * The voice draft may contain internal voice-only fields such as
 * transcript/source. We remove those before validating against
 * the incident API schema.
 */
export async function submitVoiceIncidentDraft(
  draft: unknown,
  fetcher: typeof fetch = fetch,
): Promise<IncidentSubmissionResult> {
  if (
    typeof draft !== "object" ||
    draft === null ||
    Array.isArray(draft)
  ) {
    throw new IncompleteVoiceDraftError([
      "incident",
    ]);
  }

  const raw = draft as Record<string, unknown>;

  const apiPayload = {
    title: raw.title ?? null,
    description: raw.description ?? null,
    category: raw.category ?? null,
    affectedUsers: raw.affectedUsers ?? null,
    businessImpact: raw.businessImpact ?? null,
    urgency: raw.urgency ?? null,
    source: "voice" as const,
    affectedSystem: raw.affectedSystem ?? null,
    symptoms: raw.symptoms ?? null,
    startedAt: raw.startedAt ?? null,
    currentlyAffected: raw.currentlyAffected ?? null,
    errorMessages: Array.isArray(raw.errorMessages)
      ? raw.errorMessages
      : [],
    troubleshootingAttempted: Array.isArray(
      raw.troubleshootingAttempted,
    )
      ? raw.troubleshootingAttempted
      : [],
  };

  const parsed =
    VoiceIncidentSubmissionSchema.safeParse(
      apiPayload,
    );

  if (!parsed.success) {
    const fields = [
      ...new Set(
        parsed.error.issues.map((issue) =>
          String(issue.path[0]),
        ),
      ),
    ];

    throw new IncompleteVoiceDraftError(fields);
  }

  return submitIncident(
    parsed.data,
    fetcher,
  );
}