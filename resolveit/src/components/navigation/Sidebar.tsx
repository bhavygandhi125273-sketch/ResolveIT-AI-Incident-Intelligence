import Link from "next/link";

export type SidebarUser = {
  displayName: string;
  email: string;
  role: "EMPLOYEE" | "IT_ADMIN";
};

type SidebarProps = {
  user: SidebarUser;
  active: "queue" | "tickets" | "report";
  theme?: "dark" | "light";
};

const LINKS = {
  IT_ADMIN: [
    { key: "queue", href: "/", label: "Incident queue", icon: "▦" },
    { key: "report", href: "/incidents/new", label: "Report a problem", icon: "+" },
  ],
  EMPLOYEE: [
    { key: "tickets", href: "/my-incidents", label: "My tickets", icon: "▤" },
    { key: "report", href: "/incidents/new", label: "Report a problem", icon: "+" },
  ],
} as const;

function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M18.7 3.5 7.2 17h7.4l-1.3 11.5L25 15h-7.6l1.3-11.5Z" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Sidebar({ user, active, theme = "dark" }: SidebarProps) {
  const isIt = user.role === "IT_ADMIN";

  return (
    <aside className={`sidebar sidebar-${theme}`}>
      <Link className="brand" href={isIt ? "/" : "/my-incidents"} aria-label="ResolveIT home">
        <Mark />
        <span className="brand-name">resolve<span>it</span></span>
      </Link>

      <div className="nav-section-label">{isIt ? "IT WORKSPACE" : "SUPPORT"}</div>
      <nav className="side-nav" aria-label="Main navigation">
        {LINKS[user.role].map((item) => (
          <Link
            key={item.key}
            className={`nav-link${item.key === active ? " active" : ""}`}
            href={item.href}
            aria-current={item.key === active ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="profile-row">
          <div className="avatar" aria-hidden="true">{user.displayName.charAt(0).toUpperCase()}</div>
          <div className="profile-copy">
            <strong>{user.displayName}</strong>
            <span>{isIt ? "IT support" : "Employee"}</span>
          </div>
        </div>
        <form action="/api/auth/logout" method="post" className="logout-form">
          {/* suppressHydrationWarning: form-filler extensions inject attributes (e.g. fdprocessedid) before hydration. */}
          <button type="submit" className="logout-button" suppressHydrationWarning>
            <span aria-hidden="true">⎋</span>
            <span className="logout-label">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
