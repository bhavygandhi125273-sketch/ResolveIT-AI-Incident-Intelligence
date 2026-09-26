import type { IncidentRepository } from "./repository";
import type { CreateIncidentInput } from "./validation";
import type {
  Incident,
  IncidentSeverity,
  IncidentStatus,
  IncidentSummary,
} from "./types";

/** Initial transparent intake rule. A future decision engine can replace this mapping. */
export function severityForUrgency(
  urgency: CreateIncidentInput["urgency"],
): IncidentSeverity {
  return urgency;
}

export function createIncidentService(repository: IncidentRepository) {
  return {
    async create(
      input: CreateIncidentInput,
      requesterId?: string,
    ): Promise<Incident> {
      const severity = severityForUrgency(input.urgency);
      return repository.create(input, severity, requesterId);
    },

    listRecent(
      limit?: number,
      requesterId?: string,
    ): Promise<Incident[]> {
      return repository.listRecent(limit, requesterId);
    },

    getById(
      id: string,
      requesterId?: string,
    ): Promise<Incident | null> {
      return repository.getById(id, requesterId);
    },

    updateStatus(
      id: string,
      status: IncidentStatus,
    ): Promise<Incident | null> {
      return repository.updateStatus(id, status);
    },

    getSummary(): Promise<IncidentSummary> {
      return repository.getSummary();
    },
  };
}

export type IncidentService = ReturnType<typeof createIncidentService>;