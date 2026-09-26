import type { IncidentRepository, PhoneCallOrigin, StoredInvestigation } from "./repository";
import type { CreateIncidentInput } from "./validation";
import type { IncidentListQuery } from "./filters";
import type { IncidentDecision, InvestigationResult } from "@/features/decisions/engine";
import type {
  Incident,
  IncidentEvent,
  IncidentSeverity,
  IncidentStatus,
  IncidentSummary,
  NoteVisibility,
  UserReference,
} from "./types";

/** Identity always comes from the server session, never from the browser. */
export type IncidentViewer = { id: string; role: "EMPLOYEE" | "IT_ADMIN" };

export type IncidentDetail = {
  incident: Incident;
  investigation: StoredInvestigation | null;
  events: IncidentEvent[];
};

export class InvalidAssigneeError extends Error {
  constructor() {
    super("The assignee must be an IT staff member.");
    this.name = "InvalidAssigneeError";
  }
}

/** Initial transparent intake rule. A future decision engine can replace this mapping. */
export function severityForUrgency(
  urgency: CreateIncidentInput["urgency"],
): IncidentSeverity {
  return urgency;
}

/** Employees are always scoped to their own incidents. */
export function requesterScope(viewer: IncidentViewer): string | undefined {
  return viewer.role === "EMPLOYEE" ? viewer.id : undefined;
}

export function createIncidentService(repository: IncidentRepository) {
  return {
    async create(
      input: CreateIncidentInput,
      requesterId?: string,
      phoneCall?: PhoneCallOrigin,
    ): Promise<Incident> {
      const severity = severityForUrgency(input.urgency);
      return phoneCall
        ? repository.create(input, severity, requesterId, phoneCall)
        : repository.create(input, severity, requesterId);
    },

    getByCallId(callId: string): Promise<Incident | null> {
      return repository.getByCallId(callId);
    },

    attachCallTranscript(callId: string, transcript: string): Promise<boolean> {
      return repository.attachCallTranscript(callId, transcript);
    },

    recordCallTransferred(incidentId: string): Promise<void> {
      return repository.recordCallTransferred(incidentId);
    },

    findEmployeeIdByPhone(phoneNumber: string): Promise<string | null> {
      return repository.findEmployeeIdByPhone(phoneNumber);
    },

    list(query?: IncidentListQuery): Promise<Incident[]> {
      return repository.list(query);
    },

    getById(
      id: string,
      requesterId?: string,
    ): Promise<Incident | null> {
      return repository.getById(id, requesterId);
    },

    /** Returns null when the incident does not exist or the viewer may not see it. */
    async getDetail(id: string, viewer: IncidentViewer): Promise<IncidentDetail | null> {
      const incident = await repository.getById(id, requesterScope(viewer));
      if (!incident) return null;
      const [investigation, events] = await Promise.all([
        repository.getLatestInvestigation(id),
        repository.listEvents(id, viewer.role === "IT_ADMIN"),
      ]);
      return { incident, investigation, events };
    },

    recordWorkflow(
      incidentId: string,
      investigation: InvestigationResult,
      decision: IncidentDecision,
    ): Promise<Incident | null> {
      return repository.recordWorkflow(incidentId, investigation, decision);
    },

    updateStatus(
      id: string,
      status: IncidentStatus,
      actorId?: string,
    ): Promise<Incident | null> {
      return repository.updateStatus(id, status, actorId);
    },

    async assign(id: string, assigneeId: string | null, actorId: string): Promise<Incident | null> {
      if (assigneeId) {
        const staff = await repository.listItStaff();
        if (!staff.some((member) => member.id === assigneeId)) throw new InvalidAssigneeError();
      }
      return repository.assign(id, assigneeId, actorId);
    },

    addNote(id: string, body: string, visibility: NoteVisibility, actorId: string): Promise<IncidentEvent | null> {
      return repository.addNote(id, body, visibility, actorId);
    },

    listItStaff(): Promise<UserReference[]> {
      return repository.listItStaff();
    },

    getSummary(): Promise<IncidentSummary> {
      return repository.getSummary();
    },
  };
}

export type IncidentService = ReturnType<typeof createIncidentService>;
