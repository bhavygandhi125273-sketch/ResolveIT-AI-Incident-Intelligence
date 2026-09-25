import type { IncidentRepository } from "./repository";
import type { CreateIncidentInput } from "./validation";
import type { Incident, IncidentSeverity, IncidentStatus, IncidentSummary } from "./types";

/** Initial transparent intake rule. A future decision engine can replace this mapping. */
export function severityForUrgency(urgency: CreateIncidentInput["urgency"]): IncidentSeverity {
  return urgency;
}

export function createIncidentService(repository: IncidentRepository) {
  return {
    async create(input: CreateIncidentInput): Promise<Incident> {
      const severity = severityForUrgency(input.urgency);
      return repository.create(input, severity);
    },
    listRecent(limit?: number): Promise<Incident[]> {
      return repository.listRecent(limit);
    },
    getById(id: string): Promise<Incident | null> {
      return repository.getById(id);
    },
    updateStatus(id: string, status: IncidentStatus): Promise<Incident | null> {
      return repository.updateStatus(id, status);
    },
    getSummary(): Promise<IncidentSummary> {
      return repository.getSummary();
    },
  };
}

export type IncidentService = ReturnType<typeof createIncidentService>;
