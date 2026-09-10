"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/ErrorState";

export default function AuditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Auditor error boundary caught:", error);
  }, [error]);

  return (
    <div style={{ padding: "2rem 0" }}>
      <ErrorState
        title="Failed to load Auditor Console"
        message={
          error.message ||
          "An unexpected error occurred while loading this compliance audit section."
        }
        onRetry={reset}
      />
    </div>
  );
}
