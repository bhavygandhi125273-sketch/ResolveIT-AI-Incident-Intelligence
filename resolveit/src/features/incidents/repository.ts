import type {
  Incident,
  IncidentEvent,
  IncidentStatus,
  IncidentSummary,
  NoteVisibility,
  UserReference,
} from "./types";
import type { CreateIncidentInput } from "./validation";
import type { IncidentListQuery } from "./filters";
import type { IncidentDecision, InvestigationResult } from "@/features/decisions/engine";

export type StoredInvestigation = InvestigationResult & {
  decision: Omit<IncidentDecision, "severity">;
  createdAt: string;
};

/** Server-derived origin of a phone incident. Never taken from request bodies. */
export type PhoneCallOrigin = {
  callId: string;
  callerPhone: string | null;
};

/** Persistence boundary: services depend on this contract, not on PostgreSQL. */
export interface IncidentRepository {
  create(
    input: CreateIncidentInput,
    severity: Incident["severity"],
    requesterId?: string,
    phoneCall?: PhoneCallOrigin,
  ): Promise<Incident>;

  getByCallId(callId: string): Promise<Incident | null>;

  /** Stores the final phone transcript; returns false when the call produced no incident. */
  attachCallTranscript(callId: string, transcript: string): Promise<boolean>;

  recordCallTransferred(incidentId: string): Promise<void>;

  /** Caller-ID lookup for phone calls. Only employee accounts are matched. */
  findEmployeeIdByPhone(phoneNumber: string): Promise<string | null>;

  list(query?: IncidentListQuery): Promise<Incident[]>;

  getById(
    id: string,
    requesterId?: string,
  ): Promise<Incident | null>;

  /** Stores the AI investigation and decision; escalation moves an OPEN incident to ESCALATED. */
  recordWorkflow(
    incidentId: string,
    investigation: InvestigationResult,
    decision: IncidentDecision,
  ): Promise<Incident | null>;

  getLatestInvestigation(incidentId: string): Promise<StoredInvestigation | null>;

  updateStatus(
    id: string,
    status: IncidentStatus,
    actorId?: string,
  ): Promise<Incident | null>;

  assign(
    id: string,
    assigneeId: string | null,
    actorId: string,
  ): Promise<Incident | null>;

  addNote(
    id: string,
    body: string,
    visibility: NoteVisibility,
    actorId: string,
  ): Promise<IncidentEvent | null>;

  listEvents(
    incidentId: string,
    includeInternal: boolean,
  ): Promise<IncidentEvent[]>;

  listItStaff(): Promise<UserReference[]>;

  getSummary(): Promise<IncidentSummary>;
}
