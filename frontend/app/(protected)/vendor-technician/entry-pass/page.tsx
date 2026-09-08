"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { vendorTicketsApi } from "@/lib/api";

export default function VendorEntryPassPage() {
  const [passData, setPassData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPass() {
      setIsLoading(true);
      const res = await vendorTicketsApi.getEntryPass("VT-901");
      setPassData(res);
      setIsLoading(false);
    }
    loadPass();
  }, []);

  return (
    <div>
      <PageHeader
        title="Digital Gate Entry Pass"
        subtitle="Active digital entry pass with QR verification for Security Guard scanning at community gate"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Vendor" }, { label: "Entry Pass" }]}
      />

      <div className="card" style={{ maxWidth: 540, margin: "0 auto", padding: "1.75rem", background: "linear-gradient(135deg, #ffffff, #f8fafc)" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "2rem" }}>Loading entry pass…</div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>GateSphere Vendor Pass</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Ref Ticket: VT-901</div>
              </div>
              <StatusBadge status={passData?.status || "Active"} />
            </div>

            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Pass Code</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, fontFamily: "monospace", color: "var(--primary)", marginTop: "0.25rem" }}>
                {passData?.pass_code || "PASS-VEN-8812"}
              </div>

              {/* QR Code Container */}
              <div
                style={{
                  width: 160,
                  height: 160,
                  margin: "1.25rem auto",
                  background: "white",
                  border: "2px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ fontSize: "2.5rem" }}>📱</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--fg)", marginTop: "0.5rem" }}>
                  {passData?.qr_code_data || "GS-PASS-VEN-8812-OK"}
                </div>
              </div>

              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.5rem" }}>
                {passData?.technician_name}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                Location: <strong>{passData?.location}</strong>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--success)", fontWeight: 600, marginTop: "0.25rem" }}>
                {passData?.validity}
              </div>
            </div>

            <div
              style={{
                marginTop: "1.25rem",
                padding: "0.75rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--primary-light)",
                border: "1px solid #bfdbfe",
                fontSize: "0.8rem",
                color: "#1e40af",
                textAlign: "center",
              }}
            >
              ℹ️ Show this screen to the Security Guard at Main Gate North for instant QR verification.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
