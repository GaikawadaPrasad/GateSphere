"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { vendorTicketsApi } from "@/lib/api";

export default function VendorWorkCompletionPage() {
  const router = useRouter();
  const [ticketNumber, setTicketNumber] = useState("VT-901");
  const [workPerformed, setWorkPerformed] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:30");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const handleSubmitCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workPerformed.trim()) return;
    setIsSubmitting(true);
    await vendorTicketsApi.submitCompletion(ticketNumber, {
      work_performed: workPerformed,
      materials_used: materialsUsed,
      start_time: startTime,
      end_time: endTime,
      remarks,
    });
    setIsSubmitting(false);
    setSubmittedSuccess(true);
    setTimeout(() => router.push("/vendor-technician/dashboard"), 1500);
  };

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
            Job completion proof for ticket <strong>{ticketNumber}</strong> has been sent to the Facility Manager for final review.
          </p>
        </div>
      )}

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-header">
          <h3 className="card-title">Completion Report Form</h3>
        </div>

        <form onSubmit={handleSubmitCompletion}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Assigned Ticket Number *
            </label>
            <select
              className="select-field"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
            >
              <option value="VT-901">VT-901: Swimming Pool Pump Replacement</option>
              <option value="VT-902">VT-902: Elevator B3 Sensor Error Code E-409</option>
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Work Performed Summary *
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Describe work completed (e.g. Replaced dual impeller pump & pressure tested chlorination line)..."
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
            disabled={isSubmitting}
            style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem", fontWeight: 700 }}
          >
            {isSubmitting ? "Submitting…" : "SUBMIT FOR MANAGER REVIEW"}
          </button>
        </form>
      </div>
    </div>
  );
}
