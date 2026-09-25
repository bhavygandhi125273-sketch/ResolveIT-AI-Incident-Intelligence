import Link from "next/link";
import { Sidebar } from "@/components/navigation/Sidebar";
import type { Incident, IncidentSummary } from "@/features/incidents/types";
import { getIncidentService } from "@/server/incidents/service";

export const dynamic = "force-dynamic";

const categoryLabels: Record<Incident["category"], string> = {
  ACCOUNT_ACCESS: "Account & access",
  COMPUTER_HARDWARE: "Computer & hardware",
  NETWORK_CONNECTIVITY: "Network & connectivity",
  SOFTWARE_APPLICATIONS: "Software & applications",
  EMAIL_COLLABORATION: "Email & collaboration",
  OTHER: "Other",
};

const metrics = [
  { label: "Open incidents", key: "open", note: "Needs IT follow-up", icon: "◷" },
  { label: "High priority", key: "highPriority", note: "High or critical urgency", icon: "⌁" },
  { label: "Resolved", key: "resolved", note: "Completed incidents", icon: "✓" },
] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status: Incident["status"]) {
  return status === "INVESTIGATING" ? "IN PROGRESS" : status.replaceAll("_", " ");
}

export default async function Home() {
  let recent: Incident[] = [];
  let summary: IncidentSummary | null = null;
  let dataUnavailable = false;

  try {
    const incidentService = getIncidentService();
    [recent, summary] = await Promise.all([
      incidentService.listRecent(20),
      incidentService.getSummary(),
    ]);
  } catch (error) {
    console.error("Dashboard incident data could not be loaded.", error);
    dataUnavailable = true;
  }

  return (
    <div className="app-shell app-shell-dark">
      <Sidebar active="overview" />
      <main className="main-content dashboard-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-divider">/</span><strong>Overview</strong></div>
          <div className="topbar-right"><span className="today-label">IT SUPPORT WORKSPACE</span><div className="topbar-avatar">R</div></div>
        </header>

        <section className="dashboard-inner">
          <div className="page-heading dashboard-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> INCIDENT INTELLIGENCE</div><h1>Good morning.</h1><p className="heading-subtitle">Here’s what’s happening across your IT workspace.</p></div>
            <Link className="button button-primary" href="/incidents/new"><span aria-hidden="true">+</span> Report an issue</Link>
          </div>

          {dataUnavailable && <div className="dashboard-error" role="status">Incident data is temporarily unavailable. Check the database connection and refresh.</div>}

          <section className="metric-grid" aria-label="Incident overview">
            {metrics.map((metric) => (
              <article className="metric-card" key={metric.key}>
                <div className="metric-top"><span>{metric.label}</span><span className="metric-icon" aria-hidden="true">{metric.icon}</span></div>
                <div className="metric-value">{summary ? summary[metric.key] : "—"}</div>
                <div className="metric-note">{metric.note}</div>
              </article>
            ))}
          </section>

          <section className="dashboard-columns">
            <article className="panel incident-panel">
              <div className="panel-header"><div><div className="panel-kicker">YOUR WORKSPACE</div><h2>Recent incidents</h2></div><span className="count-pill">{summary ? `${summary.total} ${summary.total === 1 ? "incident" : "incidents"}` : "—"}</span></div>
              {recent.length === 0 && !dataUnavailable ? (
                <div className="empty-state">
                  <div className="empty-orbit"><div className="empty-icon" aria-hidden="true">✳</div></div>
                  <h3>A clear queue is a good place to start.</h3>
                  <p>When an incident is reported, it will appear here with its status and next steps.</p>
                  <Link className="text-link" href="/incidents/new">Report your first issue <span aria-hidden="true">→</span></Link>
                </div>
              ) : (
                <div className="incident-list" aria-live="polite">
                  {recent.map((incident) => (
                    <Link className="incident-row" key={incident.id} href={`/incidents/${incident.id}`} aria-label={`Open incident ${incident.title}`}>
                      <div className="incident-row-main"><div className="incident-title-line"><h3>{incident.title}</h3><span className={`severity-badge severity-${incident.severity.toLowerCase()}`}>{incident.severity}</span></div><p>{categoryLabels[incident.category]} <span>·</span> {incident.affectedUsers} {incident.affectedUsers === 1 ? "person" : "people"} affected</p><time dateTime={incident.createdAt}>{formatDate(incident.createdAt)}</time></div>
                      <span className={`status-badge status-${incident.status.toLowerCase()}`}>{statusLabel(incident.status)}</span>
                      <span className="incident-open-link">OPEN <span aria-hidden="true">↗</span></span>
                    </Link>
                  ))}
                </div>
              )}
            </article>

            <aside className="side-column">
              <article className="guide-card">
                <div className="guide-tag"><span className="guide-spark" aria-hidden="true">✳</span> A BETTER WAY TO GET HELP</div>
                <h2>Get back to<br />what matters.</h2>
                <p>Tell us what’s going on. Your IT team will have the context they need to help.</p>
                <Link className="guide-link" href="/incidents/new">Start a report <span aria-hidden="true">↗</span></Link>
                <div className="guide-decoration" aria-hidden="true"><span /><span /><span /></div>
              </article>
              <article className="panel activity-panel">
                <div className="panel-kicker">INTAKE MODEL</div>
                <div className="activity-empty"><span className="activity-clock" aria-hidden="true">✓</span><p>Voice and manual reports pass through the same server validation before storage.</p></div>
              </article>
            </aside>
          </section>

          <footer className="dashboard-footer"><span>ResolveIT <span className="footer-dot">·</span> Incident intelligence for IT support</span><span className="footer-version">MILESTONE 2</span></footer>
        </section>
      </main>
    </div>
  );
}
