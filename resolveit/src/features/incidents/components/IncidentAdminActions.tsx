"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INCIDENT_STATUSES, type IncidentStatus, type NoteVisibility, type UserReference } from "../types";
import { statusLabels } from "../labels";

type Props = {
  incidentId: string;
  currentStatus: IncidentStatus;
  assigneeId: string | null;
  staff: UserReference[];
  currentUserId: string;
};

const STATUS_HELP: Record<IncidentStatus, string> = {
  OPEN: "Reported, not started",
  INVESTIGATING: "IT is working on it",
  ESCALATED: "Needs urgent human attention",
  RESOLVED: "Fixed and closed",
};

/** IT-only workflow controls. The server re-checks the IT_ADMIN role on every request. */
export function IncidentAdminActions({ incidentId, currentStatus, assigneeId, staff, currentUserId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("INTERNAL");

  async function update(action: string, body: Record<string, unknown>) {
    if (pending) return false;
    setPending(action);
    setError("");
    try {
      const response = await fetch(`/api/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null) as { success?: boolean; error?: { message?: string } } | null;
      if (!response.ok || !result?.success) {
        throw new Error(result?.error?.message || "The incident could not be updated.");
      }
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The incident could not be updated.");
      return false;
    } finally {
      setPending(null);
    }
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim()) {
      setError("Write a note first.");
      return;
    }
    if (await update("note", { note: { body: note, visibility } })) setNote("");
  }

  return (
    <div className="admin-actions">
      <section aria-labelledby="status-heading">
        <h3 id="status-heading" className="admin-actions-heading">Status</h3>
        <div className="incident-status-actions">
          {INCIDENT_STATUSES.map((status) => (
            <button
              type="button"
              key={status}
              className={status === currentStatus ? "selected" : ""}
              aria-pressed={status === currentStatus}
              disabled={Boolean(pending) || status === currentStatus}
              onClick={() => void update(`status-${status}`, { status })}
            >
              <span className={`status-swatch status-${status.toLowerCase()}`} aria-hidden="true" />
              <span>
                <strong>{pending === `status-${status}` ? "Saving…" : statusLabels[status]}</strong>
                <small>{STATUS_HELP[status]}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="assign-heading">
        <h3 id="assign-heading" className="admin-actions-heading">Assigned to</h3>
        <div className="assign-row">
          <select
            className="admin-select"
            aria-label="Assignee"
            value={assigneeId ?? ""}
            disabled={Boolean(pending)}
            onChange={(event) => void update("assign", { assigneeId: event.target.value || null })}
          >
            <option value="">Unassigned</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>{member.id === currentUserId ? `${member.displayName} (me)` : member.displayName}</option>
            ))}
          </select>
          {assigneeId !== currentUserId && (
            <button type="button" className="admin-secondary-button" disabled={Boolean(pending)} onClick={() => void update("assign", { assigneeId: currentUserId })}>
              Assign to me
            </button>
          )}
        </div>
      </section>

      <form onSubmit={addNote} aria-labelledby="note-heading">
        <h3 id="note-heading" className="admin-actions-heading">Add a note</h3>
        <textarea
          className="admin-textarea"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={visibility === "INTERNAL" ? "Internal note for the IT team…" : "Update for the employee…"}
          rows={3}
          maxLength={4000}
          aria-label="Note"
        />
        <fieldset className="note-visibility">
          <legend className="sr-only">Who can see this note</legend>
          <label>
            <input type="radio" name="visibility" checked={visibility === "INTERNAL"} onChange={() => setVisibility("INTERNAL")} />
            Internal — IT only
          </label>
          <label>
            <input type="radio" name="visibility" checked={visibility === "PUBLIC"} onChange={() => setVisibility("PUBLIC")} />
            Visible to employee
          </label>
        </fieldset>
        <button type="submit" className="button button-primary admin-note-button" disabled={Boolean(pending)}>
          {pending === "note" ? "Saving…" : "Add note"}
        </button>
      </form>

      {error && <p className="incident-action-error" role="alert">{error}</p>}
    </div>
  );
}
