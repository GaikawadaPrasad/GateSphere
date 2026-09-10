"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { complaintsApi, authApi, type CurrentUser, type ServiceTicket } from "@/lib/api";

export default function VendorEntryPassPage() {
  const [activeTicket, setActiveTicket] = useState<ServiceTicket | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPass() {
      setIsLoading(true);
      try {
        const [ticketsRes, meRes] = await Promise.allSettled([
          complaintsApi.tickets({ page_size: 20 }),
          authApi.me("vendor_technician"),
        ]);

        if (meRes.status === "fulfilled" && meRes.value) {
          setCurrentUser(meRes.value);
        }

        if (ticketsRes.status === "fulfilled" && Array.isArray(ticketsRes.value)) {
          // Priority: in_progress first, then acknowledged, then assigned
          const inProgress = ticketsRes.value.find((t) => t.status === "in_progress");
          const acknowledged = ticketsRes.value.find((t) => t.status === "acknowledged");
          const assigned = ticketsRes.value.find(
            (t) => t.status === "assigned" || t.status === "created",
          );
          setActiveTicket(inProgress || acknowledged || assigned || null);
        }
      } catch {
        setActiveTicket(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadPass();
  }, []);

  const passCode = activeTicket
    ? `PASS-VEN-${activeTicket.ticket_number.replace(/\D/g, "").slice(-4) || "8812"}`
    : "NO-ACTIVE-PASS";

  const qrData = activeTicket
    ? `GS-PASS-${activeTicket.ticket_number}-${activeTicket.id.slice(0, 8).toUpperCase()}`
    : "NO-ACTIVE-WORK-ORDER";

  return (
    <div>
      <PageHeader
        title="Digital Gate Entry Pass"
        subtitle="Active digital entry pass with QR verification for Security Guard scanning at community gate"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Vendor" }, { label: "Entry Pass" }]}
      />

      <div
        className="card"
        style={{
          maxWidth: 540,
          margin: "0 auto",
          padding: "1.75rem",
          background: "linear-gradient(135deg, #ffffff, #f8fafc)",
        }}
      >
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--muted)" }}>
            Loading active entry pass…
          </div>
        ) : !activeTicket ? (
          <div style={{ textAlign: "center", padding: "2.5rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎫</div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              No Active Work Order
            </h3>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--muted)",
                maxWidth: 360,
                margin: "0 auto",
              }}
            >
              Entry passes are automatically generated when you have an assigned, acknowledged, or
              in-progress service ticket.
            </p>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "0.75rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>GateSphere Vendor Pass</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Ref Ticket:{" "}
                  <strong style={{ color: "var(--fg)" }}>{activeTicket.ticket_number}</strong>
                </div>
              </div>
              <StatusBadge
                status={activeTicket.status === "in_progress" ? "Active" : "Authorized"}
              />
            </div>

            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Pass Code
              </div>
              <div
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  color: "var(--primary)",
                  marginTop: "0.25rem",
                }}
              >
                {passCode}
              </div>

              {/* QR Code Container */}
              <div
                style={{
                  width: 170,
                  height: 170,
                  margin: "1.25rem auto",
                  background: "white",
                  border: "2px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ fontSize: "2.75rem" }}>📱</div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    color: "var(--fg)",
                    marginTop: "0.5rem",
                    wordBreak: "break-all",
                    textAlign: "center",
                  }}
                >
                  {qrData}
                </div>
              </div>

              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "var(--fg)",
                  marginBottom: "0.25rem",
                }}
              >
                {currentUser?.full_name || "Vendor Technician"}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                Subject: <strong>{activeTicket.subject}</strong>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                Community:{" "}
                <strong>{(currentUser as any)?.community_name || "GateSphere Community"}</strong>
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--success)",
                  fontWeight: 600,
                  marginTop: "0.35rem",
                }}
              >
                Valid for Today&apos;s Scheduled Gate Entry
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
              ℹ️ Show this screen to the Security Guard at Gate for instant QR verification and
              entry authorization.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
