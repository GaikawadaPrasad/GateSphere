import type { ReactNode } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, description, breadcrumbs, actions, action }: PageHeaderProps) {
  const sub = subtitle || description;
  const acts = actions || action;
  return (
    <div style={{ marginBottom: "1.75rem" }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.75rem",
            color: "var(--muted)",
            marginBottom: "0.4rem",
          }}
        >
          {breadcrumbs.map((b, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {i > 0 && <span>/</span>}
              {b.href ? (
                <a href={b.href} style={{ color: "var(--muted)", textDecoration: "none" }}>
                  {b.label}
                </a>
              ) : (
                <span style={{ color: "var(--fg)" }}>{b.label}</span>
              )}
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.02em" }}>
            {title}
          </h1>
          {sub && (
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginTop: "0.2rem" }}>
              {sub}
            </p>
          )}
        </div>

        {acts && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {acts}
          </div>
        )}
      </div>
    </div>
  );
}
