"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { vendorTicketsApi, type VendorTicket } from "@/lib/api";

const PROGRESSION_STEPS = ["Assigned", "Accepted", "On The Way", "Arrived", "In Progress", "Work Completed"];

export default function VendorWorkProgressPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<VendorTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ id: string; msg: string; type: "success" | "error" } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    const data = await vendorTicketsApi.list();
    setTickets(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProgressStep = async (ticketId: string, currentStatus: string, nextStatus: string) => {
    const currIdx = PROGRESSION_STEPS.indexOf(currentStatus);
    const nextIdx = PROGRESSION_STEPS.indexOf(nextStatus);

    if (nextIdx !== currIdx + 1 && !(currIdx === -1 && nextIdx === 1)) {
      setFeedback({ id: ticketId, msg: `Invalid status jump from ${currentStatus} to ${nextStatus}`, type: "error" });
      return;
    }

    await vendorTicketsApi.updateStatus(ticketId, nextStatus);
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: nextStatus as any } : t)));
    setFeedback({ id: ticketId, msg: `Status updated to: ${nextStatus}`, type: "success" });

    if (nextStatus === "Work Completed") {
      setTimeout(() => router.push("/vendor-technician/work-completion"), 800);
    }
  };

  return (
    <div>
      <PageHeader
        title="Work Status Progression"
        subtitle="Update step-by-step job status (Accepted -> On The Way -> Arrived -> In Progress -> Work Completed)"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Vendor" }, { label: "Work Progress" }]}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {isLoading ? (
          <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
            Loading active jobs…
          </div>
        ) : tickets.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
            No active jobs to progress.
          </div>
        ) : (
          tickets.map((t) => {
            const currentIdx = PROGRESSION_STEPS.indexOf(t.status);
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
                  <StatusBadge status={t.status} />
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
                  {PROGRESSION_STEPS.slice(1).map((step, idx) => {
                    const stepNum = idx + 1;
                    const isPassed = currentIdx >= stepNum;
                    const isCurrent = currentIdx === stepNum;
                    return (
                      <div
                        key={step}
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
                          {step}
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
                      background: feedback.type === "success" ? "var(--success-light)" : "var(--danger-light)",
                      border: feedback.type === "success" ? "1px solid var(--success-border)" : "1px solid var(--danger-border)",
                      color: feedback.type === "success" ? "#065f46" : "#991b1b",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    {feedback.msg}
                  </div>
                )}

                {/* Progression Actions */}
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  {t.status === "Assigned" && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleProgressStep(t.id, t.status, "Accepted")}
                    >
                      Step 1: Accept Work
                    </button>
                  )}
                  {t.status === "Accepted" && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleProgressStep(t.id, t.status, "On The Way")}
                    >
                      Step 2: Mark On The Way
                    </button>
                  )}
                  {t.status === "On The Way" && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleProgressStep(t.id, t.status, "Arrived")}
                    >
                      Step 3: Mark Arrived at Gate
                    </button>
                  )}
                  {t.status === "Arrived" && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleProgressStep(t.id, t.status, "In Progress")}
                    >
                      Step 4: Start Work
                    </button>
                  )}
                  {t.status === "In Progress" && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleProgressStep(t.id, t.status, "Work Completed")}
                    >
                      Step 5: Mark Work Completed
                    </button>
                  )}
                  {t.status === "Work Completed" && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => router.push("/vendor-technician/work-completion")}
                    >
                      Submit Completion Proof
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
