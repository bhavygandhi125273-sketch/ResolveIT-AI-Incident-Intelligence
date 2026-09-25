import type { Incident, IncidentSeverity } from "@/features/incidents/types";

export type InvestigationResult = {
  status: "complete" | "not_configured" | "unavailable";
  summary: string | null;
  safeToResolve: boolean;
  recommendedResolution: string | null;
  missingInformation: string[];
};

export type IncidentDecision = {
  action: "OFFER_RESOLUTION" | "CREATE_TICKET" | "CREATE_PRIORITIZED_TICKET" | "ESCALATE_TO_HUMAN";
  severity: IncidentSeverity;
  explanation: string;
  resolution: string | null;
};

export type IncidentWorkflow = {
  investigation: InvestigationResult;
  decision: IncidentDecision;
};

/** AI may suggest a resolution; only deterministic rules select the next action. */
export function decideIncident(incident: Pick<Incident, "severity">, investigation: InvestigationResult): IncidentDecision {
  if (incident.severity === "CRITICAL") {
    return { action: "ESCALATE_TO_HUMAN", severity: incident.severity, explanation: "Critical urgency requires immediate human IT attention.", resolution: null };
  }
  if (incident.severity === "HIGH" || incident.severity === "MEDIUM") {
    return { action: "CREATE_PRIORITIZED_TICKET", severity: incident.severity, explanation: "This incident requires prioritized IT follow-up.", resolution: null };
  }
  if (investigation.status === "complete" && investigation.safeToResolve && investigation.recommendedResolution) {
    return { action: "OFFER_RESOLUTION", severity: incident.severity, explanation: "The investigation found a safe employee-performed resolution to review.", resolution: investigation.recommendedResolution };
  }
  return { action: "CREATE_TICKET", severity: incident.severity, explanation: "No safe resolution was verified; IT follow-up is required.", resolution: null };
}
