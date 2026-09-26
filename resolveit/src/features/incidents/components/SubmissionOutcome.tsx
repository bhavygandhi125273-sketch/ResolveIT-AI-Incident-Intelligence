import Link from "next/link";
import type { IncidentSubmissionResult } from "../client";
import { decisionLabels, severityLabels, statusLabels } from "../labels";

type Props = {
  result: IncidentSubmissionResult;
  source: "manual" | "voice";
  onReportAnother?: () => void;
};

/** What the employee sees right after a ticket is created, from either reporting path. */
export function SubmissionOutcome({ result, source, onReportAnother }: Props) {
  const { incident, workflow } = result;
  const decision = workflow?.decision;
  const escalated = incident.status === "ESCALATED" || decision?.action === "ESCALATE_TO_HUMAN";

  return (
    <section className="report-form-card success-card outcome-card" aria-live="polite" aria-labelledby="outcome-heading">
      <div className={`success-mark${escalated ? " success-mark-escalated" : ""}`} aria-hidden="true">
        {escalated ? "!" : "✓"}
      </div>
      <div className="form-step">
        {escalated ? "ESCALATED TO IT SUPPORT" : source === "voice" ? "VOICE REPORT SUBMITTED" : "INCIDENT RECEIVED"}
      </div>
      <h2 id="outcome-heading">
        {escalated ? "A person from IT will take it from here." : "Your ticket has been created."}
      </h2>
      <p className="form-description">
        {escalated
          ? "This issue needs hands-on help, so it went straight to the IT support queue with everything you shared."
          : source === "voice"
            ? "ResolveIT created the ticket from your conversation. Your IT team has the details."
            : "Your IT team has the details. You can follow progress on your tickets page."}
      </p>

      <dl className="outcome-facts">
        <div>
          <dt>Ticket</dt>
          <dd className="outcome-reference">{incident.reference}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd><span className={`status-badge status-${incident.status.toLowerCase()}`}>{statusLabels[incident.status]}</span></dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd><span className={`severity-badge severity-${incident.severity.toLowerCase()}`}>{severityLabels[incident.severity]}</span></dd>
        </div>
      </dl>

      {escalated && (
        <div className="workflow-result workflow-result-escalated">
          <strong>What happens next</strong>
          <p>IT support has been alerted and will contact you. There is no need to report this again.</p>
        </div>
      )}

      {!escalated && decision?.action === "OFFER_RESOLUTION" && decision.resolution && (
        <div className="workflow-result">
          <strong>Suggested fix you can try</strong>
          <p>{decision.resolution}</p>
          <small>Only try this if you are comfortable doing so. Your ticket stays open for IT either way.</small>
        </div>
      )}

      {!escalated && decision && decision.action !== "OFFER_RESOLUTION" && (
        <div className="workflow-result">
          <strong>{decisionLabels[decision.action]}</strong>
          <p>{decision.explanation}</p>
        </div>
      )}

      <div className="success-actions">
        <Link className="button button-primary" href={`/incidents/${incident.id}`}>
          View ticket <span aria-hidden="true">→</span>
        </Link>
        <Link className="text-button" href="/my-incidents">My tickets</Link>
        {onReportAnother && (
          <button className="text-button" type="button" onClick={onReportAnother}>Report another issue</button>
        )}
      </div>
    </section>
  );
}
