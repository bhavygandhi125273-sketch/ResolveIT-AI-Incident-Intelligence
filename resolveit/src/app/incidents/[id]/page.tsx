import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Topbar } from "@/components/navigation/Topbar";
import { SeverityBadge, StatusBadge } from "@/features/incidents/components/Badges";
import { IncidentAdminActions } from "@/features/incidents/components/IncidentAdminActions";
import { categoryLabels, decisionLabels, formatDateTime, sourceLabels, statusLabels } from "@/features/incidents/labels";
import type { StoredInvestigation } from "@/features/incidents/repository";
import type { IncidentDetail } from "@/features/incidents/service";
import type { IncidentEvent, UserReference } from "@/features/incidents/types";
import { getIncidentService } from "@/server/incidents/service";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

function orNotProvided(value: string | null | undefined) {
  return value?.trim() || <span className="value-missing">Not provided</span>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`incident-detail-field${wide ? " field-wide" : ""}`}>
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (!items.length) return <span className="value-missing">Not provided</span>;
  return <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
}

function eventTitle(event: IncidentEvent, forEmployee: boolean) {
  switch (event.type) {
    case "CREATED": return "Ticket created";
    case "INVESTIGATED": return "AI investigation completed";
    case "ESCALATED": return "Escalated to IT support";
    case "STATUS_CHANGED": return `Status changed to ${event.toStatus ? statusLabels[event.toStatus] : "unknown"}`;
    case "ASSIGNED": return forEmployee ? "Assigned to IT staff" : event.body ?? "Assignment changed";
    case "NOTE": return event.visibility === "INTERNAL" ? "Internal note" : forEmployee ? "Update from IT" : "Note to employee";
    case "CALL_TRANSFERRED": return "Phone call transferred to IT support";
  }
}

