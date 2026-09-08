"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VendorTechnicianRootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/vendor-technician/dashboard");
  }, [router]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <div className="skeleton" style={{ width: 180, height: 24, margin: "0 auto 1rem auto" }} />
      <p style={{ color: "var(--muted)" }}>Redirecting to Vendor / Technician Dashboard…</p>
    </div>
  );
}
