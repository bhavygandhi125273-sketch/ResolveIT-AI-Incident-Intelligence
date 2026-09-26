import { IncidentApiError, type IncidentSubmissionResult } from "@/features/incidents/client";
import {
  closingSpeech,
  forbiddenFieldsInstruction,
  INVALID_DRAFT_INSTRUCTION,
  missingInformationInstruction,
  SUBMISSION_FAILED_INSTRUCTION,
} from "./agentMessages";
import { IncompleteVoiceDraftError, submitVoiceIncidentDraft } from "./submission";

export type DraftOutcome =
  /** Ticket created: speak `speech`, then end the call. */
  | { kind: "created"; result: IncidentSubmissionResult; speech: string }
  /** Not submitted yet: send `instruction` so the agent asks follow-up questions. */
  | { kind: "needs-info"; fields: string[]; instruction: string }
  /** System failure: tell the agent, and offer the manual form in the UI. */
  | { kind: "failed"; message: string; instruction: string };

type Options = {
  submit?: typeof submitVoiceIncidentDraft;
};

/**
 * Turns one prepare_incident tool call into an outcome. Complete drafts are submitted
 * automatically — there is no employee confirmation step.
 */
export async function processIncidentDraft(
  rawDraft: unknown,
  transcript: string,
  { submit = submitVoiceIncidentDraft }: Options = {},
): Promise<DraftOutcome> {
  if (!rawDraft || typeof rawDraft !== "object" || Array.isArray(rawDraft)) {
    return { kind: "needs-info", fields: [], instruction: INVALID_DRAFT_INSTRUCTION };
  }

  try {
    const result = await submit({ ...rawDraft, ...(transcript ? { transcript } : {}) });
    return { kind: "created", result, speech: closingSpeech(result) };
  } catch (error) {
    if (error instanceof IncompleteVoiceDraftError) {
      return {
        kind: "needs-info",
        fields: error.fields,
        instruction: error.problem === "forbidden"
          ? forbiddenFieldsInstruction(error.fields)
          : missingInformationInstruction(error.fields),
      };
    }

    // A validation error from the server means the agent can still fix the draft.
    if (error instanceof IncidentApiError && error.status === 400 && error.details?.length) {
      const fields = [...new Set(error.details.map((detail) => detail.field.split(".")[0]))];
      return { kind: "needs-info", fields, instruction: missingInformationInstruction(fields) };
    }

    const message = error instanceof IncidentApiError && error.status === 401
      ? "Your session has expired. Sign in again, then report the issue."
      : "ResolveIT could not save the incident. Please use the manual report form.";
    return { kind: "failed", message, instruction: SUBMISSION_FAILED_INSTRUCTION };
  }
}
