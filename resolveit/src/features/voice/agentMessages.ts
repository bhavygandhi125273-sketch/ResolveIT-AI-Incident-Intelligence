import type { IncidentSubmissionResult } from "@/features/incidents/client";

/**
 * Messages ResolveIT sends back into the live voice call. Vapi client-side tools cannot
 * return a tool result, so the app injects system messages and scripted speech instead.
 */

const FIELD_QUESTIONS: Record<string, string> = {
  title: "a short summary of the problem",
  description: "a clear description of what is happening (at least a full sentence)",
  category: "what kind of issue it is (account and access, computer or hardware, network, software, email and collaboration, or other)",
  affectedUsers: "how many people are affected",
  businessImpact: "how the problem is affecting their work",
  urgency: "how urgent it is (low, medium, high, or critical)",
};

export function describeField(field: string): string {
  return FIELD_QUESTIONS[field] ?? field;
}

/** Tells the agent exactly what is missing so it asks the employee instead of dead-ending. */
export function missingInformationInstruction(fields: string[]): string {
  const needs = fields.map(describeField).join("; ");
  return [
    "RESOLVEIT SYSTEM: The incident was NOT created yet because some required information is missing or invalid.",
    `Still needed: ${needs}.`,
    "Ask the employee for these naturally, one short question at a time. Do not invent answers.",
    "When you have them, call prepare_incident again with ALL fields, including the ones you already collected.",
  ].join(" ");
}

export function forbiddenFieldsInstruction(fields: string[]): string {
  return [
    `RESOLVEIT SYSTEM: Do not include ${fields.join(", ")} in prepare_incident; ResolveIT decides those.`,
    "Call prepare_incident again with only the incident facts.",
  ].join(" ");
}

export const INVALID_DRAFT_INSTRUCTION =
  "RESOLVEIT SYSTEM: The prepare_incident call could not be read. Call prepare_incident again with a single object containing the incident fields.";

export const SUBMISSION_FAILED_INSTRUCTION =
  "RESOLVEIT SYSTEM: ResolveIT could not save the incident because of a system problem. Apologize briefly, tell the employee nothing was lost from the conversation, and ask them to use the manual report form. Do not call prepare_incident again.";

export function isEscalated(result: IncidentSubmissionResult): boolean {
  return result.incident.status === "ESCALATED" || result.workflow?.decision.action === "ESCALATE_TO_HUMAN";
}

/** Spells a reference like INC-000042 so text-to-speech reads each digit. */
export function speakableReference(reference: string): string {
  const digits = reference.replace(/^INC-0*/, "");
  return `I N C ${digits.split("").join(" ")}`;
}

/**
 * The final words spoken before ResolveIT ends a browser call. Browser calls are never
 * transferred, and the IT support number is never spoken or shown to employees.
 */
export function closingSpeech(result: IncidentSubmissionResult): string {
  const reference = speakableReference(result.incident.reference);

  if (isEscalated(result)) {
    return `This needs a person from IT, so I've escalated it to the IT support team as ticket ${reference}. They have everything we discussed and will contact you as soon as possible. You can follow the ticket under My tickets. Goodbye.`;
  }

  const fix = result.workflow?.decision.action === "OFFER_RESOLUTION" && result.workflow.decision.resolution
    ? " There's also a suggested fix you can try, shown on your screen."
    : "";
  return `Your ticket ${reference} has been created and the IT team has the details.${fix} You can follow it under My tickets. Goodbye.`;
}
