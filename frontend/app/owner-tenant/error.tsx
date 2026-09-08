"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/ErrorState";

export default function OwnerTenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Owner/Tenant error boundary caught:", error);
  }, [error]);

  return (
    <div style={{ padding: "2rem 0" }}>
      <ErrorState
        title="Failed to load Resident Portal"
        message={error.message || "An unexpected error occurred while loading this resident self-service section."}
        onRetry={reset}
      />
    </div>
  );
}