function Timeline({ events, forEmployee }: { events: IncidentEvent[]; forEmployee: boolean }) {
  if (!events.length) return <p className="incident-detail-copy">No activity recorded yet.</p>;
  return (
    <ol className="timeline">
      {events.map((event) => (
        <li key={event.id} className={`timeline-item timeline-${event.type.toLowerCase()}${event.visibility === "INTERNAL" ? " timeline-internal" : ""}`}>
          <span className="history-dot" aria-hidden="true" />
          <div>
            <strong>{eventTitle(event, forEmployee)}</strong>
            {event.type === "NOTE" && event.body && <p className="timeline-body">{event.body}</p>}
            {!forEmployee && (event.type === "ESCALATED" || event.type === "INVESTIGATED") && event.body && (
              <p className="timeline-body">{event.body}</p>
            )}
            <time dateTime={event.createdAt}>
              {formatDateTime(event.createdAt)}
              {event.actor && !forEmployee && ` · ${event.actor.displayName}`}
              {event.actor && forEmployee && event.type === "NOTE" && ` · ${event.actor.displayName}`}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}

function InvestigationPanel({ investigation, forEmployee }: { investigation: StoredInvestigation | null; forEmployee: boolean }) {
  if (!investigation) {
    return (
      <article className="panel incident-detail-panel">
        <div className="panel-kicker">AI INVESTIGATION</div>
        <h2>No AI assessment yet</h2>
        <p className="incident-detail-copy">
          This incident was reported before AI investigation results were stored, or the investigation has not run.
        </p>
      </article>
    );
  }

  const { decision } = investigation;

  return (
    <article className="panel incident-detail-panel ai-panel">
      <div className="panel-header">
        <div>
          <div className="panel-kicker">AI INVESTIGATION & DECISION</div>
          <h2>{forEmployee ? "What happens next" : "What the AI found"}</h2>
        </div>
        <span className={`decision-pill decision-${decision.action.toLowerCase()}`}>{decisionLabels[decision.action]}</span>
      </div>

      <div className="decision-box">
        <strong>{forEmployee ? decisionLabels[decision.action] : "Recommended action"}</strong>
        <p>{decision.explanation}</p>
        {decision.resolution && (
          <p className="decision-resolution"><span>Suggested fix:</span> {decision.resolution}</p>
        )}
      </div>

      {investigation.status !== "complete" ? (
        <p className="incident-detail-copy ai-unavailable">
          {investigation.status === "not_configured"
            ? "AI investigation is not configured, so this decision used ResolveIT's priority rules only."
            : "The AI investigation could not run for this incident, so this decision used ResolveIT's priority rules only."}
        </p>
      ) : (
        <div className="incident-detail-fields">
          <Field label="Summary" wide>{orNotProvided(investigation.summary)}</Field>
          {!forEmployee && (
            <>
              <Field label="Possible cause">{orNotProvided(investigation.possibleCause)}</Field>
              <Field label="Impact">{orNotProvided(investigation.impact)}</Field>
              <Field label="Recommended troubleshooting for IT" wide><List items={investigation.recommendedSteps} /></Field>
              <Field label="Human intervention">
                {investigation.requiresHumanIntervention ? "Required" : "Not required"}
                {investigation.humanInterventionReason && <> — {investigation.humanInterventionReason}</>}
              </Field>
              <Field label="Missing information"><List items={investigation.missingInformation} /></Field>
            </>
          )}
        </div>
      )}
      <p className="ai-footnote">
        AI output is advisory. {forEmployee ? "Your IT team makes the final call." : "ResolveIT's rules chose the action; IT makes the final call."}
      </p>
    </article>
  );
}

export default async function IncidentDetailPage({ params }: PageProps<"/incidents/[id]">) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const service = getIncidentService();
  // getDetail enforces ownership for employees and hides internal notes from them.
  const detail: IncidentDetail | null = await service.getDetail(id, user);

  if (!detail) {
    notFound();
  }

  const { incident, investigation, events } = detail;
  const isIt = user.role === "IT_ADMIN";
  const staff: UserReference[] = isIt ? await service.listItStaff() : [];
  const backHref = isIt ? "/" : "/my-incidents";

  return (
    <div className="app-shell app-shell-dark">
      <Sidebar user={user} active={isIt ? "queue" : "tickets"} />

      <main className="main-content dashboard-content">
        <Topbar
          crumbs={[{ label: isIt ? "Incident queue" : "My tickets", href: backHref }, { label: incident.reference }]}
          label={isIt ? "IT SUPPORT WORKSPACE" : "EMPLOYEE SUPPORT"}
          initial={user.displayName.charAt(0).toUpperCase()}
        />

        <section className="dashboard-inner incident-detail-page">
          <Link href={backHref} className="back-link detail-back-link">
            ← {isIt ? "Back to the queue" : "Back to my tickets"}
          </Link>

          <div className="incident-detail-header">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                {incident.reference} · {sourceLabels[incident.source].toUpperCase()} REPORT
              </div>
              <h1>{incident.title}</h1>
              <p className="heading-subtitle">
                Reported {formatDateTime(incident.createdAt, "long")}
                {isIt && ` by ${incident.requester?.displayName ?? "an unknown requester"}`}
                {" · "}Last updated {formatDateTime(incident.updatedAt)}
              </p>
            </div>
            <div className="detail-header-badges">
              <SeverityBadge severity={incident.severity} />
              <StatusBadge status={incident.status} />
            </div>
          </div>

          {incident.status === "ESCALATED" && (
            <div className="escalation-banner" role="status">
              <strong>{isIt ? "Escalated — needs a person from IT" : "Escalated to IT support"}</strong>
              <p>
                {isIt
                  ? incident.escalationReason ?? "Escalated for human attention."
                  : "A person from IT will contact you. There is no need to report this again."}              </p>
              {incident.escalatedAt && <time dateTime={incident.escalatedAt}>Escalated {formatDateTime(incident.escalatedAt)}</time>}
            </div>
          )}

          <div className="incident-detail-grid">
            <div className="incident-detail-main">
              <article className="panel incident-detail-panel">
                <div className="panel-kicker">WHAT HAPPENED</div>
                <h2>Incident details</h2>
                <div className="incident-detail-fields">
                  <Field label="Description" wide>{incident.description}</Field>
                  <Field label="Category">{categoryLabels[incident.category]}</Field>
                  <Field label="Affected system">{orNotProvided(incident.affectedSystem)}</Field>
                  <Field label="People affected">{incident.affectedUsers}</Field>
                  <Field label="Urgency reported">{incident.urgency.charAt(0) + incident.urgency.slice(1).toLowerCase()}</Field>
                  <Field label="Business impact" wide>{incident.businessImpact}</Field>
                  <Field label="Symptoms" wide>{orNotProvided(incident.symptoms)}</Field>
                  <Field label="When it started">{orNotProvided(incident.startedAt)}</Field>
                  <Field label="Still happening">
                    {incident.currentlyAffected === null ? <span className="value-missing">Not provided</span> : incident.currentlyAffected ? "Yes" : "No"}
                  </Field>
                  <Field label="Error messages" wide><List items={incident.errorMessages} /></Field>
                  <Field label="Already tried" wide><List items={incident.troubleshootingAttempted} /></Field>
                  {incident.additionalContext && <Field label="Other information" wide>{incident.additionalContext}</Field>}
                  {isIt && incident.source === "phone" && (
                    <Field label="Caller">
                      {incident.callerPhone ?? "Unknown number"}
                      {incident.requester ? ` — matched to ${incident.requester.displayName}` : " — not linked to a ResolveIT account"}
                    </Field>
                  )}
                  {isIt && incident.humanAssistanceRequested &&<Field label="Human help requested" wide>Yes — the employee or voice assistant asked for a person from IT.</Field>}
                </div>
              </article>

              <InvestigationPanel investigation={investigation} forEmployee={!isIt} />

              {incident.transcript?.trim() && (
                <article className="panel incident-detail-panel">
                  <details className="transcript-details">
                    <summary>
                      <span className="panel-kicker">{incident.source === "phone" ? "PHONE CALL TRANSCRIPT" : "VOICE CONVERSATION"}</span>
                      <span className="transcript-toggle">Show transcript</span>
                    </summary>
                    <pre className="transcript-text">{incident.transcript}</pre>
                  </details>
                </article>
              )}
            </div>

            <aside className="incident-detail-side">
              <article className="panel incident-detail-panel">
                <div className="panel-kicker">{isIt ? "WORK THIS INCIDENT" : "TICKET STATUS"}</div>
                <h2>{isIt ? "IT actions" : statusLabels[incident.status]}</h2>
                {isIt ? (
                  <IncidentAdminActions
                    incidentId={incident.id}
                    currentStatus={incident.status}
                    assigneeId={incident.assignee?.id ?? null}
                    staff={staff}
                    currentUserId={user.id}
                  />
                ) : (
                  <dl className="side-facts">
                    <div><dt>Ticket</dt><dd className="outcome-reference">{incident.reference}</dd></div>
                    <div><dt>Status</dt><dd><StatusBadge status={incident.status} /></dd></div>
                    <div><dt>Priority</dt><dd><SeverityBadge severity={incident.severity} /></dd></div>
                    <div><dt>Handled by</dt><dd>{incident.assignee ? incident.assignee.displayName : "Waiting for an IT team member"}</dd></div>
                  </dl>
                )}
              </article>

              <article className="panel incident-detail-panel">
                <div className="panel-kicker">ACTIVITY</div>
                <h2>Timeline</h2>
                <Timeline events={events} forEmployee={!isIt} />
              </article>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
