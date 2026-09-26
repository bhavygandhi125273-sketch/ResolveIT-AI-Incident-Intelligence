import type {
  Incident,
  IncidentStatus,
  IncidentSummary,
} from "./types";
import type { CreateIncidentInput } from "./validation";

/** Persistence boundary: services depend on this contract, not on PostgreSQL. */
export interface IncidentRepository {
  create(
    input: CreateIncidentInput,
    severity: Incident["severity"],
    requesterId?: string,
  ): Promise<Incident>;

  listRecent(
    limit?: number,
    requesterId?: string,
  ): Promise<Incident[]>;

  getById(
    id: string,
    requesterId?: string,
  ): Promise<Incident | null>;

  updateStatus(
    id: string,
    status: IncidentStatus,
  ): Promise<Incident | null>;

  getSummary(): Promise<IncidentSummary>;
}