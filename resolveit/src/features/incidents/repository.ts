import type { Incident, IncidentStatus, IncidentSummary } from "./types";
import type { CreateIncidentInput } from "./validation";

/** Persistence boundary: services depend on this contract, not on PostgreSQL. */
export interface IncidentRepository {
  create(input: CreateIncidentInput, severity: Incident["severity"]): Promise<Incident>;
  listRecent(limit?: number): Promise<Incident[]>;
  getById(id: string): Promise<Incident | null>;
  updateStatus(id: string, status: IncidentStatus): Promise<Incident | null>;
  getSummary(): Promise<IncidentSummary>;
}
