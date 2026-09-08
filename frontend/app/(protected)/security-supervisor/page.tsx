"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SecuritySupervisorRootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/security-supervisor/dashboard");
  }, [router]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <div className="skeleton" style={{ width: 180, height: 24, margin: "0 auto 1rem auto" }} />
      <p style={{ color: "var(--muted)" }}>Redirecting to Security Supervisor Dashboard…</p>
    </div>
  );
}
