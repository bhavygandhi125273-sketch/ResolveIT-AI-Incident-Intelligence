import Link from "next/link";
import type { ReactNode } from "react";

type Crumb = { label: string; href?: string };

export function Topbar({ crumbs, label, initial, light = false }: {
  crumbs: Crumb[];
  label: string;
  initial: string;
  light?: boolean;
}) {
  return (
    <header className={`topbar${light ? " report-topbar" : ""}`}>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          let content: ReactNode = crumb.label;
          if (isLast) content = <strong aria-current="page">{crumb.label}</strong>;
          else if (crumb.href) content = <Link href={crumb.href}>{crumb.label}</Link>;
          return (
            <span key={crumb.label} className="crumb">
              {content}
              {!isLast && <span className="crumb-divider" aria-hidden="true"> / </span>}
            </span>
          );
        })}
      </nav>
      <div className="topbar-right">
        <span className="today-label">{label}</span>
        <div className={`topbar-avatar${light ? " light-avatar" : ""}`} aria-hidden="true">{initial}</div>
      </div>
    </header>
  );
}
