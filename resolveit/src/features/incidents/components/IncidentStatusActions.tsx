"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INCIDENT_STATUSES, type IncidentStatus } from "../types";

const labels: Record<IncidentStatus, string> = {
  OPEN: "Open",
  INVESTIGATING: "In progress",
  RESOLVED: "Resolved",
  ESCALATED: "Escalated",
};

export function IncidentStatusActions({ incidentId, currentStatus }: { incidentId: string; currentStatus: IncidentStatus }) {
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = useState<IncidentStatus | null>(null);
  const [error, setError] = useState("");

  async function changeStatus(status: IncidentStatus) {
    if (status === currentStatus || pendingStatus) return;
    setPendingStatus(status);
    setError("");
    try {
      const response = await fetch(`/api/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok || !result.success) throw new Error(result.error?.message || "Incident status could not be updated.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Incident status could not be updated.");
    } finally {
      setPendingStatus(null);
    }
  }

  return <div className="incident-status-actions" aria-label="Update incident status">
    {INCIDENT_STATUSES.map((status) => <button type="button" key={status} className={status === currentStatus ? "selected" : ""} disabled={Boolean(pendingStatus)} onClick={() => void changeStatus(status)}>{pendingStatus === status ? "Saving…" : labels[status]}</button>)}
    {error && <p className="incident-action-error" role="alert">{error}</p>}
  </div>;
}
