"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/ErrorState";

export default function DomesticStaffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Domestic Staff error boundary caught:", error);
  }, [error]);

  return (
    <div style={{ padding: "2rem 0" }}>
      <ErrorState
        title="Failed to load Domestic Staff Portal"
        message={
          error.message ||
          "An unexpected error occurred while loading this staff operations section."
        }
        onRetry={reset}
      />
    </div>
  );
}
