import "server-only";
import { decideIncident } from "@/features/decisions/engine";
import type { IncidentAnalyzer } from "@/features/incidents/http";
import { investigateIncident } from "@/server/investigation/openAiInvestigator";
import { getIncidentService } from "./service";

/**
 * Incident → AI investigation → deterministic decision → stored result.
 * Escalation decisions move the incident to ESCALATED so the IT queue surfaces it.
 */
export const runIncidentWorkflow: IncidentAnalyzer = async (incident) => {
  const investigation = await investigateIncident(incident);
  const decision = decideIncident(incident, investigation);
  const workflow = { investigation, decision };

  try {
    const updated = await getIncidentService().recordWorkflow(incident.id, investigation, decision);
    return { incident: updated ?? incident, workflow };
  } catch (error) {
    // The incident is already saved; report the decision even if storing it failed.
    console.error("Incident workflow result could not be stored.", error);
    return { incident, workflow };
  }
};
