"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { serviceRequestsApi, complaintsApi, vendorsApi, getCsrfToken } from "@/lib/api";
import { deriveTicketEscalationState } from "@/lib/utils";

interface ServiceTicket {
  id: string;
  ticket_number: string;
  subject: string;
  category_name: string;
  priority: string;
  status: string;
  escalation_state: string;
}

// Matches _TICKET_ACTIONS in backend service.py — closed/reopened only via /confirm endpoint
const VALID_REQUEST_TRANSITIONS: Record<string, string[]> = {
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

export default function FacilityManagerServiceRequestsPage() {
  const PAGE_SIZE = 50;
  const [requests, setRequests] = useState<ServiceTicket[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");

  // Notes modal
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [notesTicketId, setNotesTicketId] = useState<string | null>(null);
  const [notesTicketSubject, setNotesTicketSubject] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

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
        serviceRequestsApi.list({ page: currentPage, page_size: PAGE_SIZE }),
        complaintsApi.categories(),
        vendorsApi.list(),
      ]);

      if (reset && vendorsRes.status === "fulfilled") {
        setVendors(
          (vendorsRes.value || []).map((v: any) => ({
            id: v.id,
            name: v.full_name || v.name || v.email,
          })),
        );
      }

      const categoryMap = new Map<string, string>();
      if (reset && categoriesRes.status === "fulfilled") {
        for (const c of categoriesRes.value || []) if (c?.id) categoryMap.set(c.id, c.name);
      }

      if (ticketsRes.status === "fulfilled") {
        const items = (ticketsRes.value || [])
          .map((t: any) => ({
            id: t.id,
            ticket_number: t.ticket_number,
            subject: t.subject,
            category_name: categoryMap.get(t.category_id) || "Uncategorized",
            priority: t.priority,
            status: t.status,
            escalation_state: deriveTicketEscalationState(t),
          }))
          .sort((a, b) => b.ticket_number.localeCompare(a.ticket_number));
        setRequests((prev) => reset ? items : [...prev, ...items]);
        setHasMore(items.length === PAGE_SIZE);
        if (!reset) setPage(currentPage);
      } else {
        setLoadError((ticketsRes as any).reason?.message || "Failed to load service requests.");
      }
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load service requests.");
    } finally {
      if (reset) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const handleStatusChange = async (id: string, currentStatus: string, nextStatus: string) => {
    const allowed = VALID_REQUEST_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      alert(`Invalid workflow transition from ${currentStatus} to ${nextStatus}`);
      return;
    }
    try {
      const updated = await serviceRequestsApi.updateStatus(id, nextStatus);
      const actualStatus = (updated as any)?.status || nextStatus;
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: actualStatus } : r)));
    } catch (err: any) {
      alert(err?.message || "Failed to update status.");
    }
  };

  const handleAssignVendor = async () => {
    if (!selectedTicket || !selectedVendorId) return;
    try {
      await serviceRequestsApi.assignVendor(selectedTicket.id, selectedVendorId);
      setIsAssignModalOpen(false);
      setSelectedVendorId("");
      loadData(true);
    } catch (err: any) {
      alert(err?.message || "Failed to assign vendor.");
    }
  };

  const openNotes = async (id: string, subject: string) => {
    setNotesTicketId(id);
    setNotesTicketSubject(subject);
    setMessages([]);
    setNewMessage("");
    setIsNotesModalOpen(true);
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/v1/complaints/tickets/${id}/messages`, { credentials: "include", headers: { Accept: "application/json", "X-Session-Role": "facility_manager" } }).then(r => r.json());
      setMessages(res?.data || res || []);
    } catch { setMessages([]); }
    finally { setNotesLoading(false); }
  };

  const handleSendMessage = async () => {
    if (!notesTicketId || !newMessage.trim()) return;
    setIsSendingMessage(true);
    try {
      const res = await fetch(`/api/v1/complaints/tickets/${notesTicketId}/messages`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-Session-Role": "facility_manager", ...(getCsrfToken() ? { "X-CSRF-Token": getCsrfToken()! } : {}) },
        body: JSON.stringify({ message: newMessage.trim(), is_internal: true }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      const saved = await res.json();
      setMessages(prev => [...prev, saved?.data || saved]);
      setNewMessage("");
    } catch (err: any) { alert(err?.message || "Failed to send."); }
    finally { setIsSendingMessage(false); }
  };

  const filteredRequests = requests.filter((r) => {
    const matchSearch =
      r.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      r.subject.toLowerCase().includes(search.toLowerCase()) ||
      r.category_name.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "all" || r.priority === priorityFilter;
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchSla = slaFilter === "all" || r.escalation_state === slaFilter;
    return matchSearch && matchPriority && matchStatus && matchSla;
  });

  return (
    <div>
      <PageHeader
        title="Service Requests Triage"
        subtitle="Manage resident & facility service tickets, SLA warnings, and vendor assignments"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Facility Manager" },
          { label: "Service Requests" },
        ]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">All Service Tickets</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredRequests.length} tickets listed
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: "100%", maxWidth: 220 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search ticket/subject/category…"
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
              {Object.keys(VALID_REQUEST_TRANSITIONS).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>

            <select
              className="select-field"
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All SLA Statuses</option>
              <option value="on_track">On Track</option>
              <option value="at_risk">At Risk</option>
              <option value="breached">Breached</option>
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
                <th>Priority</th>
                <th>SLA Status</th>
                <th>Ticket Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading service requests…
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "var(--danger, #dc2626)",
                    }}
                  >
                    {loadError}
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No service requests found.
                  </td>
                </tr>
              ) : (
                <>
                {filteredRequests.map((r) => {
                  const allowed = VALID_REQUEST_TRANSITIONS[r.status] || [];
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>
                        <button className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "0.1rem 0.35rem" }} onClick={() => openNotes(r.id, r.subject)}>{r.ticket_number}</button>
                      </td>
                      <td style={{ fontWeight: 500, color: "var(--fg)" }}>{r.subject}</td>
                      <td>{r.category_name}</td>
                      <td>
                        <StatusBadge status={r.priority} />
                      </td>
                      <td>
                        <StatusBadge status={r.escalation_state} />
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          {r.status !== "closed" && r.status !== "cancelled" && r.status !== "resolved" && r.status !== "resident_confirmation" && (
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem", height: 26 }}
                              onClick={() => {
                                setSelectedTicket(r);
                                setSelectedVendorId("");
                                setIsAssignModalOpen(true);
                              }}
                            >
                              {r.status === "assigned" || r.status === "acknowledged" || r.status === "in_progress" ? "Reassign Vendor" : "Assign Vendor"}
                            </button>
                          )}
                          {allowed
                            .filter((nextSt) => nextSt !== "assigned")
                            .map((nextSt) => (
                            <button
                              key={nextSt}
                              className={
                                nextSt === "resolved" ? "btn btn-primary" : "btn btn-secondary"
                              }
                              style={{
                                fontSize: "0.75rem",
                                padding: "0.2rem 0.45rem",
                                height: 26,
                                textTransform: "capitalize",
                              }}
                              onClick={() => handleStatusChange(r.id, r.status, nextSt)}
                            >
                              {nextSt === "cancelled" ? "Cancel" :
                               nextSt === "in_progress" ? "Start Work" :
                               nextSt === "resolved" ? "Resolve" :
                               nextSt === "acknowledged" ? "Acknowledge" :
                               nextSt === "closed" ? "Close" :
                               nextSt === "reopened" ? "Reopen" :
                               nextSt.replace(/_/g, " ")}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {hasMore && !search && priorityFilter === "all" && statusFilter === "all" && slaFilter === "all" && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "1rem" }}>
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

      {/* Notes Modal */}
      <Modal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        title={`Notes — ${notesTicketSubject}`}
        footer={<button className="btn btn-secondary" onClick={() => setIsNotesModalOpen(false)}>Close</button>}
      >
        <div>
          {notesLoading ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Loading…</p>
          ) : (
            <>
              {messages.length === 0 ? (
                <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.75rem" }}>No notes yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  {messages.map((m: any, i: number) => (
                    <div key={m.id || i} style={{ padding: "0.5rem 0.75rem", background: "var(--surface)", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", borderLeft: "3px solid var(--border)" }}>
                      <div>{m.message}</div>
                      <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.2rem" }}>{m.created_at ? new Date(m.created_at).toLocaleString() : ""}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input type="text" className="input-field" placeholder="Add an internal note…" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSendMessage(); } }} style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={handleSendMessage} disabled={isSendingMessage || !newMessage.trim()}>{isSendingMessage ? "Sending…" : "Send"}</button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Assign Vendor Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Vendor to Ticket ${selectedTicket?.ticket_number || ""}`}
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
            Assign a vendor or technician to <strong>{selectedTicket?.subject}</strong>:
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
    </div>
  );
}
