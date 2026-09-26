export const INCIDENT_CATEGORIES = [
  "ACCOUNT_ACCESS",
  "COMPUTER_HARDWARE",
  "NETWORK_CONNECTIVITY",
  "SOFTWARE_APPLICATIONS",
  "EMAIL_COLLABORATION",
  "OTHER",
] as const;

export const INCIDENT_STATUSES = ["OPEN", "INVESTIGATING", "RESOLVED", "ESCALATED"] as const;
export const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const INCIDENT_URGENCIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
/** manual = web form, voice = browser AI assistant, phone = Vapi phone line. */
export const INCIDENT_SOURCES = ["manual", "voice", "phone"] as const;
export const NOTE_VISIBILITIES = ["PUBLIC", "INTERNAL"] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentUrgency = (typeof INCIDENT_URGENCIES)[number];
export type IncidentSource = (typeof INCIDENT_SOURCES)[number];
export type NoteVisibility = (typeof NOTE_VISIBILITIES)[number];

export type UserReference = { id: string; displayName: string };

/** A persisted incident. Timestamps are ISO 8601 strings at the API boundary. */
export interface Incident {
  id: string;
  /** Human-friendly ticket reference, e.g. INC-000042. */
  reference: string;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  severity: IncidentSeverity;
  affectedUsers: number;
  businessImpact: string;
  urgency: IncidentUrgency;
  source: IncidentSource;
  affectedSystem: string | null;
  symptoms: string | null;
  startedAt: string | null;
  currentlyAffected: boolean | null;
  errorMessages: string[];
  troubleshootingAttempted: string[];
  additionalContext: string | null;
  humanAssistanceRequested: boolean;
  transcript: string | null;
  /** Caller ID for phone incidents (E.164). Null for other sources. */
  callerPhone: string | null;
  requester: UserReference | null;
  assignee: UserReference | null;
  escalatedAt: string | null;
  escalationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentSummary {
  total: number;
  open: number;
  critical: number;
  highPriority: number;
  investigating: number;
  escalated: number;
  resolved: number;
  unassigned: number;
}

export type IncidentEventType = "CREATED" | "INVESTIGATED" | "ESCALATED" | "STATUS_CHANGED" | "ASSIGNED" | "NOTE" | "CALL_TRANSFERRED";

export interface IncidentEvent {
  id: string;
  type: IncidentEventType;
  actor: UserReference | null;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus | null;
  body: string | null;
  visibility: NoteVisibility;
  createdAt: string;
}

export function formatIncidentReference(referenceNumber: number | string): string {
  return `INC-${String(referenceNumber).padStart(6, "0")}`;
}
