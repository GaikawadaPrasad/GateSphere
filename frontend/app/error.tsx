"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/ErrorState";

/**
 * Root error boundary for every route without a closer `error.tsx`. Shows a generic
 * message only — a raw error message can carry internals — plus the digest so support can
 * correlate it with the server log.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root error boundary caught:", error);
  }, [error]);

  return (
    <div style={{ padding: "3rem 1rem", maxWidth: 600, margin: "0 auto" }}>
      <ErrorState
        title="Something went wrong"
        message={
          error.digest
            ? `An unexpected error occurred. Reference: ${error.digest}`
            : "An unexpected error occurred. Please try again."
        }
        onRetry={reset}
      />
    </div>
  );
}
