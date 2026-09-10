"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  getStoredDemoRequests,
  updateDemoRequestStatus,
  deleteDemoRequest,
  type DemoRequestLead,
} from "@/lib/demo-requests";
import { formatRelativeTime } from "@/lib/utils";
import { Modal } from "@/components/common/Modal";

interface DemoRequestsCardProps {
  onOnboardCommunity?: (lead: DemoRequestLead) => void;
}

export function DemoRequestsCard({ onOnboardCommunity }: DemoRequestsCardProps) {
  const [leads, setLeads] = useState<DemoRequestLead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<DemoRequestLead | null>(null);

  const loadLeads = () => {
    setLeads(getStoredDemoRequests());
  };

  useEffect(() => {
    loadLeads();
    const handleUpdate = () => loadLeads();
    window.addEventListener("demo-requests-updated", handleUpdate);
    return () => window.removeEventListener("demo-requests-updated", handleUpdate);
  }, []);

  const filteredLeads = useMemo(() => {
    return leads.filter((item) => {
      const matchesSearch =
        search === "" ||
        item.fullName.toLowerCase().includes(search.toLowerCase()) ||
        item.community.toLowerCase().includes(search.toLowerCase()) ||
        item.email.toLowerCase().includes(search.toLowerCase()) ||
        item.phone.includes(search) ||
        item.ticketId.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  const handleStatusChange = (id: string, newStatus: DemoRequestLead["status"], e: React.MouseEvent) => {
    e.stopPropagation();
    updateDemoRequestStatus(id, newStatus);
    loadLeads();
    if (selectedLead && selectedLead.id === id) {
      setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to remove this lead record?")) {
      deleteDemoRequest(id);
      loadLeads();
      if (selectedLead?.id === id) setSelectedLead(null);
    }
  };

  const getStatusBadgeStyle = (status: DemoRequestLead["status"]) => {
    switch (status) {
      case "New":
        return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
      case "Contacted":
        return { bg: "#fef3c7", color: "#b45309", border: "#fde68a" };
      case "Demo Scheduled":
        return { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe" };
      case "Onboarded":
        return { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
      default:
        return { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };
    }
  };

  return (
    <div className="card" style={{ marginTop: "1.75rem", marginBottom: "1.75rem" }}>
      <div
        className="card-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.25rem" }}>📥</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3 className="card-title" style={{ margin: 0 }}>
                Inbound Demo Requests &amp; Leads
              </h3>
              <span
                style={{
                  fontSize: "0.725rem",
                  fontWeight: 700,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "999px",
                  background: "#eff6ff",
                  color: "#2563eb",
                  border: "1px solid #bfdbfe",
                }}
              >
                {leads.length} submissions
              </span>
            </div>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)", margin: "0.15rem 0 0 0" }}>
              Prospect submissions from the public landing page demo &amp; contact form
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search leads, email, society…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "0.35rem 0.65rem",
              fontSize: "0.825rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              minWidth: 200,
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "0.35rem 0.65rem",
              fontSize: "0.825rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "white",
            }}
          >
            <option value="all">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Demo Scheduled">Demo Scheduled</option>
            <option value="Onboarded">Onboarded</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div style={{ overflowX: "auto", borderTop: "1px solid var(--border)" }}>
        {filteredLeads.length === 0 ? (
          <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>
            No demo requests found matching your filters.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "var(--surface-subtle, #f8fafc)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Ticket &amp; Prospect
                </th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Society &amp; Units
                </th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Contact Info
                </th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Interest
                </th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Status
                </th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((item) => {
                const badge = getStatusBadgeStyle(item.status);
                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedLead(item)}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Ticket & Prospect */}
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.75rem", color: "#2563eb" }}>
                          {item.ticketId}
                        </span>
                        <span style={{ fontWeight: 600, color: "var(--foreground)", fontSize: "0.875rem" }}>
                          {item.fullName}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {item.role}
                        </span>
                      </div>
                    </td>

                    {/* Society & Units */}
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{item.community}</div>
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: "0.15rem",
                          fontSize: "0.7rem",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "4px",
                          background: "#f1f5f9",
                          color: "#475569",
                          fontWeight: 500,
                        }}
                      >
                        🏢 {item.units}
                      </span>
                    </td>

                    {/* Contact Info */}
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                        <a
                          href={`mailto:${item.email}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: "#2563eb", textDecoration: "none", fontSize: "0.8rem" }}
                        >
                          ✉️ {item.email}
                        </a>
                        <a
                          href={`tel:${item.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: "var(--foreground)", textDecoration: "none", fontSize: "0.8rem" }}
                        >
                          📞 {item.phone}
                        </a>
                      </div>
                    </td>

                    {/* Interest */}
                    <td style={{ padding: "0.75rem 1rem", maxWidth: 220 }}>
                      <span
                        style={{
                          fontSize: "0.775rem",
                          color: "var(--foreground)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                        title={item.product}
                      >
                        {item.product}
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "var(--muted)", display: "block", marginTop: "0.2rem" }}>
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </td>

                    {/* Status dropdown */}
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <select
                        value={item.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleStatusChange(item.id, e.target.value as DemoRequestLead["status"], e as any)}
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "0.25rem 0.5rem",
                          borderRadius: "var(--radius-sm)",
                          border: `1px solid ${badge.border}`,
                          background: badge.bg,
                          color: badge.color,
                          cursor: "pointer",
                        }}
                      >
                        <option value="New">New</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Demo Scheduled">Demo Scheduled</option>
                        <option value="Onboarded">Onboarded</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
                        {onOnboardCommunity && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOnboardCommunity(item);
                            }}
                            className="btn btn-secondary"
                            style={{ fontSize: "0.725rem", padding: "0.25rem 0.55rem" }}
                            title="Pre-populate Create Community with this society"
                          >
                            + Onboard
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDelete(item.id, e)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#ef4444",
                            cursor: "pointer",
                            padding: "0.25rem 0.4rem",
                            fontSize: "0.85rem",
                            borderRadius: "4px",
                          }}
                          title="Delete Lead"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Lead Details Modal */}
      <Modal
        isOpen={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        title="Demo Request & Prospect Details"
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Received: {selectedLead?.createdAt ? new Date(selectedLead.createdAt).toLocaleString() : ""}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {selectedLead && onOnboardCommunity && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (selectedLead) {
                      const lead = selectedLead;
                      setSelectedLead(null);
                      onOnboardCommunity(lead);
                    }
                  }}
                >
                  Onboard this Community
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedLead(null)}
              >
                Close
              </button>
            </div>
          </div>
        }
      >
        {selectedLead && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem 1rem",
                background: "#f8fafc",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Reference Ticket</span>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#2563eb", fontFamily: "monospace" }}>
                  {selectedLead.ticketId}
                </div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: 2 }}>
                  Lead Status
                </span>
                <select
                  value={selectedLead.status}
                  onChange={(e) =>
                    handleStatusChange(selectedLead.id, e.target.value as DemoRequestLead["status"], e as any)
                  }
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    padding: "0.25rem 0.5rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Demo Scheduled">Demo Scheduled</option>
                  <option value="Onboarded">Onboarded</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Prospect Name</span>
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{selectedLead.fullName}</div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Role</span>
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{selectedLead.role}</div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Official Email</span>
                <div>
                  <a href={`mailto:${selectedLead.email}`} style={{ color: "#2563eb", fontWeight: 500 }}>
                    {selectedLead.email}
                  </a>
                </div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Phone Number</span>
                <div>
                  <a href={`tel:${selectedLead.phone}`} style={{ color: "var(--foreground)", fontWeight: 500 }}>
                    {selectedLead.phone}
                  </a>
                </div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Community / Society</span>
                <div style={{ fontWeight: 600 }}>{selectedLead.community}</div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Township Units</span>
                <div>{selectedLead.units}</div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Primary Area of Interest</span>
              <div
                style={{
                  padding: "0.6rem 0.75rem",
                  background: "#eff6ff",
                  borderRadius: "var(--radius-sm)",
                  color: "#1e40af",
                  fontWeight: 500,
                  fontSize: "0.85rem",
                  marginTop: "0.25rem",
                }}
              >
                {selectedLead.product}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
