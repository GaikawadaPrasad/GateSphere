"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { complaintsApi, vendorsApi, getCsrfToken } from "@/lib/api";
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
  const PAGE_SIZE = 50;
  const [complaints, setComplaints] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadData = async (reset = true) => {
    const currentPage = reset ? 1 : page + 1;
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setLoadError(null);
    try {
      const [ticketsRes, categoriesRes, vendorsRes] = await Promise.allSettled([
        complaintsApi.list({ page: currentPage, page_size: PAGE_SIZE }),
        complaintsApi.categories(),
        vendorsApi.list(),
      ]);

      if (reset && categoriesRes.status === "fulfilled") {
        const map: Record<string, string> = {};
        for (const c of categoriesRes.value || []) if (c?.id) map[c.id] = c.name;
        setCategoryMap(map);
      }

      if (reset && vendorsRes.status === "fulfilled") {
        setVendors((vendorsRes.value || []).map((v: any) => ({
          id: v.id,
          name: v.full_name || v.name || v.email,
        })));
      }

      if (ticketsRes.status === "fulfilled") {
        const items = (ticketsRes.value || []).sort((a: any, b: any) =>
          b.ticket_number.localeCompare(a.ticket_number),
        );
        setComplaints((prev) => reset ? items : [...prev, ...items]);
        setHasMore(items.length === PAGE_SIZE);
        if (!reset) setPage(currentPage);
      } else {
        setLoadError((ticketsRes as any).reason?.message || "Failed to load complaints.");
      }
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load complaints.");
    } finally {
      if (reset) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  };

  useEffect(() => { loadData(true); }, []);

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
    setNewMessage("");
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const [histRes, msgRes] = await Promise.allSettled([
        fetch(`/api/v1/complaints/tickets/${c.id}/history`, { credentials: "include", headers: { Accept: "application/json", "X-Session-Role": "facility_manager" } }).then(r => r.json()),
        fetch(`/api/v1/complaints/tickets/${c.id}/messages`, { credentials: "include", headers: { Accept: "application/json", "X-Session-Role": "facility_manager" } }).then(r => r.json()),
      ]);
      if (histRes.status === "fulfilled") setHistory(histRes.value?.data || histRes.value || []);
      if (msgRes.status === "fulfilled") setMessages(msgRes.value?.data || msgRes.value || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!historyTicket || !newMessage.trim()) return;
    setIsSendingMessage(true);
    try {
      const res = await fetch(`/api/v1/complaints/tickets/${historyTicket.id}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-Session-Role": "facility_manager", ...(getCsrfToken() ? { "X-CSRF-Token": getCsrfToken()! } : {}) },
        body: JSON.stringify({ message: newMessage.trim(), is_internal: true }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      const saved = await res.json();
      setMessages(prev => [...prev, saved?.data || saved]);
      setNewMessage("");
    } catch (err: any) {
      alert(err?.message || "Failed to send message.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const filteredComplaints = complaints.filter((c) => {
    const subject = (c.subject || "").toLowerCase();
    const ticketNum = (c.ticket_number || "").toLowerCase();
    const category = (categoryMap[c.category_id] || "").toLowerCase();
    const matchSearch =
      ticketNum.includes(search.toLowerCase()) ||
      subject.includes(search.toLowerCase()) ||
      category.includes(search.toLowerCase());
    const matchPriority = priorityFilter === "all" || c.priority === priorityFilter;
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchPriority && matchStatus;
  });

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
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredComplaints.length} complaints
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: "100%", maxWidth: 220 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search ticket #, subject, category…" />
            </div>
            <select className="select-field" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={{ width: "auto", height: 36 }}>
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select className="select-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: "auto", height: 36 }}>
              <option value="all">All Statuses</option>
              {Object.keys(VALID_TRANSITIONS).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Complaint #</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Priority</th>
                <th>SLA</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>Loading complaints…</td></tr>
              ) : loadError ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--danger, #dc2626)" }}>{loadError}</td></tr>
              ) : filteredComplaints.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>No complaints found.</td></tr>
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
                      <td>{categoryMap[c.category_id] || "—"}</td>
                      <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        {c.unit_id ? String(c.unit_id).slice(0, 8) + "…" : "Common Area"}
                      </td>
                      <td><StatusBadge status={c.priority} /></td>
                      <td><StatusBadge status={deriveSlaStatus(c)} /></td>
                      <td><StatusBadge status={c.status} /></td>
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
                              {["assigned", "acknowledged", "in_progress"].includes(c.status) ? "Reassign" : "Assign"}
                            </button>
                          )}
                          {allowed.includes("in_progress") && (
                            <button className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }} onClick={() => handleStatusChange(c.id, "in_progress")}>
                              Start Work
                            </button>
                          )}
                          {allowed.includes("resolved") && (
                            <button className="btn btn-primary" style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }} onClick={() => handleStatusChange(c.id, "resolved")}>
                              Resolve
                            </button>
                          )}
                          {allowed.includes("cancelled") && (
                            <button className="btn btn-danger" style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }} onClick={() => handleStatusChange(c.id, "cancelled")}>
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {hasMore && !search && priorityFilter === "all" && statusFilter === "all" && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "1rem" }}>
                      <button className="btn btn-secondary" onClick={() => loadData(false)} disabled={isLoadingMore}>
                        {isLoadingMore ? "Loading…" : "Load More"}
                      </button>
                    </td>
                  </tr>
                )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Vendor Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Vendor — ${selectedComplaint?.ticket_number || ""}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAssignModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAssignVendor} disabled={!selectedVendorId}>
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
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Select Vendor / Technician
            </label>
            {vendors.length === 0 ? (
              <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>No vendor technicians registered. Add one via the Vendors page.</p>
            ) : (
              <select className="select-field" value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)}>
                <option value="">— Select from list —</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Ticket — ${historyTicket?.ticket_number || ""}`}
        footer={<button className="btn btn-secondary" onClick={() => setIsHistoryModalOpen(false)}>Close</button>}
      >
        <div>
          {historyTicket && (
            <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--surface)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}>
              <strong>{historyTicket.subject}</strong>
              <span style={{ marginLeft: "0.75rem", color: "var(--muted)" }}>{categoryMap[historyTicket.category_id] || "—"}</span>
            </div>
          )}
          {historyLoading ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Loading…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Status History */}
              {history.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status History</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {history.map((h: any, i: number) => (
                      <div key={h.id || i} style={{ padding: "0.5rem 0.75rem", borderLeft: "3px solid var(--primary)", background: "var(--surface)", borderRadius: "0 var(--radius-sm) var(--radius-sm) 0", fontSize: "0.82rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                          <StatusBadge status={h.to_status || h.status || "—"} />
                          <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{fmtDate(h.changed_at || h.created_at)}</span>
                        </div>
                        {h.remarks && <div style={{ color: "var(--fg)", marginTop: "0.2rem" }}>{h.remarks}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Messages / Notes */}
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes & Messages</div>
                {messages.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>No messages yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    {messages.map((m: any, i: number) => (
                      <div key={m.id || i} style={{ padding: "0.5rem 0.75rem", background: "var(--surface)", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", borderLeft: "3px solid var(--border)" }}>
                        <div style={{ color: "var(--fg)" }}>{m.message}</div>
                        <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.2rem" }}>{fmtDate(m.created_at)}</div>
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
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={handleSendMessage} disabled={isSendingMessage || !newMessage.trim()} style={{ whiteSpace: "nowrap" }}>
                    {isSendingMessage ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
