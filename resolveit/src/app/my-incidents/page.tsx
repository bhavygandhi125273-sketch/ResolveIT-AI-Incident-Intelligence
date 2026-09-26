import Link from "next/link";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/navigation/Sidebar";
import { getIncidentService } from "@/server/incidents/service";
import { getCurrentUser } from "@/server/auth/session";
import type { Incident } from "@/features/incidents/types";

export const dynamic = "force-dynamic";

const categoryLabels: Record<Incident["category"], string> = {
  ACCOUNT_ACCESS: "Account & access",
  COMPUTER_HARDWARE: "Computer & hardware",
  NETWORK_CONNECTIVITY: "Network & connectivity",
  SOFTWARE_APPLICATIONS: "Software & applications",
  EMAIL_COLLABORATION: "Email & collaboration",
  OTHER: "Other",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: Incident["status"]) {
  return status === "INVESTIGATING"
    ? "IN PROGRESS"
    : status.replaceAll("_", " ");
}

export default async function MyIncidentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "EMPLOYEE") {
    redirect("/");
  }

  let incidents: Incident[] = [];
  let dataUnavailable = false;

  try {
    incidents = await getIncidentService().listRecent(50, user.id);
  } catch (error) {
    console.error("Employee incidents could not be loaded.", error);
    dataUnavailable = true;
  }

  return (
    <div className="app-shell app-shell-dark">
      <Sidebar active="overview" />

      <main className="main-content dashboard-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>My workspace</span>
            <span className="crumb-divider">/</span>
            <strong>My incidents</strong>
          </div>

          <div className="topbar-right">
            <span className="today-label">EMPLOYEE SUPPORT</span>

            <div className="topbar-avatar">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <section className="dashboard-inner">
          <div className="page-heading dashboard-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                MY SUPPORT REQUESTS
              </div>

              <h1>My incidents.</h1>

              <p className="heading-subtitle">
                View the issues you’ve reported and track their status.
              </p>
            </div>

            <Link
              className="button button-primary"
              href="/incidents/new"
            >
              <span aria-hidden="true">+</span>
              Report an issue
            </Link>
          </div>

          {dataUnavailable && (
            <div className="dashboard-error" role="status">
              Your incident data is temporarily unavailable. Please
              refresh and try again.
            </div>
          )}

          <section className="dashboard-columns">
            <article className="panel incident-panel">
              <div className="panel-header">
                <div>
                  <div className="panel-kicker">
                    YOUR REPORTS
                  </div>

                  <h2>Reported incidents</h2>
                </div>

                <span className="count-pill">
                  {incidents.length}{" "}
                  {incidents.length === 1
                    ? "incident"
                    : "incidents"}
                </span>
              </div>

              {incidents.length === 0 && !dataUnavailable ? (
                <div className="empty-state">
                  <div className="empty-orbit">
                    <div
                      className="empty-icon"
                      aria-hidden="true"
                    >
                      ✳
                    </div>
                  </div>

                  <h3>No incidents reported yet.</h3>

                  <p>
                    When you report an IT issue, it will appear here
                    so you can track its status.
                  </p>

                  <Link
                    className="text-link"
                    href="/incidents/new"
                  >
                    Report an issue{" "}
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              ) : (
                <div
                  className="incident-list"
                  aria-live="polite"
                >
                  {incidents.map((incident) => (
                    <Link
                      className="incident-row"
                      key={incident.id}
                      href={`/incidents/${incident.id}`}
                      aria-label={`Open incident ${incident.title}`}
                    >
                      <div className="incident-row-main">
                        <div className="incident-title-line">
                          <h3>{incident.title}</h3>

                          <span
                            className={`severity-badge severity-${incident.severity.toLowerCase()}`}
                          >
                            {incident.severity}
                          </span>
                        </div>

                        <p>
                          {categoryLabels[incident.category]}
                          <span> · </span>
                          {incident.affectedUsers}{" "}
                          {incident.affectedUsers === 1
                            ? "person"
                            : "people"}{" "}
                          affected
                        </p>

                        <time dateTime={incident.createdAt}>
                          {formatDate(incident.createdAt)}
                        </time>
                      </div>

                      <span
                        className={`status-badge status-${incident.status.toLowerCase()}`}
                      >
                        {statusLabel(incident.status)}
                      </span>

                      <span className="incident-open-link">
                        VIEW{" "}
                        <span aria-hidden="true">↗</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </article>

            <aside className="side-column">
              <article className="guide-card">
                <div className="guide-tag">
                  <span
                    className="guide-spark"
                    aria-hidden="true"
                  >
                    ✳
                  </span>
                  NEED IT HELP?
                </div>

                <h2>
                  We’ll help you
                  <br />
                  get it sorted.
                </h2>

                <p>
                  Tell us what’s happening and your IT team will have
                  the context they need to help.
                </p>

                <Link
                  className="guide-link"
                  href="/incidents/new"
                >
                  Report an issue{" "}
                  <span aria-hidden="true">↗</span>
                </Link>

                <div
                  className="guide-decoration"
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                </div>
              </article>

              <article className="panel activity-panel">
                <div className="panel-kicker">
                  YOUR ACCOUNT
                </div>

                <div className="activity-empty">
                  <span
                    className="activity-clock"
                    aria-hidden="true"
                  >
                    ✓
                  </span>

                  <p>
                    Signed in as{" "}
                    <strong>{user.displayName}</strong>. Only your
                    reported incidents are shown here.
                  </p>
                </div>
              </article>
            </aside>
          </section>

          <footer className="dashboard-footer">
            <span>
              ResolveIT{" "}
              <span className="footer-dot">·</span>{" "}
              Employee support
            </span>

            <span className="footer-version">
              MILESTONE 2
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}