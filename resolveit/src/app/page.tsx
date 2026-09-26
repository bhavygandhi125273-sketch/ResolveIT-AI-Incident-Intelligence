import Link from "next/link";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Topbar } from "@/components/navigation/Topbar";
import { SeverityBadge, StatusBadge } from "@/features/incidents/components/Badges";
import { parseIncidentFilters, type IncidentFilters } from "@/features/incidents/filters";
import { categoryLabels, formatDateTime, severityLabels, sourceLabels, statusLabels } from "@/features/incidents/labels";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_SOURCES,
  INCIDENT_STATUSES,
  type Incident,
  type IncidentSummary,
  type UserReference,
} from "@/features/incidents/types";
import { getIncidentService } from "@/server/incidents/service";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const METRICS: Array<{ key: keyof IncidentSummary; label: string; note: string; tone?: string; href?: string }> = [
  { key: "total", label: "Total", note: "All incidents", href: "/?sort=newest" },
  { key: "open", label: "Open", note: "Not yet resolved" },
  { key: "critical", label: "Critical", note: "Open, critical priority", tone: "critical", href: "/?severity=CRITICAL" },
  { key: "highPriority", label: "High", note: "Open, high priority", tone: "high", href: "/?severity=HIGH" },
  { key: "investigating", label: "In progress", note: "Being worked on", tone: "investigating", href: "/?status=INVESTIGATING" },
  { key: "escalated", label: "Escalated", note: "Needs a person now", tone: "escalated", href: "/?status=ESCALATED" },
  { key: "resolved", label: "Resolved", note: "Closed out", tone: "resolved", href: "/?status=RESOLVED" },
];

const SORT_LABELS: Record<IncidentFilters["sort"], string> = {
  priority: "Priority (most urgent first)",
  newest: "Newest first",
  oldest: "Oldest first",
  updated: "Recently updated",
};

function needsAttention(incident: Incident) {
  return incident.status !== "RESOLVED" && (incident.status === "ESCALATED" || incident.severity === "CRITICAL" || incident.severity === "HIGH");
}

