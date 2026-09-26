import { severityLabels, statusLabels } from "../labels";
import type { IncidentSeverity, IncidentStatus } from "../types";

/** Priority colour scale: low → critical. Each badge also carries its text label. */
export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return <span className={`severity-badge severity-${severity.toLowerCase()}`}>{severityLabels[severity]}</span>;
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{statusLabels[status]}</span>;
}
