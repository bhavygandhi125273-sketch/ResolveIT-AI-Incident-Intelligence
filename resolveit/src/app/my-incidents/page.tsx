import Link from "next/link";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Topbar } from "@/components/navigation/Topbar";
import { SeverityBadge, StatusBadge } from "@/features/incidents/components/Badges";
import { categoryLabels, formatDateTime } from "@/features/incidents/labels";
import type { Incident } from "@/features/incidents/types";
import { getIncidentService } from "@/server/incidents/service";
import { getCurrentUser } from "@/server/auth/session";
import { serverEnv } from "@/server/config/env";

export const dynamic = "force-dynamic";

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
    // The requester filter comes from the session, so employees only ever see their own tickets.
    incidents = await getIncidentService().list({ requesterId: user.id, sort: "updated", limit: 100 });
  } catch (error) {
    console.error("Employee incidents could not be loaded.", error);
    dataUnavailable = true;
  }

  const openCount = incidents.filter((incident) => incident.status !== "RESOLVED").length;
  const firstName = user.displayName.split(" ")[0];
  // The public ResolveIT AI line only. The IT support transfer number is never sent to the browser.
  const aiPhone = serverEnv.resolveItAiPhoneNumber;

  return (
    <div className="app-shell app-shell-dark">
      <Sidebar user={user} active="tickets" />

      <main className="main-content dashboard-content">
        <Topbar crumbs={[{ label: "Support" }, { label: "My tickets" }]} label="EMPLOYEE SUPPORT" initial={user.displayName.charAt(0).toUpperCase()} />

        <section className="dashboard-inner">
          <div className="page-heading dashboard-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />IT SUPPORT</div>
              <h1>Hi {firstName}. Something not working?</h1>
              <p className="heading-subtitle">Report a problem and follow your tickets here.</p>
            </div>
          </div>

          <section className="report-choice-grid" aria-label="Report a problem">
            <Link className="report-choice report-choice-primary" href="/incidents/new?mode=voice">
              <span className="report-choice-icon" aria-hidden="true">◉</span>
              <span className="report-choice-copy">
                <strong>Talk to AI</strong>
                <span>Describe the problem out loud. The assistant asks questions, helps with quick fixes, and creates the ticket for you.</span>
              </span>
              <span className="report-choice-arrow" aria-hidden="true">→</span>
            </Link>
            <Link className="report-choice" href="/incidents/new?mode=manual">
              <span className="report-choice-icon" aria-hidden="true">▤</span>
              <span className="report-choice-copy">
                <strong>Report manually</strong>
                <span>Fill in a short form. Your ticket is created as soon as you submit.</span>
              </span>
              <span className="report-choice-arrow" aria-hidden="true">→</span>
            </Link>
            {aiPhone && (
              <a className="report-choice" href={`tel:${aiPhone.replace(/[^\d+]/g, "")}`}>
                <span className="report-choice-icon" aria-hidden="true">☎</span>
                <span className="report-choice-copy">
                  <strong>Call ResolveIT AI</strong>
                  <span className="report-choice-phone">{aiPhone}</span>
                  <span>Away from your desk? Call and talk to the same AI assistant. Urgent issues are put straight through to IT.</span>
                </span>
              </a>
            )}
          </section>

          {dataUnavailable && (
            <div className="dashboard-error" role="status">
              Your tickets are temporarily unavailable. Please refresh and try again.
            </div>
          )}

          <article className="panel queue-panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">YOUR TICKETS</div>
                <h2>My tickets</h2>
              </div>
              <span className="count-pill">{openCount} open · {incidents.length} total</span>
            </div>

            {incidents.length === 0 && !dataUnavailable ? (
              <div className="empty-state">
                <div className="empty-orbit"><div className="empty-icon" aria-hidden="true">✳</div></div>
                <h3>No tickets yet.</h3>
                <p>When you report a problem, it appears here so you can follow its progress.</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="incident-table">
                  <thead>
                    <tr>
                      <th scope="col">Ticket</th>
                      <th scope="col">Title</th>
                      <th scope="col">Category</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Status</th>
                      <th scope="col">Created</th>
                      <th scope="col">Last updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((incident) => (
                      <tr key={incident.id}>
                        <td className="cell-reference"><Link href={`/incidents/${incident.id}`}>{incident.reference}</Link></td>
                        <td className="cell-title"><Link href={`/incidents/${incident.id}`}>{incident.title}</Link></td>
                        <td>{categoryLabels[incident.category]}</td>
                        <td><SeverityBadge severity={incident.severity} /></td>
                        <td><StatusBadge status={incident.status} /></td>
                        <td className="cell-date"><time dateTime={incident.createdAt}>{formatDateTime(incident.createdAt)}</time></td>
                        <td className="cell-date"><time dateTime={incident.updatedAt}>{formatDateTime(incident.updatedAt)}</time></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <footer className="dashboard-footer">
            <span>ResolveIT <span className="footer-dot">·</span> Only your own tickets are shown here.</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
