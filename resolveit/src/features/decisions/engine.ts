import type { Incident, IncidentSeverity } from "@/features/incidents/types";

export type InvestigationResult = {
  status: "complete" | "not_configured" | "unavailable";
  summary: string | null;
  possibleCause: string | null;
  impact: string | null;
  recommendedSteps: string[];
  safeToResolve: boolean;
  recommendedResolution: string | null;
  requiresHumanIntervention: boolean;
  humanInterventionReason: string | null;
  missingInformation: string[];
};

export const DECISION_ACTIONS = ["OFFER_RESOLUTION", "CREATE_TICKET", "CREATE_PRIORITIZED_TICKET", "ESCALATE_TO_HUMAN"] as const;

export type IncidentDecision = {
  action: (typeof DECISION_ACTIONS)[number];
  severity: IncidentSeverity;
  explanation: string;
  resolution: string | null;
};

export type IncidentWorkflow = {
  investigation: InvestigationResult;
  decision: IncidentDecision;
};

type DecisionInput = Pick<Incident, "severity"> & Partial<Pick<Incident, "humanAssistanceRequested">>;

function escalate(severity: IncidentSeverity, explanation: string): IncidentDecision {
  return { action: "ESCALATE_TO_HUMAN", severity, explanation, resolution: null };
}

/**
 * AI may assess and suggest; these deterministic rules select the next action, and every
 * outcome carries an explanation that IT can read.
 */
export function decideIncident(incident: DecisionInput, investigation: InvestigationResult): IncidentDecision {
  const { severity } = incident;
  const investigated = investigation.status === "complete";
  const aiReason = investigation.humanInterventionReason ? ` AI assessment: ${investigation.humanInterventionReason}` : "";

  if (severity === "CRITICAL") {
    return escalate(severity, "Critical priority always requires immediate human IT attention.");
  }

  if (severity === "HIGH" || severity === "MEDIUM") {
    if (investigated && investigation.requiresHumanIntervention) {
      return escalate(severity, `The AI investigation determined that human IT intervention is required.${aiReason}`);
    }
    if (!investigated && (severity === "HIGH" || incident.humanAssistanceRequested)) {
      // Without an AI assessment we cannot confirm a high-priority issue is safe to queue.
      return escalate(severity, severity === "HIGH"
        ? "High priority and the AI investigation could not run, so a human must assess it."
        : "Human assistance was requested and the AI investigation could not run.");
    }
    return {
      action: "CREATE_PRIORITIZED_TICKET",
      severity,
      explanation: investigated
        ? "The AI investigation found no need for immediate human intervention; queued for prioritized IT follow-up."
        : "Queued for prioritized IT follow-up.",
      resolution: null,
    };
  }

  if (investigated && investigation.safeToResolve && investigation.recommendedResolution && !investigation.requiresHumanIntervention) {
    return { action: "OFFER_RESOLUTION", severity, explanation: "The investigation found a safe employee-performed resolution to review.", resolution: investigation.recommendedResolution };
  }
  return {
    action: "CREATE_TICKET",
    severity,
    explanation: investigated && investigation.requiresHumanIntervention
      ? `Low priority, but IT needs to handle it.${aiReason}`
      : "No safe resolution was verified; IT follow-up is required.",
    resolution: null,
  };
}
