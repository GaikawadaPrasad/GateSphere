"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import { FileUpload } from "@/components/common/FileUpload";
import { visitorsApi, communitiesApi, authApi } from "@/lib/api";
import type { Unit } from "@/types/communities";
import { isValidPersonName } from "@/lib/utils";
import { toast } from "@/store/toast";

interface CabMovement {
  id: string;
  unit_number?: string;
  visitorName: string;
  vehicleNumber: string;
  purpose: string;
  status: string;
  entryId?: string;
}

export default function SecurityGuardCabTaxiPage() {
  const [cabs, setCabs] = useState<CabMovement[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Admit Cab photo modal state
  const [admitCab, setAdmitCab] = useState<CabMovement | null>(null);
  const [admitPhotoUrl, setAdmitPhotoUrl] = useState<string | null>(null);
  const [isAdmitting, setIsAdmitting] = useState(false);
  const [admitError, setAdmitError] = useState<string | null>(null);

  // Log Cab Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [cabCompany, setCabCompany] = useState("Uber");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setLoadError(null);
    try {
      const [requests, directory, entries] = await Promise.all([
        visitorsApi.requests(),
        visitorsApi.directory(),
        visitorsApi.entries(),
      ]);
      const visitorMap = new Map<string, any>();
      for (const v of directory || [])
        if ((v as any)?.id) visitorMap.set((v as any).id as string, v);
      const openEntryByRequest = new Map<string, any>();
      for (const e of entries || [])
        if ((e as any).request_id && !(e as any).exit_at)
          openEntryByRequest.set((e as any).request_id, e);

      setCabs(
        (requests || [])
          .filter(
            (r: any) =>
              r.visitor_type === "cab_taxi" ||
              r.purpose?.toLowerCase().includes("cab") ||
              r.purpose?.toLowerCase().includes("taxi") ||
              r.purpose?.toLowerCase().includes("uber") ||
              r.purpose?.toLowerCase().includes("ola"),
          )
          .map((r: any) => {
            const visitor = visitorMap.get(r.visitor_id);
            const openEntry = openEntryByRequest.get(r.id);
            return {
              id: r.id,
              unit_number: r.unit_number || (r.unit ? `Unit ${r.unit.unit_number}` : "—"),
              visitorName: r.visitor_name || r.visitor?.full_name || visitor?.full_name || "Cab Driver",
              vehicleNumber: r.vehicle_number || r.visitor?.vehicle_number || visitor?.vehicle_number || "—",
              purpose: r.purpose || "Cab / Taxi",
              status: r.status || "pending",
              entryId: openEntry?.id,
            };
          }),
      );
    } catch (err: any) {
      if (showLoading) setLoadError(err?.message || "Failed to load cab/taxi movements.");
    }
    if (showLoading) setIsLoading(false);
  };

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => {
      loadData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadUnits = async () => {
    try {
      const me = await authApi.me();
      let cid = me?.community_ids?.[0] || (me as any)?.community_id;
      if (!cid && me?.roles && Array.isArray(me.roles)) {
        cid = me.roles.find((r: any) => r.community_id)?.community_id;
      }
      if (!cid) {
        const comms: any = await communitiesApi.list({ active: true });
        const list = Array.isArray(comms) ? comms : comms?.data || comms?.items || [];
        if (list.length > 0) cid = list[0].id;
      }
      if (cid) {
        const res: any = await communitiesApi.communityUnits(cid, { page_size: 100 });
        const uList = Array.isArray(res) ? res : res?.data || res?.items || [];
        if (Array.isArray(uList) && uList.length > 0) {
          const sorted = [...uList].sort((a: any, b: any) =>
            (a.unit_number || "").localeCompare(b.unit_number || "", undefined, {
              numeric: true,
              sensitivity: "base",
            }),
          );
          setUnits(sorted);
          if (sorted.length > 0) {
            setSelectedUnitId(sorted[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load units for security guard cab modal:", err);
    }
  };

  const handleOpenModal = () => {
    setSelectedUnitId("");
    setDriverName("");
    setDriverPhone("");
    setVehicleNumber("");
    setCabCompany("Uber");
    setModalError(null);
    setIsModalOpen(true);
    loadUnits();
  };

  const handleCreateCabArrival = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlate = vehicleNumber.trim().toUpperCase();
    const trimmedDriverName = driverName.trim();
    const trimmedDriverPhone = driverPhone.trim();

    if (!selectedUnitId) {
      setModalError("Please select a target resident unit.");
      return;
    }
    if (!cleanPlate) {
      setModalError("Please enter vehicle plate number (e.g. KA-01-AB-1234).");
      return;
    }
    const cleanPlateNoSpaces = cleanPlate.replace(/[\s\-]/g, "");
    if (!/^[A-Z0-9]{4,15}$/.test(cleanPlateNoSpaces)) {
      setModalError("Vehicle plate number must be 4-15 alphanumeric characters (e.g. KA01AB1234).");
      return;
    }
    if (trimmedDriverName) {
      if (trimmedDriverName.length < 2 || !isValidPersonName(trimmedDriverName)) {
        setModalError("Driver name must contain only alphabetic letters and spaces (min 2 characters).");
        return;
      }
    }
    if (trimmedDriverPhone) {
      const phoneDigits = trimmedDriverPhone.replace(/\D/g, "");
      if (!/^\+?[0-9\s\-()]{7,20}$/.test(trimmedDriverPhone) || phoneDigits.length < 10) {
        setModalError("Please enter a valid mobile number for the driver (at least 10 digits).");
        return;
      }
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      await visitorsApi.createRequest({
        unit_id: selectedUnitId,
        visitor_type: "cab_taxi",
        vehicle_number: cleanPlate,
        purpose: cabCompany || "Cab / Taxi Entry",
        visitor: {
          full_name: trimmedDriverName || "Cab / Taxi Driver",
          phone: trimmedDriverPhone || "9999999999",
          vehicle_number: cleanPlate,
        },
      });
      const successText = `Cab entry ticket logged! Notification sent to resident for approval.`;
      setActionMessage({
        type: "success",
        text: successText,
      });
      toast.success(successText);
      setIsModalOpen(false);
      loadData(false);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to log cab arrival request.";
      setModalError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAllowEntry = (cab: CabMovement) => {
    setActionMessage(null);
    setAdmitError(null);
    setAdmitPhotoUrl(null);
    setAdmitCab(cab);
  };

  const handleConfirmAdmitCab = async () => {
    if (!admitCab) return;
    if (!admitPhotoUrl) {
      setAdmitError(
        "📸 CAB / VEHICLE PHOTO REQUIRED: Security policy mandates capturing a photograph before gate entry."
      );
      return;
    }
    setIsAdmitting(true);
    setAdmitError(null);
    try {
      await visitorsApi.recordEntry({
        request_id: admitCab.id,
        entry_photo_url: admitPhotoUrl,
        vehicle_number: admitCab.vehicleNumber !== "—" ? admitCab.vehicleNumber : undefined,
      });
      const successText = `Cab entry recorded for ${admitCab.vehicleNumber}`;
      setActionMessage({ type: "success", text: successText });
      toast.success(successText);
      setAdmitCab(null);
      setAdmitPhotoUrl(null);
      loadData(false);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to record cab entry.";
      setAdmitError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsAdmitting(false);
    }
  };

  const handleMarkExit = async (cab: CabMovement) => {
    if (!cab.entryId) return;
    setActionMessage(null);
    try {
      await visitorsApi.recordExit(cab.entryId);
      const successText = `Cab exit recorded for ${cab.vehicleNumber}`;
      setActionMessage({ type: "success", text: successText });
      toast.success(successText);
      loadData(false);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to record cab exit.";
      setActionMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
    }
  };

  const filteredCabs = cabs.filter(
    (c) =>
      c.vehicleNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.visitorName.toLowerCase().includes(search.toLowerCase()) ||
      (c.unit_number && c.unit_number.toLowerCase().includes(search.toLowerCase())),
  );

  const columns: Column<CabMovement>[] = [
    {
      key: "vehicleNumber",
      header: "Vehicle Plate #",
      sortable: true,
      render: (c) => (
        <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--fg)" }}>
          🚖 {c.vehicleNumber}
        </span>
      ),
    },
    {
      key: "visitorName",
      header: "Driver / Passenger",
      sortable: true,
      render: (c) => <span>{c.visitorName}</span>,
    },
    {
      key: "unit_number",
      header: "Destination Unit",
      sortable: true,
      render: (c) => <span style={{ fontWeight: 600 }}>{c.unit_number || "—"}</span>,
    },
    {
      key: "purpose",
      header: "Service / Purpose",
      sortable: true,
      render: (c) => <span>{c.purpose}</span>,
    },
    {
      key: "status",
      header: "Approval / Gate Status",
      sortable: true,
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (c) => (
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          {c.status === "approved" ? (
            <button
              className="btn btn-primary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem" }}
              onClick={() => handleAllowEntry(c)}
            >
              Allow Entry
            </button>
          ) : c.status === "entered" && c.entryId ? (
            <button
              className="btn btn-secondary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem" }}
              onClick={() => handleMarkExit(c)}
            >
              Mark Exit
            </button>
          ) : (
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Cab & Taxi Verification"
        subtitle="Verify cab arrivals against resident-approved requests, and log gate entry/exit timestamps"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Guard" },
          { label: "Cab / Taxi" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary"
              onClick={() => loadData(false)}
              disabled={isLoading}
            >
              🔄 {isLoading ? "Refreshing…" : "Refresh"}
            </button>
            <button className="btn btn-primary" onClick={handleOpenModal}>
              + Log Cab / Taxi Arrival
            </button>
          </div>
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
            onClick={() => loadData(true)}
          >
            Retry
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Commercial Cab Movements</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredCabs.length} cabs registered
            </p>
          </div>

          <div style={{ width: "100%", maxWidth: 240 }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search vehicle/passenger…"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredCabs}
          isLoading={isLoading}
          enableClientPagination={true}
          pageSize={10}
          emptyTitle="No Cab / Taxi Records"
          emptyDescription="No cab or taxi entries currently match your search criteria."
          emptyIcon="🚖"
        />
      </div>

      {/* Admit Cab Modal with Mandatory Photo */}
      {admitCab && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!isAdmitting) {
              setAdmitCab(null);
              setAdmitPhotoUrl(null);
              setAdmitError(null);
            }
          }}
          title="🚖 Allow Cab Entry — Photograph Required"
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
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Vehicle / Cab</span>
                <strong style={{ fontFamily: "monospace", color: "var(--fg)" }}>🚗 {admitCab.vehicleNumber}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Driver / Service</span>
                <strong>{admitCab.visitorName}</strong>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Purpose</span>
                <span>{admitCab.purpose}</span>
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
                  📷 Cab / Vehicle Photograph <span style={{ color: "#dc2626", fontWeight: 900 }}>* (Mandatory)</span>
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
                label="Snap or upload cab / driver photograph before gate entry"
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
                onClick={() => setAdmitCab(null)}
                disabled={isAdmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmAdmitCab}
                disabled={isAdmitting}
                style={{
                  padding: "0.5rem 1.25rem",
                  fontWeight: 700,
                  background: admitPhotoUrl ? "#059669" : undefined,
                  borderColor: admitPhotoUrl ? "#059669" : undefined,
                }}
              >
                {isAdmitting ? "Recording Entry…" : "🚪 ALLOW CAB ENTRY"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* LOG CAB / TAXI ARRIVAL MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="🚖 Log Cab / Taxi Gate Arrival"
        footer={
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateCabArrival}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Logging Cab Arrival…" : "Log & Notify Resident"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateCabArrival} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {modalError && (
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "var(--radius)",
                background: "var(--danger-light)",
                border: "1px solid var(--danger-border)",
                color: "#991b1b",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              ⚠️ {modalError}
            </div>
          )}

          <div>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
              Destination Resident Unit *
            </label>
            <select
              className="form-control"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              required
            >
              {units.length === 0 ? (
                <option value="">Loading units…</option>
              ) : (
                units.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.unit_number} {u.unit_type ? `(${u.unit_type})` : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                Vehicle Plate Number *
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. KA-01-AB-1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                Cab Provider / Service *
              </label>
              <select
                className="form-control"
                value={cabCompany}
                onChange={(e) => setCabCompany(e.target.value)}
              >
                <option value="Uber">Uber</option>
                <option value="Ola">Ola Cabs</option>
                <option value="Rapido">Rapido Cab / Bike</option>
                <option value="InDrive">InDrive</option>
                <option value="Private Taxi">Private Taxi / Rental</option>
                <option value="Airport Shuttle">Airport Taxi / Shuttle</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                Driver Name (Optional)
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Driver full name"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                Driver Phone (Optional)
              </label>
              <input
                type="tel"
                className="form-control"
                placeholder="10-digit mobile"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
