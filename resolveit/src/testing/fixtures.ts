import { vi } from "vitest";
import type { Incident } from "@/features/incidents/types";
import type { IncidentRepository } from "@/features/incidents/repository";

/** A persisted incident with every optional field empty. Override what a test cares about. */
export function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: "8f14e45f-ceea-4e7a-9d4b-0f0f0f0f0f0f",
    reference: "INC-000001",
    title: "Office Wi-Fi is unavailable",
    description: "My laptop cannot connect to the office wireless network.",
    category: "NETWORK_CONNECTIVITY",
    status: "OPEN",
    severity: "MEDIUM",
    affectedUsers: 3,
    businessImpact: "The design team cannot access shared project files.",
    urgency: "MEDIUM",
    source: "manual",
    affectedSystem: null,
    symptoms: null,
    startedAt: null,
    currentlyAffected: null,
    errorMessages: [],
    troubleshootingAttempted: [],
    additionalContext: null,
    humanAssistanceRequested: false,
    transcript: null,
    callerPhone: null,
    requester: null,
    assignee: null,
    escalatedAt: null,
    escalationReason: null,
    createdAt: "2026-09-24T12:00:00.000Z",
    updatedAt: "2026-09-24T12:00:00.000Z",
    ...overrides,
  };
}

export function makeRepository(overrides: Partial<IncidentRepository> = {}): IncidentRepository {
  return {
    create: vi.fn(),
    getByCallId: vi.fn().mockResolvedValue(null),
    attachCallTranscript: vi.fn().mockResolvedValue(false),
    recordCallTransferred: vi.fn().mockResolvedValue(undefined),
    findEmployeeIdByPhone: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    recordWorkflow: vi.fn().mockResolvedValue(null),
    getLatestInvestigation: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue(null),
    assign: vi.fn().mockResolvedValue(null),
    addNote: vi.fn().mockResolvedValue(null),
    listEvents: vi.fn().mockResolvedValue([]),
    listItStaff: vi.fn().mockResolvedValue([]),
    getSummary: vi.fn().mockResolvedValue({
      total: 0, open: 0, critical: 0, highPriority: 0, investigating: 0, escalated: 0, resolved: 0, unassigned: 0,
    }),
    ...overrides,
  };
}
