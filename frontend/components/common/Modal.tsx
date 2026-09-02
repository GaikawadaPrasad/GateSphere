"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string | number;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({ isOpen, onClose, title, children, footer, maxWidth, size }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let resolvedMaxWidth: string | number = maxWidth || 560;
  if (size === "sm") resolvedMaxWidth = 420;
  if (size === "md") resolvedMaxWidth = 560;
  if (size === "lg") resolvedMaxWidth = 720;
  if (size === "xl") resolvedMaxWidth = 900;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: "var(--radius-card)",
          width: "100%",
          maxWidth: resolvedMaxWidth,
          boxShadow: "var(--shadow-elevated)",
          border: "1px solid var(--border-standard)",
          overflow: "hidden",
          animation: "modalIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border-standard)",
          }}
        >
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--brand-heading)" }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--brand-body)",
              fontSize: "1.25rem",
              padding: "0.25rem",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "1.5rem", maxHeight: "calc(80vh - 120px)", overflowY: "auto" }}>{children}</div>

        {footer && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "0.75rem",
              padding: "1rem 1.5rem",
              borderTop: "1px solid var(--border-standard)",
              background: "#f8fafc",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
