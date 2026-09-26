import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Sidebar } from "@/components/navigation/Sidebar";
import { getIncidentService } from "@/server/incidents/service";
import { getCurrentUser } from "@/server/auth/session";
import type { Incident } from "@/features/incidents/types";
import { IncidentStatusActions } from "@/features/incidents/components/IncidentStatusActions";

export const dynamic = "force-dynamic";

const categoryLabels: Record<Incident["category"], string> = {
  ACCOUNT_ACCESS: "Account & access",
  COMPUTER_HARDWARE: "Computer & hardware",
  NETWORK_CONNECTIVITY: "Network & connectivity",
  SOFTWARE_APPLICATIONS: "Software & applications",
  EMAIL_COLLABORATION: "Email & collaboration",
  OTHER: "Other",
};

function valueOrNotProvided(value: string | null | undefined) {
  return value?.trim() || "Not provided";
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="incident-detail-field">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function statusLabel(status: Incident["status"]) {
  return status === "INVESTIGATING"
    ? "IN PROGRESS"
    : status.replaceAll("_", " ");
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    notFound();
  }

  const incident = await getIncidentService().getById(
    id,
    user.role === "EMPLOYEE" ? user.id : undefined,
  );

  if (!incident) {
    notFound();
  }

  const isITAdmin = user.role === "IT_ADMIN";

  return (
    <div className="app-shell app-shell-dark">
      <Sidebar active="overview" />

      <main className="main-content dashboard-content">
        <header className="topbar">
          <div className="breadcrumb">
            <Link href={isITAdmin ? "/" : "/my-incidents"}>
              {isITAdmin ? "Workspace" : "My incidents"}
            </Link>

            <span className="crumb-divider">/</span>

            <strong>Incident detail</strong>
          </div>

          <div className="topbar-right">
            <span className="today-label">
              {isITAdmin ? "IT SUPPORT WORKSPACE" : "EMPLOYEE SUPPORT"}
            </span>

            <div className="topbar-avatar">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <section className="dashboard-inner incident-detail-page">
          <Link
            href={isITAdmin ? "/" : "/my-incidents"}
            className="back-link detail-back-link"
          >
            ← {isITAdmin ? "Back to IT queue" : "Back to my incidents"}
          </Link>

          <div className="incident-detail-header">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                INCIDENT · {incident.source.toUpperCase()} REPORT
              </div>

              <h1>{incident.title}</h1>

              <p className="heading-subtitle">{incident.id}</p>
            </div>

            <span
              className={`severity-badge severity-${incident.severity.toLowerCase()}`}
            >
              {incident.severity} PRIORITY
            </span>
          </div>

          <div className="incident-detail-grid">
            <div className="incident-detail-main">
              <article className="panel incident-detail-panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-kicker">
                      REPORTED INFORMATION
                    </div>

                    <h2>Incident details</h2>
                  </div>

                  <span
                    className={`status-badge status-${incident.status.toLowerCase()}`}
                  >
                    {statusLabel(incident.status)}
                  </span>
                </div>

                <div className="incident-detail-fields">
                  <DetailField label="Description">
                    {incident.description}
                  </DetailField>

                  <DetailField label="Category">
                    {categoryLabels[incident.category]}
                  </DetailField>

                  <DetailField label="Affected system">
                    {valueOrNotProvided(incident.affectedSystem)}
                  </DetailField>

                  <DetailField label="Affected users">
                    {incident.affectedUsers}
                  </DetailField>

                  <DetailField label="Business impact">
                    {incident.businessImpact}
                  </DetailField>

                  <DetailField label="Symptoms">
                    {valueOrNotProvided(incident.symptoms)}
                  </DetailField>

                  <DetailField label="When it started">
                    {valueOrNotProvided(incident.startedAt)}
                  </DetailField>

                  <DetailField label="Currently affected">
                    {incident.currentlyAffected === null
                      ? "Not provided"
                      : incident.currentlyAffected
                        ? "Yes"
                        : "No"}
                  </DetailField>

                  <DetailField label="Error messages">
                    {incident.errorMessages.length ? (
                      <ul>
                        {incident.errorMessages.map(
                          (message, index) => (
                            <li key={index}>{message}</li>
                          ),
                        )}
                      </ul>
                    ) : (
                      "Not provided"
                    )}
                  </DetailField>

                  <DetailField label="Troubleshooting already performed">
                    {incident.troubleshootingAttempted.length ? (
                      <ul>
                        {incident.troubleshootingAttempted.map(
                          (step, index) => (
                            <li key={index}>{step}</li>
                          ),
                        )}
                      </ul>
                    ) : (
                      "Not provided"
                    )}
                  </DetailField>

                  <DetailField label="Potential cause">
                    Not provided
                  </DetailField>

                  <DetailField label="Recommended next steps">
                    Not provided
                  </DetailField>

                  <DetailField label="Assigned to / team">
                    Not assigned — no assignment model is configured.
                  </DetailField>
                </div>
              </article>

              <article className="panel incident-detail-panel">
                <div className="panel-kicker">
                  INVESTIGATION CONTEXT
                </div>

                <h2>What the employee shared</h2>

                <p className="incident-detail-copy">
                  {incident.transcript?.trim() ||
                    "No conversation transcript was provided."}
                </p>
              </article>
            </div>

            <aside className="incident-detail-side">
              {isITAdmin ? (
                <article className="panel incident-detail-panel">
                  <div className="panel-kicker">
                    IT TEAM QUEUE
                  </div>

                  <h2>Work this incident</h2>

                  <p className="incident-detail-copy">
                    This incident is stored in ResolveIT for the
                    internal IT queue. No external ticketing or
                    notification integration is connected.
                  </p>

                  <IncidentStatusActions
                    incidentId={incident.id}
                    currentStatus={incident.status}
                  />
                </article>
              ) : (
                <article className="panel incident-detail-panel">
                  <div className="panel-kicker">
                    INCIDENT STATUS
                  </div>

                  <h2>Your report</h2>

                  <p className="incident-detail-copy">
                    Your IT team is reviewing this incident. You can
                    return here to see the latest status.
                  </p>

                  <div
                    className={`status-badge status-${incident.status.toLowerCase()}`}
                  >
                    {statusLabel(incident.status)}
                  </div>
                </article>
              )}

              <article className="panel incident-detail-panel">
                <div className="panel-kicker">RECORD</div>

                <h2>History</h2>

                <div className="incident-history">
                  <span className="history-dot" />

                  <p>
                    <strong>Incident reported</strong>
                    <time>{dateTime(incident.createdAt)}</time>
                  </p>
                </div>

                {incident.updatedAt !== incident.createdAt && (
                  <div className="incident-history">
                    <span className="history-dot" />

                    <p>
                      <strong>Record last updated</strong>
                      <time>{dateTime(incident.updatedAt)}</time>
                    </p>
                  </div>
                )}
              </article>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}