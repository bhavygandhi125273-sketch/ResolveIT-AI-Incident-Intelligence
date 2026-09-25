import Link from "next/link";

type SidebarProps = {
  active: "overview" | "report";
  theme?: "dark" | "light";
};

const links = [
  { href: "/", label: "Overview", icon: "grid" },
  { href: "/incidents/new", label: "Report an issue", icon: "plus" },
] as const;

function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M18.7 3.5 7.2 17h7.4l-1.3 11.5L25 15h-7.6l1.3-11.5Z" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Sidebar({ active, theme = "dark" }: SidebarProps) {
  return (
    <aside className={`sidebar sidebar-${theme}`}>
      <Link className="brand" href="/" aria-label="ResolveIT home">
        <Mark />
        <span className="brand-name">resolve<span>it</span></span>
      </Link>

      <div className="nav-section-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {links.map((item, index) => {
          const isActive = (index === 0 && active === "overview") || (index === 1 && active === "report");
          return (
            <Link key={item.href} className={`nav-link${isActive ? " active" : ""}`} href={item.href}>
              <span className="nav-icon" aria-hidden="true">{item.icon === "grid" ? "▦" : "+"}</span>
              {item.label}
              {index === 1 && <span className="nav-trailing" aria-hidden="true">↗</span>}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-status">
          <span className="status-dot" />
          <span>Workspace ready</span>
        </div>
        <div className="profile-row">
          <div className="avatar">R</div>
          <div className="profile-copy"><strong>ResolveIT</strong><span>IT workspace</span></div>
          <span className="profile-menu" aria-hidden="true">···</span>
        </div>
      </div>
    </aside>
  );
}
