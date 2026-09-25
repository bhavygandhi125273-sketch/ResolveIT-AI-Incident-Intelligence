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

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentUrgency = (typeof INCIDENT_URGENCIES)[number];
export type IncidentSource = "manual" | "voice";

/** A persisted incident. Timestamps are ISO 8601 strings at the API boundary. */
export interface Incident {
  id: string;
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
  transcript: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentSummary {
  total: number;
  open: number;
  highPriority: number;
  resolved: number;
}
