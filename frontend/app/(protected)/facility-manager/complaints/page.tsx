"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { complaintsApi, vendorsApi, getCsrfToken } from "@/lib/api";
import { FileUpload } from "@/components/common/FileUpload";
import { toast } from "@/store/toast";
import { formatDate as fmtDate } from "@/lib/utils";

function deriveSlaStatus(c: any): string {
  if (c.sla_breached_at) return "breached";
  if (c.escalation_due_at && new Date(c.escalation_due_at) < new Date()) return "at_risk";
  if (c.resolution_due_at && new Date(c.resolution_due_at) < new Date()) return "at_risk";
  return "on_track";
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  created: ["assigned", "cancelled"],
  assigned: ["acknowledged", "in_progress", "cancelled"],
  acknowledged: ["in_progress", "cancelled"],
  in_progress: ["resolved", "cancelled"],
  resolved: [],
  resident_confirmation: [],
  reopened: ["assigned", "in_progress", "cancelled"],
  closed: [],
  cancelled: [],
};

const TERMINAL_STATUSES = ["closed", "cancelled", "resolved", "resident_confirmation"];

export default function FacilityManagerComplaintsPage() {
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Assign vendor modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");

  // History modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyTicket, setHistoryTicket] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [ticketFeedback, setTicketFeedback] = useState<{
    rating: number;
    comments: string | null;
  } | null>(null);

  const loadData = async (targetPage = page, loadCategories = false) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const q = search.trim() || undefined;
      const status = statusFilter === "all" ? undefined : statusFilter;
      const priority = priorityFilter === "all" ? undefined : priorityFilter;

      const promises: any[] = [
        complaintsApi.listPaginated({
          page: targetPage,
          page_size: pageSize,
          q,
          ticket_status: status,
          priority,
        }),
      ];
      if (loadCategories) {
        promises.push(complaintsApi.categories());
        promises.push(vendorsApi.list());
      }

      const results = await Promise.allSettled(promises);
      const ticketsRes = results[0];

      if (loadCategories) {
        const categoriesRes = results[1];
        const vendorsRes = results[2];
        if (categoriesRes?.status === "fulfilled") {
          const map: Record<string, string> = {};
          for (const c of categoriesRes.value || []) if (c?.id) map[c.id] = c.name;
          setCategoryMap(map);
        }
        if (vendorsRes?.status === "fulfilled") {
          setVendors(
            (vendorsRes.value || []).map((v: any) => ({
              id: v.id,
              name: v.full_name || v.name || v.email,
            })),
          );
        }
      }

      if (ticketsRes.status === "fulfilled") {
        const res = ticketsRes.value as any;
        const rawList: any[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : [];
        const items = [...rawList].sort(
          (a: any, b: any) =>
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime(),
        );
        setComplaints(items);
        setTotal(res?.meta?.total ?? rawList.length);
        setPage(targetPage);
      } else {
        setLoadError(ticketsRes.reason?.message || "Failed to load complaints.");
      }
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load complaints.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      loadData(1, Object.keys(categoryMap).length === 0);
    }, 300);
    return () => clearTimeout(handler);
  }, [search, statusFilter, priorityFilter, pageSize]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const updated = await complaintsApi.updateStatus(id, status);
      const actualStatus = (updated as any)?.status || status;
      setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status: actualStatus } : c)));
    } catch (err: any) {
      alert(err?.message || "Failed to update status.");
    }
  };

  const handleAssignVendor = async () => {
    if (!selectedComplaint || !selectedVendorId) return;
    try {
      await complaintsApi.assignVendor(selectedComplaint.id, selectedVendorId);
      setIsAssignModalOpen(false);
      setSelectedVendorId("");
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to assign vendor.");
    }
  };

  const openHistory = async (c: any) => {
    setHistoryTicket(c);
    setHistory([]);
    setMessages([]);
    setAttachments([]);
    setNewMessage("");
    setTicketFeedback(null);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const [histRes, msgRes, attRes, fbRes] = await Promise.allSettled([
        fetch(`/api/v1/complaints/tickets/${c.id}/history`, {
          credentials: "include",
          headers: { Accept: "application/json", "X-Session-Role": "facility_manager" },
        }).then((r) => r.json()),
        fetch(`/api/v1/complaints/tickets/${c.id}/messages`, {
          credentials: "include",
          headers: { Accept: "application/json", "X-Session-Role": "facility_manager" },
        }).then((r) => r.json()),
        complaintsApi.attachments(c.id),
        complaintsApi.getFeedback(c.id),
      ]);
      if (histRes.status === "fulfilled") setHistory(histRes.value?.data || histRes.value || []);
      if (msgRes.status === "fulfilled") setMessages(msgRes.value?.data || msgRes.value || []);
      if (attRes.status === "fulfilled")
        setAttachments((attRes.value as any)?.data || (attRes.value as any) || []);
      if (fbRes.status === "fulfilled" && fbRes.value) setTicketFeedback(fbRes.value);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleUploadAttachment = async (url: string) => {
    if (!historyTicket?.id) return;
    try {
      const newAtt = await complaintsApi.addAttachment(historyTicket.id, {
        file_url: url,
        file_name: "Work-completion proof / attachment",
      });
      setAttachments((prev) => [...prev, newAtt?.data || newAtt]);
      toast.success("Attachment added successfully");
    } catch (err: any) {
      alert(err?.message || "Failed to add attachment");
    }
  };

  const handleSendMessage = async () => {
    if (!historyTicket || !newMessage.trim()) return;
    setIsSendingMessage(true);
    try {
      const res = await fetch(`/api/v1/complaints/tickets/${historyTicket.id}/messages`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Session-Role": "facility_manager",
          ...(getCsrfToken() ? { "X-CSRF-Token": getCsrfToken()! } : {}),
        },
        body: JSON.stringify({ message: newMessage.trim(), is_internal: true }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      const saved = await res.json();
      setMessages((prev) => [...prev, saved?.data || saved]);
      setNewMessage("");
    } catch (err: any) {
      alert(err?.message || "Failed to send message.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const filteredComplaints = complaints;

  return (
    <div>
      <PageHeader
        title="Complaints Management & Escalations"
        subtitle="Review resident complaints, assign vendors/patrols, and track SLA escalations"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Facility Manager" },
          { label: "Complaints" },
        ]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Resident Complaints Log</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>{total} total complaints</p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: "100%", maxWidth: 220 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search ticket #, subject, category…"
              />
            </div>
            <select
              className="select-field"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select
              className="select-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Statuses</option>
              {Object.keys(VALID_TRANSITIONS).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Resident</th>
                <th>Unit</th>
                <th>Contact Info</th>
                <th>Priority</th>
                <th>SLA</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading complaints…
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "var(--danger, #dc2626)",
                    }}
                  >
                    {loadError}
                  </td>
                </tr>
              ) : filteredComplaints.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No complaints found.
                  </td>
                </tr>
              ) : (
                <>
                  {filteredComplaints.map((c) => {
                    const allowed = VALID_TRANSITIONS[c.status] || [];
                    const isTerminal = TERMINAL_STATUSES.includes(c.status);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.1rem 0.35rem" }}
                            onClick={() => openHistory(c)}
                            title="View history"
                          >
                            {c.ticket_number}
                          </button>
                        </td>
                        <td style={{ fontWeight: 500, color: "var(--fg)" }}>{c.subject}</td>
                        <td>{c.category_name || categoryMap[c.category_id] || "—"}</td>
                        <td>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              color: "var(--fg)",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.3rem",
                            }}
                          >
                            <span>👤</span>
                            <span>{c.raised_by_name || "Resident"}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                          <span
                            style={{
                              display: "inline-block",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              color: "var(--primary-dark, #1e40af)",
                              background: "var(--primary-subtle, #eff6ff)",
                              padding: "0.15rem 0.45rem",
                              borderRadius: "4px",
                              border: "1px solid #bfdbfe",
                              whiteSpace: "nowrap",
                            }}
                          >
                            🏢{" "}
                            {c.unit_number
                              ? `Unit ${c.unit_number}`
                              : c.unit_id
                                ? `Unit ${String(c.unit_id).slice(0, 6)}`
                                : "Common Area"}
                          </span>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.15rem",
                              fontSize: "0.78rem",
                            }}
                          >
                            {c.raised_by_phone && (
                              <a
                                href={`tel:${c.raised_by_phone}`}
                                style={{
                                  color: "var(--fg)",
                                  textDecoration: "none",
                                  fontWeight: 500,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                }}
                                title={`Call ${c.raised_by_name || "Resident"}`}
                              >
                                <span>📞</span>
                                <span>{c.raised_by_phone}</span>
                              </a>
                            )}
                            {c.raised_by_email && (
                              <a
                                href={`mailto:${c.raised_by_email}`}
                                style={{
                                  color: "var(--muted)",
                                  textDecoration: "none",
                                  fontSize: "0.72rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                }}
                                title={`Email ${c.raised_by_email}`}
                              >
                                <span>✉️</span>
                                <span
                                  style={{
                                    maxWidth: 120,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {c.raised_by_email}
                                </span>
                              </a>
                            )}
                            {!c.raised_by_phone && !c.raised_by_email && (
                              <span style={{ color: "var(--muted)" }}>—</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={c.priority} />
                        </td>
                        <td>
                          <StatusBadge status={deriveSlaStatus(c)} />
                        </td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                            {!isTerminal && (
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                                onClick={() => {
                                  setSelectedComplaint(c);
                                  setSelectedVendorId("");
                                  setIsAssignModalOpen(true);
                                }}
                              >
                                {["assigned", "acknowledged", "in_progress"].includes(c.status)
                                  ? "Reassign"
                                  : "Assign"}
                              </button>
                            )}
                            {allowed.includes("in_progress") && (
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                                onClick={() => handleStatusChange(c.id, "in_progress")}
                              >
                                Start Work
                              </button>
                            )}
                            {allowed.includes("resolved") && (
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                                onClick={() => handleStatusChange(c.id, "resolved")}
                              >
                                Resolve
                              </button>
                            )}
                            {allowed.includes("cancelled") && (
                              <button
                                className="btn btn-danger"
                                style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                                onClick={() => handleStatusChange(c.id, "cancelled")}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredComplaints.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "1rem" }}>
                        No complaints found.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {total > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem",
                borderTop: "1px solid var(--border)",
                background: "var(--surface)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Rows per page:</span>
                <select
                  className="select-field"
                  style={{ width: "auto", height: 30, padding: "0 0.5rem" }}
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of{" "}
                  {total}
                </span>
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "0.25rem 0.75rem" }}
                    disabled={page === 1 || isLoading}
                    onClick={() => loadData(page - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "0.25rem 0.75rem" }}
                    disabled={page * pageSize >= total || isLoading}
                    onClick={() => loadData(page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Vendor Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Vendor — ${selectedComplaint?.ticket_number || ""}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAssignVendor}
              disabled={!selectedVendorId}
            >
              Confirm Assignment
            </button>
          </>
        }
      >
        <div>
          <p style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
            Assign a vendor or technician to <strong>{selectedComplaint?.subject}</strong>:
          </p>
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Select Vendor / Technician
            </label>
            {vendors.length === 0 ? (
              <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                No vendor technicians registered. Add one via the Vendors page.
              </p>
            ) : (
              <select
                className="select-field"
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
              >
                <option value="">— Select from list —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Ticket — ${historyTicket?.ticket_number || ""}`}
        footer={
          <button className="btn btn-secondary" onClick={() => setIsHistoryModalOpen(false)}>
            Close
          </button>
        }
      >
        <div>
          {historyTicket && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem",
                background: "var(--surface)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
              }}
            >
              <strong>{historyTicket.subject}</strong>
              <span style={{ marginLeft: "0.75rem", color: "var(--muted)" }}>
                {historyTicket.category_name || categoryMap[historyTicket.category_id] || "—"}
              </span>

              {/* Resident Details Banner */}
              <div
                style={{
                  marginTop: "0.6rem",
                  paddingTop: "0.6rem",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  gap: "1.25rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                  fontSize: "0.82rem",
                }}
              >
                <div>
                  👤 <strong>Resident:</strong> {historyTicket.raised_by_name || "Resident"}
                </div>
                <div>
                  🏢 <strong>Unit:</strong>{" "}
                  {historyTicket.unit_number
                    ? `Unit ${historyTicket.unit_number}`
                    : historyTicket.unit_id
                      ? `Unit ${String(historyTicket.unit_id).slice(0, 6)}`
                      : "Common Area"}
                </div>
                {historyTicket.raised_by_phone && (
                  <div>
                    📞 <strong>Phone:</strong>{" "}
                    <a
                      href={`tel:${historyTicket.raised_by_phone}`}
                      style={{ color: "var(--primary)" }}
                    >
                      {historyTicket.raised_by_phone}
                    </a>
                  </div>
                )}
                {historyTicket.raised_by_email && (
                  <div>
                    ✉️ <strong>Email:</strong>{" "}
                    <a
                      href={`mailto:${historyTicket.raised_by_email}`}
                      style={{ color: "var(--primary)" }}
                    >
                      {historyTicket.raised_by_email}
                    </a>
                  </div>
                )}
              </div>
              {ticketFeedback && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Resident Rating
                  </span>
                  <span style={{ color: "#f59e0b", fontSize: "1rem", letterSpacing: 1 }}>
                    {"★".repeat(ticketFeedback.rating)}
                    {"☆".repeat(5 - ticketFeedback.rating)}
                  </span>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg)" }}>
                    {ticketFeedback.rating}/5
                  </span>
                  {ticketFeedback.comments && (
                    <span
                      style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}
                    >
                      — {ticketFeedback.comments}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          {historyLoading ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Loading…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Status History */}
              {history.length > 0 && (
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      marginBottom: "0.5rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Status History
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {history.map((h: any, i: number) => (
                      <div
                        key={h.id || i}
                        style={{
                          padding: "0.5rem 0.75rem",
                          borderLeft: "3px solid var(--primary)",
                          background: "var(--surface)",
                          borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
                          fontSize: "0.82rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "0.2rem",
                          }}
                        >
                          <StatusBadge status={h.to_status || h.status || "—"} />
                          <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                            {fmtDate(h.changed_at || h.created_at)}
                          </span>
                        </div>
                        {h.remarks && (
                          <div style={{ color: "var(--fg)", marginTop: "0.2rem" }}>{h.remarks}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Messages / Notes */}
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    color: "var(--muted)",
                    marginBottom: "0.5rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Notes & Messages
                </div>
                {messages.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>No messages yet.</p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {messages.map((m: any, i: number) => (
                      <div
                        key={m.id || i}
                        style={{
                          padding: "0.5rem 0.75rem",
                          background: "var(--surface)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.82rem",
                          borderLeft: "3px solid var(--border)",
                        }}
                      >
                        <div style={{ color: "var(--fg)" }}>{m.message}</div>
                        <div
                          style={{
                            color: "var(--muted)",
                            fontSize: "0.75rem",
                            marginTop: "0.2rem",
                          }}
                        >
                          {fmtDate(m.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Add an internal note…"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleSendMessage}
                    disabled={isSendingMessage || !newMessage.trim()}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {isSendingMessage ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>

              {/* Attachments & Proof of Work */}
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    color: "var(--muted)",
                    marginBottom: "0.5rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Attachments & Work-Completion Proof
                </div>
                {attachments.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                    No attachments uploaded yet.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {attachments.map((a: any, i: number) => (
                      <a
                        key={a.id || i}
                        href={a.file_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          padding: "0.35rem 0.65rem",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.8rem",
                          textDecoration: "none",
                          color: "var(--primary)",
                        }}
                      >
                        📎 {a.file_name || "Attachment"}
                      </a>
                    ))}
                  </div>
                )}
                <div
                  style={{
                    marginTop: "0.5rem",
                    padding: "0.75rem",
                    background: "var(--surface)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <FileUpload
                    kind="ticket_attachment"
                    label="Upload work-completion proof or issue photo"
                    onUploadComplete={handleUploadAttachment}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
