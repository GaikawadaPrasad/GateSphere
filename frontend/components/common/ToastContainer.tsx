"use client";

import React from "react";
import { useToastStore, ToastItem } from "@/store/toast";

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "1.25rem",
        right: "1.25rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        maxWidth: "420px",
        width: "calc(100vw - 2.5rem)",
        pointerEvents: "none",
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const getTheme = () => {
    switch (toast.type) {
      case "success":
        return {
          bg: "#F0FDF4",
          border: "#86EFAC",
          text: "#166534",
          titleColor: "#14532D",
          icon: "✅",
          shadow: "rgba(34, 197, 94, 0.15)",
        };
      case "error":
        return {
          bg: "#FEF2F2",
          border: "#FCA5A5",
          text: "#991B1B",
          titleColor: "#7F1D1D",
          icon: "⚠️",
          shadow: "rgba(239, 68, 68, 0.15)",
        };
      case "warning":
        return {
          bg: "#FFFBEB",
          border: "#FCD34D",
          text: "#92400E",
          titleColor: "#78350F",
          icon: "🔔",
          shadow: "rgba(245, 158, 11, 0.15)",
        };
      case "info":
      default:
        return {
          bg: "#EFF6FF",
          border: "#93C5FD",
          text: "#1E40AF",
          titleColor: "#1E3A8A",
          icon: "ℹ️",
          shadow: "rgba(59, 130, 246, 0.15)",
        };
    }
  };

  const theme = getTheme();

  return (
    <div
      role="alert"
      style={{
        pointerEvents: "auto",
        background: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: "10px",
        padding: "1rem 1.15rem",
        boxShadow: `0 8px 24px ${theme.shadow}, 0 2px 6px rgba(0,0,0,0.06)`,
        display: "flex",
        alignItems: "flex-start",
        gap: "0.85rem",
        animation: "toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        color: theme.text,
        fontSize: "14px",
      }}
    >
      <span style={{ fontSize: "1.25rem", lineHeight: 1, marginTop: "2px" }}>{theme.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <h4
            style={{
              fontWeight: 700,
              fontSize: "14px",
              color: theme.titleColor,
              marginBottom: "0.2rem",
            }}
          >
            {toast.title}
          </h4>
        )}
        <p style={{ margin: 0, lineHeight: 1.45, wordBreak: "break-word" }}>{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: theme.text,
          opacity: 0.7,
          fontSize: "16px",
          padding: "0 0.2rem",
          lineHeight: 1,
          marginTop: "2px",
        }}
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
}
