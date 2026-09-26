import type { IncidentDecision } from "@/features/decisions/engine";
import type { IncidentCategory, IncidentSeverity, IncidentSource, IncidentStatus } from "./types";

/** Display labels shared by every incident view. */

export const categoryLabels: Record<IncidentCategory, string> = {
  ACCOUNT_ACCESS: "Account & access",
  COMPUTER_HARDWARE: "Computer & hardware",
  NETWORK_CONNECTIVITY: "Network & connectivity",
  SOFTWARE_APPLICATIONS: "Software & applications",
  EMAIL_COLLABORATION: "Email & collaboration",
  OTHER: "Other",
};

export const statusLabels: Record<IncidentStatus, string> = {
  OPEN: "Open",
  INVESTIGATING: "In progress",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
};

export const severityLabels: Record<IncidentSeverity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const sourceLabels: Record<IncidentSource, string> = {
  manual: "Form",
  voice: "Browser AI",
  phone: "Phone AI",
};

export const decisionLabels: Record<IncidentDecision["action"], string> = {
  OFFER_RESOLUTION: "Self-service fix suggested",
  CREATE_TICKET: "Ticket queued for IT",
  CREATE_PRIORITIZED_TICKET: "Prioritized ticket for IT",
  ESCALATE_TO_HUMAN: "Escalated to IT support",
};

export function formatDateTime(value: string, style: "medium" | "long" = "medium") {
  return new Intl.DateTimeFormat("en", { dateStyle: style, timeStyle: "short" }).format(new Date(value));
}
