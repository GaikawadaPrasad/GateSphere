"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { vendorTicketsApi } from "@/lib/api";

export default function VendorWorkCompletionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTicketId = searchParams.get("ticketId");

  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [workPerformed, setWorkPerformed] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:30");
  const [remarks, setRemarks] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadTickets() {
      setIsLoading(true);
      try {
        const list = await vendorTicketsApi.list();
        const activeList = (list || []).filter(
          (t: any) => t.status === "in_progress" || t.status === "acknowledged" || t.status === "assigned"
        );
        setTickets(activeList);
        if (urlTicketId) {
          setSelectedTicketId(urlTicketId);
        } else if (activeList.length > 0) {
          setSelectedTicketId(String(activeList[0].id));
        }
      } catch {
        setTickets([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadTickets();
  }, [urlTicketId]);

  const handleSubmitCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId) {
      setErrorMsg("Please select an active ticket");
      return;
    }
    if (!workPerformed.trim()) return;
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const summary = `Work: ${workPerformed}. Materials: ${materialsUsed || "None"}. Time: ${startTime}-${endTime}. Remarks: ${remarks || "Work completed on site."}`.trim();
      await vendorTicketsApi.submitCompletion(selectedTicketId, summary);
      setIsSubmitting(false);
      setSubmittedSuccess(true);
      setTimeout(() => router.push("/vendor-technician/service-history"), 1500);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || "Failed to submit work completion.");
    }
  };

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  return (
    <div>
      <PageHeader
        title="Work Completion Submission"
        subtitle="Submit completed work details, materials utilized, and completion proof for Facility Manager approval"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Vendor" }, { label: "Work Completion" }]}
      />

      {submittedSuccess && (
        <div
          style={{
            padding: "1.25rem",
            marginBottom: "1.5rem",
            background: "var(--success-light)",
            border: "1px solid var(--success-border)",
            borderRadius: "var(--radius)",
            color: "#065f46",
          }}
        >
          <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.4rem" }}>
            ✅ WORK COMPLETION SUBMITTED SUCCESSFULLY
          </h3>
          <p style={{ fontSize: "0.9rem", color: "#047857" }}>
            Job completion proof for ticket <strong>{selectedTicket?.ticket_number || selectedTicketId}</strong> has been recorded and submitted for manager signoff.
          </p>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            background: "var(--danger-light, #fee2e2)",
            border: "1px solid var(--danger-border, #fca5a5)",
            borderRadius: "var(--radius-sm)",
            color: "#991b1b",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {errorMsg}
        </div>
      )}

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-header">
          <h3 className="card-title">Completion Report Form</h3>
        </div>

        <form onSubmit={handleSubmitCompletion}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Assigned Ticket *
            </label>
            {isLoading ? (
              <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Loading active jobs…</div>
            ) : tickets.length === 0 ? (
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", padding: "0.5rem 0" }}>
                No active service tickets found to complete.
              </div>
            ) : (
              <select
                className="select-field"
                value={selectedTicketId}
                onChange={(e) => setSelectedTicketId(e.target.value)}
                required
              >
                {tickets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.ticket_number || `TKT-${t.id.slice(0, 6)}`}: {t.subject || "Service Work"} ({t.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Work Performed Summary *
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Describe work completed (e.g. Replaced dual impeller pump & pressure tested line)..."
              value={workPerformed}
              onChange={(e) => setWorkPerformed(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Materials / Spare Parts Used
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Dual Impeller Pump Model-4B, 2x Rubber Gaskets"
              value={materialsUsed}
              onChange={(e) => setMaterialsUsed(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Start Time
              </label>
              <input
                type="time"
                className="input-field"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Completion Time
              </label>
              <input
                type="time"
                className="input-field"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Technician Remarks / Signoff Notes
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Facility tested and handed back in operational condition."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || tickets.length === 0}
            style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem", fontWeight: 700 }}
          >
            {isSubmitting ? "Submitting…" : "SUBMIT FOR MANAGER REVIEW"}
          </button>
        </form>
      </div>
    </div>
  );
}
