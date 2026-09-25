import type { Incident } from "./types";
import type { IncidentWorkflow } from "@/features/decisions/engine";

type IncidentApiResponse = {
  success: true;
  data: Incident;
  workflow?: IncidentWorkflow;
} | {
  success: false;
  error: { code: string; message: string; details?: Array<{ field: string; message: string }> };
};

export class IncidentApiError extends Error {
  constructor(message: string, readonly status: number, readonly details?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = "IncidentApiError";
  }
}

export type IncidentSubmissionResult = { incident: Incident; workflow?: IncidentWorkflow };

/** Both manual and voice review submit through the same existing API. */
export async function submitIncident(input: unknown, fetcher: typeof fetch = fetch): Promise<IncidentSubmissionResult> {
  let response: Response;
  try {
    response = await fetcher("/api/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new IncidentApiError("We couldn’t reach the incident service. Check your connection and try again.", 0);
  }

  let result: IncidentApiResponse | null = null;
  try {
    result = await response.json() as IncidentApiResponse;
  } catch {
    // A proxy or interrupted server can return a non-JSON error response.
  }

  if (!response.ok || !result?.success) {
    throw new IncidentApiError(
      result && !result.success ? result.error.message : "We could not save your incident. Please try again.",
      response.status,
      result && !result.success ? result.error.details : undefined,
    );
  }

  return { incident: result.data, ...(result.workflow ? { workflow: result.workflow } : {}) };
}
