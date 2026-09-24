"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown by the root layout itself. It replaces the root
 * layout, so it renders its own <html>/<body> and uses inline styles only.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f6f9",
          color: "#0f1724",
          fontFamily: "system-ui, sans-serif",
          padding: "1rem",
        }}
      >
        <main role="alert" style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 0.5rem" }}>
            GateSphere is temporarily unavailable
          </h1>
          <p style={{ margin: "0 0 1.25rem" }}>
            An unexpected error occurred.
            {error.digest ? ` Reference: ${error.digest}` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#4f8ef7",
              color: "#0f1724",
              border: 0,
              borderRadius: 8,
              padding: "0.6rem 1.2rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
