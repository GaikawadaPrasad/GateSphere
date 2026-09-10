"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { vendorTicketsApi, type VendorTicket } from "@/lib/api";

const PROGRESSION_STEPS = [
  { key: "assigned", label: "Assigned" },
  { key: "acknowledged", label: "Accepted" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Completed" },
];

export default function VendorWorkProgressPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<VendorTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    id: string;
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await vendorTicketsApi.list();
      setTickets(
        (data || []).map((t: any) => ({
          id: t.id,
          ticket_number: t.ticket_number || `TKT-${t.id.slice(0, 6).toUpperCase()}`,
          title: t.subject || "Service Ticket",
          facility: t.vendor_name || "Community Grounds",
          location: t.description || "Community Facility",
          status: t.status || "created",
        })),
      );
    } catch {
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProgressStep = async (ticketId: string, nextStatus: string, remarksText?: string) => {
    try {
      await vendorTicketsApi.updateStatus(
        ticketId,
        nextStatus,
        remarksText || `Updated by technician to ${nextStatus}`,
      );
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: nextStatus as any } : t)),
      );
      setFeedback({
        id: ticketId,
        msg: `Job successfully updated to: ${nextStatus.replace(/_/g, " ").toUpperCase()}`,
        type: "success",
      });

      if (nextStatus === "resolved") {
        setTimeout(() => router.push("/vendor-technician/service-history"), 1000);
      }
    } catch (err: any) {
      setFeedback({
        id: ticketId,
        msg: err?.message || `Failed to transition status to ${nextStatus}`,
        type: "error",
      });
    }
  };

  const getStepIndex = (status: string) => {
    if (status === "created" || status === "assigned") return 0;
    if (status === "acknowledged") return 1;
    if (status === "in_progress") return 2;
    if (status === "resolved" || status === "resident_confirmation" || status === "closed")
      return 3;
    return 0;
  };

  return (
    <div>
      <PageHeader
        title="Work Status Progression"
        subtitle="Update step-by-step job status (Assigned -> Accepted -> In Progress -> Work Completed)"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Vendor" }, { label: "Work Progress" }]}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {isLoading ? (
          <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
            Loading active jobs from backend…
          </div>
        ) : tickets.length === 0 ? (
          <div
            className="card"
            style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
          >
            No service jobs found.
          </div>
        ) : (
          tickets.map((t) => {
            const currentIdx = getStepIndex(t.status);
            const isCompleted =
              t.status === "resolved" ||
              t.status === "resident_confirmation" ||
              t.status === "closed";

            return (
              <div key={t.id} className="card" style={{ border: "1px solid var(--border)" }}>
                <div className="card-header">
                  <div>
                    <h3 className="card-title" style={{ fontSize: "1.1rem" }}>
                      {t.ticket_number}: {t.title}
                    </h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      {t.facility} — {t.location}
                    </p>
                  </div>
                  <StatusBadge status={(t.status || "created").replace(/_/g, " ").toUpperCase()} />
                </div>

                {/* Step Progression Visual Bar */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    position: "relative",
                    margin: "1.5rem 0",
                    padding: "0 0.5rem",
                  }}
                >
                  {PROGRESSION_STEPS.map((step, idx) => {
                    const stepNum = idx + 1;
                    const isPassed = currentIdx >= idx;
                    const isCurrent = currentIdx === idx;
                    return (
                      <div
                        key={step.key}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          zIndex: 2,
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: isPassed ? "var(--primary)" : "#e2e8f0",
                            color: isPassed ? "white" : "var(--muted)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            border: isCurrent ? "3px solid #bfdbfe" : "none",
                          }}
                        >
                          {isPassed ? "✓" : stepNum}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: isCurrent ? 700 : 500,
                            color: isCurrent ? "var(--primary)" : "var(--muted)",
                            marginTop: "0.35rem",
                            textAlign: "center",
                          }}
                        >
                          {step.label}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Feedback Alert */}
                {feedback && feedback.id === t.id && (
                  <div
                    style={{
                      marginBottom: "1rem",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "var(--radius-sm)",
                      background:
                        feedback.type === "success"
                          ? "var(--success-light)"
                          : "var(--danger-light)",
                      border:
                        feedback.type === "success"
                          ? "1px solid var(--success-border)"
                          : "1px solid var(--danger-border)",
                      color: feedback.type === "success" ? "#065f46" : "#991b1b",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    {feedback.msg}
                  </div>
                )}

                {/* Progression Actions */}
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {(t.status === "assigned" || t.status === "created") && (
                    <button
                      className="btn btn-primary"
                      onClick={() =>
                        handleProgressStep(t.id, "acknowledged", "Accepted by Technician")
                      }
                    >
                      Step 1: Accept Work Order
                    </button>
                  )}
                  {t.status === "acknowledged" && (
                    <button
                      className="btn btn-primary"
                      onClick={() =>
                        handleProgressStep(t.id, "in_progress", "Technician started work on site")
                      }
                    >
                      Step 2: Start Work On Site
                    </button>
                  )}
                  {t.status === "in_progress" && (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={() =>
                          router.push(`/vendor-technician/work-completion?ticketId=${t.id}`)
                        }
                      >
                        Step 3: Submit Completion Report
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() =>
                          handleProgressStep(t.id, "resolved", "Work completed and tested on site")
                        }
                      >
                        Quick Complete
                      </button>
                    </>
                  )}
                  {isCompleted && (
                    <span style={{ fontSize: "0.85rem", color: "var(--success)", fontWeight: 600 }}>
                      ✓ Work Completed & Submitted for Final Signoff
                    </span>
                  )}

                  <button
                    className="btn btn-secondary"
                    onClick={() => router.push("/vendor-technician/entry-pass")}
                  >
                    🪪 Digital Gate Pass
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
