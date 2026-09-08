"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/ErrorState";

export default function CommunityAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Community Admin error boundary caught:", error);
  }, [error]);

  return (
    <div style={{ padding: "3rem 1rem", maxWidth: 600, margin: "0 auto" }}>
      <ErrorState
        title="Community Portal Error"
        message={error.message || "An unexpected error occurred while loading community resources."}
        onRetry={reset}
      />
    </div>
  );
}