function hasFilters(filters: IncidentFilters) {
  return Boolean(filters.status || filters.severity || filters.category || filters.source || filters.assignee || filters.from || filters.to);
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "EMPLOYEE") {
    redirect("/my-incidents");
  }

  const filters = parseIncidentFilters(await searchParams);

  let queue: Incident[] = [];
  let attention: Incident[] = [];
  let summary: IncidentSummary | null = null;
  let staff: UserReference[] = [];
  let dataUnavailable = false;

  try {
    const service = getIncidentService();
    let priorityList: Incident[];
    [queue, priorityList, summary, staff] = await Promise.all([
      service.list({ ...filters, assignee: filters.assignee === "me" ? user.id : filters.assignee, limit: 100 }),
      service.list({ sort: "priority", limit: 25 }),
      service.getSummary(),
      service.listItStaff(),
    ]);
    attention = priorityList.filter(needsAttention).slice(0, 6);
  } catch (error) {
    console.error("Dashboard incident data could not be loaded.", error);
    dataUnavailable = true;
  }

  const filtered = hasFilters(filters);

  return (
    <div className="app-shell app-shell-dark">
      <Sidebar user={user} active="queue" />

      <main className="main-content dashboard-content">
        <Topbar crumbs={[{ label: "IT workspace" }, { label: "Incident queue" }]} label="IT SUPPORT WORKSPACE" initial={user.displayName.charAt(0).toUpperCase()} />

        <section className="dashboard-inner">
          <div className="page-heading dashboard-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />INCIDENT OPERATIONS</div>
              <h1>Incident queue</h1>
              <p className="heading-subtitle">
                {summary
                  ? `${summary.open} open · ${summary.unassigned} unassigned · ${summary.escalated} escalated`
                  : "Every incident reported by employees, by voice or form."}
              </p>
            </div>
            <Link className="button button-primary" href="/incidents/new">
              <span aria-hidden="true">+</span> Report a problem
            </Link>
          </div>

          {dataUnavailable && (
            <div className="dashboard-error" role="status">
              Incident data is temporarily unavailable. Check the database connection and refresh.
            </div>
          )}

          <section className="metric-grid metric-grid-wide" aria-label="Incident overview">
            {METRICS.map((metric) => {
              const body = (
                <>
                  <div className="metric-top"><span>{metric.label}</span></div>
                  <div className="metric-value">{summary ? summary[metric.key] : "—"}</div>
                  <div className="metric-note">{metric.note}</div>
                </>
              );
              const className = `metric-card${metric.tone ? ` metric-${metric.tone}` : ""}`;
              return metric.href ? (
                <Link key={metric.key} className={`${className} metric-link`} href={metric.href}>{body}</Link>
              ) : (
                <article key={metric.key} className={className}>{body}</article>
              );
            })}
          </section>

          {attention.length > 0 && (
            <section className="attention-panel" aria-labelledby="attention-heading">
              <div className="attention-header">
                <h2 id="attention-heading"><span className="attention-dot" aria-hidden="true" />Needs attention</h2>
                <span>Escalated, critical, or high priority — not yet resolved</span>
              </div>
              <div className="attention-list">
                {attention.map((incident) => (
                  <Link key={incident.id} href={`/incidents/${incident.id}`} className="attention-item">
                    <div className="attention-badges">
                      <SeverityBadge severity={incident.severity} />
                      <StatusBadge status={incident.status} />
                    </div>
                    <strong>{incident.title}</strong>
                    <span className="attention-meta">
                      {incident.reference} · {incident.assignee ? incident.assignee.displayName : "Unassigned"} · {formatDateTime(incident.createdAt)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <article className="panel queue-panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">ALL INCIDENTS</div>
                <h2>{filtered ? "Filtered incidents" : "Queue"}</h2>
              </div>
              <span className="count-pill">{queue.length} shown</span>
            </div>

            <form className="queue-filters" method="get" action="/" aria-label="Filter incidents">
              <label>
                <span>Status</span>
                <select name="status" defaultValue={filters.status ?? ""}>
                  <option value="">Any status</option>
                  {INCIDENT_STATUSES.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select name="severity" defaultValue={filters.severity ?? ""}>
                  <option value="">Any priority</option>
                  {[...INCIDENT_SEVERITIES].reverse().map((severity) => <option key={severity} value={severity}>{severityLabels[severity]}</option>)}
                </select>
              </label>
              <label>
                <span>Category</span>
                <select name="category" defaultValue={filters.category ?? ""}>
                  <option value="">Any category</option>
                  {INCIDENT_CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
                </select>
              </label>
              <label>
                <span>Source</span>
                <select name="source" defaultValue={filters.source ?? ""}>
                  <option value="">Any source</option>
                  {INCIDENT_SOURCES.map((source) => <option key={source} value={source}>{sourceLabels[source]}</option>)}
                </select>
              </label>
              <label>
                <span>Assignee</span>
                <select name="assignee" defaultValue={filters.assignee ?? ""}>
                  <option value="">Anyone</option>
                  <option value="me">Assigned to me</option>
                  <option value="unassigned">Unassigned</option>
                  {staff.filter((member) => member.id !== user.id).map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
                </select>
              </label>
              <label>
                <span>From</span>
                <input type="date" name="from" defaultValue={filters.from ?? ""} />
              </label>
              <label>
                <span>To</span>
                <input type="date" name="to" defaultValue={filters.to ?? ""} />
              </label>
              <label>
                <span>Sort</span>
                <select name="sort" defaultValue={filters.sort}>
                  {Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div className="queue-filter-actions">
                <button type="submit" className="button button-primary">Apply</button>
                {filtered && <Link className="text-link" href="/">Clear</Link>}
              </div>
            </form>

            {queue.length === 0 && !dataUnavailable ? (
              <div className="empty-state">
                <div className="empty-orbit"><div className="empty-icon" aria-hidden="true">✳</div></div>
                <h3>{filtered ? "No incidents match these filters." : "The queue is clear."}</h3>
                <p>{filtered ? "Try widening the filters." : "New incidents from employees will appear here."}</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="incident-table">
                  <thead>
                    <tr>
                      <th scope="col">Ticket</th>
                      <th scope="col">Incident</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Status</th>
                      <th scope="col">Category</th>
                      <th scope="col">Source</th>
                      <th scope="col">Assignee</th>
                      <th scope="col">Created</th>
                      <th scope="col">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((incident) => (
                      <tr key={incident.id} className={needsAttention(incident) ? "row-attention" : undefined}>
                        <td className="cell-reference"><Link href={`/incidents/${incident.id}`}>{incident.reference}</Link></td>
                        <td className="cell-title">
                          <Link href={`/incidents/${incident.id}`}>{incident.title}</Link>
                          <span className="cell-sub">{incident.requester?.displayName ?? "Unknown requester"} · {incident.affectedUsers} affected</span>
                        </td>
                        <td><SeverityBadge severity={incident.severity} /></td>
                        <td><StatusBadge status={incident.status} /></td>
                        <td>{categoryLabels[incident.category]}</td>
                        <td>{sourceLabels[incident.source]}</td>
                        <td className={incident.assignee ? undefined : "cell-muted"}>{incident.assignee?.displayName ?? "Unassigned"}</td>
                        <td className="cell-date"><time dateTime={incident.createdAt}>{formatDateTime(incident.createdAt)}</time></td>
                        <td className="cell-date"><time dateTime={incident.updatedAt}>{formatDateTime(incident.updatedAt)}</time></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
