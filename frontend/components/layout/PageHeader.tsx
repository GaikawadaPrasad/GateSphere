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

export function PageHeader({
  title,
  subtitle,
  description,
  breadcrumbs,
  actions,
  action,
}: PageHeaderProps) {
  const sub = subtitle || description;
  const acts = actions || action;
  return (
    <div style={{ marginBottom: "1.25rem", width: "100%", maxWidth: "100%", minWidth: 0 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div
          className="breadcrumb-responsive"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.75rem",
            color: "var(--muted)",
            marginBottom: "0.35rem",
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          {breadcrumbs.map((b, i) => (
            <span
              key={i}
              className="breadcrumb-item"
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}
            >
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
        className="page-header-actions"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          minWidth: 0,
          width: "100%",
        }}
      >
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <h1
            className="page-title-responsive"
            style={{
              fontSize: "clamp(1.2rem, 3.5vw, 1.5rem)",
              fontWeight: 700,
              color: "var(--fg)",
              letterSpacing: "-0.02em",
              wordBreak: "break-word",
              lineHeight: 1.25,
            }}
          >
            {title}
          </h1>
          {sub && (
            <p
              className="page-subtitle-responsive"
              style={{
                fontSize: "0.85rem",
                color: "var(--muted)",
                marginTop: "0.2rem",
                wordBreak: "break-word",
              }}
            >
              {sub}
            </p>
          )}
        </div>

        {acts && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            {acts}
          </div>
        )}
      </div>
    </div>
  );
}
