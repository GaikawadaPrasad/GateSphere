"use client";

import React, { ReactNode } from "react";
import { Eyebrow } from "@/components/common/Eyebrow";

interface DashboardShellProps {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  description?: string;
  headerActions?: ReactNode;
  accentColor?: string;
}

export function DashboardShell({
  children,
  title,
  eyebrow,
  description,
  headerActions,
  accentColor,
}: DashboardShellProps) {
  return (
    <div className="dashboard-content-wrapper" style={{ width: "100%" }}>
      {(title || eyebrow || headerActions) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.75rem",
          }}
        >
          <div>
            {eyebrow && (
              <div style={{ marginBottom: "0.5rem" }}>
                <Eyebrow accentColor={accentColor}>{eyebrow}</Eyebrow>
              </div>
            )}
            {title && <h1 className="hero-h1" style={{ fontSize: "2rem" }}>{title}</h1>}
            {description && (
              <p style={{ color: "var(--brand-body)", marginTop: "0.25rem", fontSize: "15px" }}>
                {description}
              </p>
            )}
          </div>
          {headerActions && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              {headerActions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
