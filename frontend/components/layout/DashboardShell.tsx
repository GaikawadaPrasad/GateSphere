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
    <div
      className="dashboard-content-wrapper"
      style={{ width: "100%", minWidth: 0, maxWidth: "100%" }}
    >
      {(title || eyebrow || headerActions) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.5rem",
            minWidth: 0,
            width: "100%",
          }}
        >
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            {eyebrow && (
              <div style={{ marginBottom: "0.5rem" }}>
                <Eyebrow accentColor={accentColor}>{eyebrow}</Eyebrow>
              </div>
            )}
            {title && (
              <h1
                className="hero-h1"
                style={{
                  fontSize: "clamp(1.35rem, 4vw, 2rem)",
                  wordBreak: "break-word",
                  lineHeight: 1.25,
                }}
              >
                {title}
              </h1>
            )}
            {description && (
              <p
                style={{
                  color: "var(--brand-body)",
                  marginTop: "0.25rem",
                  fontSize: "14px",
                  wordBreak: "break-word",
                }}
              >
                {description}
              </p>
            )}
          </div>
          {headerActions && (
            <div
              className="dashboard-header-actions"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
                minWidth: 0,
              }}
            >
              {headerActions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
