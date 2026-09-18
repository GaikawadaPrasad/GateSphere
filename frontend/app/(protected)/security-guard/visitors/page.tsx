"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { visitorsApi } from "@/lib/api";
import { WalkInVisitorModal } from "@/components/common/WalkInVisitorModal";

import { Modal } from "@/components/common/Modal";
import { FileUpload } from "@/components/common/FileUpload";
import { formatDateTime } from "@/lib/utils";
import { communitiesApi, authApi } from "@/lib/api";
import { toast } from "@/store/toast";

interface VisitorRow {
  id: string;
  name: string;
  phone: string;
  visitorType: string;
  status: string;
  entryId?: string;
  unitNumber?: string;
  vehicleNumber?: string;
  purpose?: string;
  expectedAt?: string;
  validUntil?: string;
  partySize?: number;
  groupLabel?: string;
  createdAt?: string;
  photoUrl?: string;
  entryPhotoUrl?: string;
}

export default function SecurityGuardVisitorsPage() {
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorRow | null>(null);
  const [admitVisitor, setAdmitVisitor] = useState<VisitorRow | null>(null);
  const [admitPhotoUrl, setAdmitPhotoUrl] = useState<string | null>(null);
  const [isAdmitting, setIsAdmitting] = useState(false);
  const [admitError, setAdmitError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [requestsRes, directoryRes, entriesRes, me] = await Promise.all([
        visitorsApi.requests({ page_size: 100 }),
        visitorsApi.directory({ page_size: 100 }),
        visitorsApi.entries({ page_size: 100 }),
        authApi.me().catch(() => null),
      ]);

      const requests = Array.isArray(requestsRes) ? requestsRes : (requestsRes as any)?.data || [];
      const directory = Array.isArray(directoryRes) ? directoryRes : (directoryRes as any)?.data || [];
      const entries = Array.isArray(entriesRes) ? entriesRes : (entriesRes as any)?.data || [];

      let cid = me?.community_ids?.[0] || (me as any)?.community_id;
      if (!cid && me?.roles && Array.isArray(me.roles)) {
        cid = me.roles.find((r: any) => r.community_id)?.community_id;
      }

      const unitMap = new Map<string, string>();
      if (cid) {
        try {
          const uRes: any = await communitiesApi.communityUnits(cid, { page_size: 100 });
          const uList = Array.isArray(uRes) ? uRes : uRes?.data || uRes?.items || [];
          for (const u of uList) {
            if (u?.id) unitMap.set(u.id, u.unit_number);
          }
        } catch {
          // units lookup fallback
        }
      }

      const visitorMap = new Map<string, any>();
      for (const v of directory || []) if ((v as any)?.id) visitorMap.set((v as any).id, v);
      const openEntryByRequest = new Map<string, any>();
      for (const e of entries || []) {
        if ((e as any).request_id && !(e as any).exit_at)
          openEntryByRequest.set((e as any).request_id, e);
      }

      setVisitors(
        (requests || []).map((r: any) => {
          const directoryVisitor = visitorMap.get(r.visitor_id);
          const openEntry = openEntryByRequest.get(r.id);
          const name =
            r.visitor_name ||
            r.visitor?.full_name ||
            r.full_name ||
            directoryVisitor?.full_name ||
            "Visitor";
          const phone =
            r.phone ||
            r.visitor?.phone ||
            r.visitor_phone ||
            directoryVisitor?.phone ||
            "—";
          const unit = unitMap.get(r.unit_id) || (r.unit_id ? `Unit #${r.unit_id.slice(0, 6)}` : "—");
          const photoUrl =
            r.photo_url ||
            r.visitor?.photo_url ||
            directoryVisitor?.photo_url ||
            openEntry?.entry_photo_url ||
            undefined;
          const entryPhotoUrl =
            openEntry?.entry_photo_url ||
            r.entry_photo_url ||
            undefined;

          return {
            id: r.id,
            name,
            phone,
            visitorType: (r.visitor_type as string)?.replace(/_/g, " ") || "guest",
            status: r.status,
            entryId: openEntry?.id,
            unitNumber: unit,
            vehicleNumber: r.vehicle_number || r.visitor?.vehicle_number || "—",
            purpose: r.purpose || "—",
            expectedAt: r.expected_at ? formatDateTime(r.expected_at) : "—",
            validUntil: r.valid_until ? formatDateTime(r.valid_until) : "—",
            partySize: r.party_size || 1,
            groupLabel: r.group_label || "—",
            createdAt: r.created_at ? formatDateTime(r.created_at) : "—",
            photoUrl,
            entryPhotoUrl,
          };
        }),
      );
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load visitors.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkEntry = (v: VisitorRow) => {
    setActionMessage(null);
    setAdmitError(null);
    setAdmitPhotoUrl(null);
    setAdmitVisitor(v);
  };

  const handleConfirmAdmit = async () => {
    if (!admitVisitor) return;
    if (!admitPhotoUrl) {
      const msg = "📸 VISITOR PHOTO REQUIRED: Security policy mandates capturing a visitor photograph before gate entry. Please attach photo.";
      setAdmitError(msg);
      toast.error(msg);
      return;
    }
    setIsAdmitting(true);
    setAdmitError(null);
    try {
      await visitorsApi.recordEntry({
        request_id: admitVisitor.id,
        entry_photo_url: admitPhotoUrl,
        vehicle_number: admitVisitor.vehicleNumber !== "—" ? admitVisitor.vehicleNumber : undefined,
      });
      const msg = `Gate entry recorded for ${admitVisitor.name}`;
      setActionMessage({ type: "success", text: msg });
      toast.success(msg);
      setAdmitVisitor(null);
      setAdmitPhotoUrl(null);
      await loadData();
    } catch (err: any) {
      const errMsg = err?.message || "Failed to record gate entry.";
      setAdmitError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsAdmitting(false);
    }
  };

  const handleMarkExit = async (v: VisitorRow) => {
    if (!v.entryId) return;
    setActionMessage(null);
    try {
      await visitorsApi.recordExit(v.entryId);
      const msg = `Exit recorded for ${v.name}`;
      setActionMessage({ type: "success", text: msg });
      toast.success(msg);
      await loadData();
    } catch (err: any) {
      const errMsg = err?.message || "Failed to record exit.";
      setActionMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
    }
  };

  const filteredVisitors = visitors.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      v.visitorType.toLowerCase().includes(q) ||
      v.phone.includes(q) ||
      (v.unitNumber && v.unitNumber.toLowerCase().includes(q))
    );
  });

  const columns: Column<VisitorRow>[] = [
    {
      key: "name",
      header: "Visitor Name",
      sortable: true,
      render: (v) => (
        <button
          type="button"
          onClick={() => setSelectedVisitor(v)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontWeight: 600,
            color: "var(--primary, #2563eb)",
            textAlign: "left",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
          title="Click to view full visitor details"
        >
          👤 {v.name}
        </button>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      sortable: true,
      render: (v) => <span style={{ fontFamily: "monospace", fontWeight: 500 }}>{v.phone}</span>,
    },
    {
      key: "unitNumber",
      header: "Destination Unit",
      sortable: true,
      render: (v) => (
        <span style={{ fontWeight: 600, color: "var(--fg)" }}>
          🏢 {v.unitNumber}
        </span>
      ),
    },
    {
      key: "visitorType",
      header: "Type",
      sortable: true,
      render: (v) => <span style={{ textTransform: "capitalize" }}>{v.visitorType}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (v) => <StatusBadge status={v.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (v) => (
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.8rem", padding: "0.3rem 0.65rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
            onClick={() => setSelectedVisitor(v)}
            title="View full visitor details"
          >
            👁️ View
          </button>
          {v.status === "approved" ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.65rem" }}
              onClick={() => handleMarkEntry(v)}
            >
              Mark Entry
            </button>
          ) : v.status === "entered" && v.entryId ? (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.65rem" }}
              onClick={() => handleMarkExit(v)}
            >
              Mark Exit
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Visitor Gate Verification"
        subtitle="Review resident-approved visitor requests, and log visitor gate entry / exit"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Guard" }, { label: "Visitors" }]}
        actions={
          <button
            className="btn btn-secondary"
            onClick={loadData}
            disabled={isLoading}
          >
            🔄 {isLoading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {actionMessage && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            borderRadius: "var(--radius)",
            background: actionMessage.type === "success" ? "var(--success-light)" : "var(--danger-light)",
            border: `1px solid ${actionMessage.type === "success" ? "var(--success-border)" : "var(--danger-border)"}`,
            color: actionMessage.type === "success" ? "#065f46" : "#991b1b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
            {actionMessage.type === "success" ? "✅" : "⚠️"} {actionMessage.text}
          </span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {loadError && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            borderRadius: "var(--radius)",
            background: "var(--danger-light)",
            border: "1px solid var(--danger-border)",
            color: "#991b1b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>⚠️ {loadError}</span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
            onClick={loadData}
          >
            Retry
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Today&apos;s Visitors</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredVisitors.length} visitors registered
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: "100%", maxWidth: 240 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search name/type/phone…" />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: "0.85rem", padding: "0.45rem 1rem", fontWeight: 700 }}
              onClick={() => setIsWalkInModalOpen(true)}
            >
              + Walk-In Check-In
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredVisitors}
          isLoading={isLoading}
          enableClientPagination={true}
          pageSize={10}
          emptyTitle="No Visitor Requests Found"
          emptyDescription="There are currently no visitor entry requests matching your search."
          emptyIcon="👥"
        />
      </div>

      <WalkInVisitorModal
        isOpen={isWalkInModalOpen}
        onClose={() => {
          setIsWalkInModalOpen(false);
          loadData();
        }}
        onEntryAdmitted={() => {
          setIsWalkInModalOpen(false);
          setActionMessage({ type: "success", text: "Walk-in visitor entry admitted & recorded." });
          loadData();
        }}
      />

      {/* Visitor Detail Modal */}
      {selectedVisitor && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedVisitor(null)}
          title="Visitor Pass & Entry Details"
          size="md"
          footer={
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", width: "100%" }}>
              {selectedVisitor.status === "approved" && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    handleMarkEntry(selectedVisitor);
                    setSelectedVisitor(null);
                  }}
                >
                  Mark Gate Entry
                </button>
              )}
              {selectedVisitor.status === "entered" && selectedVisitor.entryId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    handleMarkExit(selectedVisitor);
                    setSelectedVisitor(null);
                  }}
                >
                  Mark Gate Exit
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedVisitor(null)}
              >
                Close
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.85rem 1rem",
                background: "var(--bg-subtle, #f8fafc)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                {selectedVisitor.photoUrl || selectedVisitor.entryPhotoUrl ? (
                  <a
                    href={selectedVisitor.photoUrl || selectedVisitor.entryPhotoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Click to view full photograph"
                    style={{ position: "relative", display: "inline-block", flexShrink: 0 }}
                  >
                    <img
                      src={selectedVisitor.photoUrl || selectedVisitor.entryPhotoUrl}
                      alt={selectedVisitor.name}
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "8px",
                        objectFit: "cover",
                        border: "2px solid #86efac",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        cursor: "pointer",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        bottom: "-4px",
                        right: "-4px",
                        background: "#059669",
                        color: "white",
                        fontSize: "0.55rem",
                        padding: "1px 4px",
                        borderRadius: "3px",
                        fontWeight: 700,
                      }}
                    >
                      📷 PHOTO
                    </span>
                  </a>
                ) : (
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "8px",
                      background: "#e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.5rem",
                      color: "#94a3b8",
                      border: "1px dashed #cbd5e1",
                      flexShrink: 0,
                    }}
                    title="No photograph attached"
                  >
                    👤
                  </div>
                )}
                <div>
                  <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--fg)" }}>
                    {selectedVisitor.name}
                  </h4>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "var(--muted)", fontFamily: "monospace" }}>
                    {selectedVisitor.phone}
                  </p>
                  {selectedVisitor.photoUrl || selectedVisitor.entryPhotoUrl ? (
                    <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 600, display: "block", marginTop: "0.2rem" }}>
                      ✓ Verified Photo Attached
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "#d97706", fontWeight: 600, display: "block", marginTop: "0.2rem" }}>
                      ⚠️ No Photo Attached
                    </span>
                  )}
                </div>
              </div>
              <StatusBadge status={selectedVisitor.status} />
            </div>

            {/* Dedicated Visitor Photograph Card */}
            {(selectedVisitor.photoUrl || selectedVisitor.entryPhotoUrl) && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  padding: "0.85rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <a
                    href={selectedVisitor.photoUrl || selectedVisitor.entryPhotoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Click to view full size"
                  >
                    <img
                      src={selectedVisitor.photoUrl || selectedVisitor.entryPhotoUrl}
                      alt={selectedVisitor.name}
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "8px",
                        objectFit: "cover",
                        border: "2px solid #86efac",
                        cursor: "pointer",
                      }}
                    />
                  </a>
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#166534" }}>
                      📷 Visitor Identity Photograph
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#15803d", marginTop: "0.15rem" }}>
                      Mandatory face photo captured during gate registration
                    </div>
                  </div>
                </div>
                <a
                  href={selectedVisitor.photoUrl || selectedVisitor.entryPhotoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm"
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.4rem 0.75rem",
                    background: "#059669",
                    color: "#ffffff",
                    textDecoration: "none",
                    borderRadius: "6px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  🔍 View Full Size
                </a>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Destination Unit
                </div>
                <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "0.15rem" }}>
                  🏢 {selectedVisitor.unitNumber}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Visitor Type
                </div>
                <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "0.15rem", textTransform: "capitalize" }}>
                  {selectedVisitor.visitorType}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Vehicle Number
                </div>
                <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "0.15rem", fontFamily: "monospace" }}>
                  🚗 {selectedVisitor.vehicleNumber}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Party Size
                </div>
                <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "0.15rem" }}>
                  👥 {selectedVisitor.partySize} person(s)
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px", gridColumn: "span 2" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Purpose of Visit
                </div>
                <div style={{ fontWeight: 500, color: "var(--fg)", marginTop: "0.15rem" }}>
                  {selectedVisitor.purpose}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Expected At
                </div>
                <div style={{ fontWeight: 500, color: "var(--fg)", marginTop: "0.15rem", fontSize: "0.8rem" }}>
                  {selectedVisitor.expectedAt}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Valid Until
                </div>
                <div style={{ fontWeight: 500, color: "var(--fg)", marginTop: "0.15rem", fontSize: "0.8rem" }}>
                  {selectedVisitor.validUntil}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px", gridColumn: "span 2" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Pass Created
                </div>
                <div style={{ fontWeight: 500, color: "var(--fg)", marginTop: "0.15rem", fontSize: "0.8rem" }}>
                  {selectedVisitor.createdAt}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Admit Visitor & Mandatory Photo Verification Modal */}
      {admitVisitor && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!isAdmitting) {
              setAdmitVisitor(null);
              setAdmitPhotoUrl(null);
              setAdmitError(null);
            }
          }}
          title="📷 Admit Visitor — Photograph Required"
          size="md"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {admitError && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "6px",
                  background: "#fee2e2",
                  border: "1px solid #fca5a5",
                  color: "#991b1b",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                ⚠️ {admitError}
              </div>
            )}

            <div
              style={{
                padding: "0.85rem 1rem",
                borderRadius: "8px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                fontSize: "0.875rem",
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Visitor</span>
                <strong style={{ color: "var(--fg)" }}>👤 {admitVisitor.name}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Phone</span>
                <strong style={{ fontFamily: "monospace" }}>{admitVisitor.phone}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Destination</span>
                <strong>🏢 {admitVisitor.unitNumber}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Type</span>
                <span style={{ textTransform: "capitalize" }}>{admitVisitor.visitorType}</span>
              </div>
            </div>

            <div
              style={{
                padding: "1rem",
                borderRadius: "8px",
                background: admitPhotoUrl ? "#f0fdf4" : "#fffbeb",
                border: admitPhotoUrl ? "1px solid #86efac" : "2px solid #f59e0b",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>
                  📷 Visitor Face Photograph <span style={{ color: "#dc2626", fontWeight: 900 }}>* (Mandatory)</span>
                </span>
                {admitPhotoUrl ? (
                  <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 700 }}>
                    ✓ Photograph Attached
                  </span>
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "#b45309", fontWeight: 700 }}>
                    Required Before Admitting
                  </span>
                )}
              </div>
              <FileUpload
                kind="visitor_photo"
                label="Snap or upload visitor photograph before gate entry"
                currentUrl={admitPhotoUrl || undefined}
                onUploadComplete={(url) => {
                  setAdmitPhotoUrl(url);
                  setAdmitError(null);
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAdmitVisitor(null)}
                disabled={isAdmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmAdmit}
                disabled={isAdmitting}
                style={{
                  padding: "0.5rem 1.25rem",
                  fontWeight: 700,
                  background: admitPhotoUrl ? "#059669" : undefined,
                  borderColor: admitPhotoUrl ? "#059669" : undefined,
                }}
              >
                {isAdmitting ? "Recording Entry…" : "🚪 ALLOW GATE ENTRY"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
