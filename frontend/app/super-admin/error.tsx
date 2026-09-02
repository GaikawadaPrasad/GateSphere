"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/ErrorState";

export default function SuperAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Super Admin error boundary caught:", error);
  }, [error]);

  return (
    <div style={{ padding: "2rem 0" }}>
      <ErrorState
        title="Failed to load Super Admin dashboard"
        message={error.message || "An unexpected error occurred while loading this section."}
        onRetry={reset}
      />
    </div>
  );
}
