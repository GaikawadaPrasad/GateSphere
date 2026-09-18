"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import { deliveriesApi, communitiesApi, authApi } from "@/lib/api";
import type { Unit } from "@/types/communities";
import { isValidPersonName } from "@/lib/utils";
import { toast } from "@/store/toast";

interface DeliveryRow {
  id: string;
  unit_number?: string;
  provider_name: string;
  delivery_type: string;
  executive_name: string;
  executive_phone?: string;
  tracking_reference: string;
  status: string;
  approval_status: string;
  protocol_type: string;
  arrived_at?: string | null;
}

export default function SecurityGuardDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Log Delivery Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [deliveryType, setDeliveryType] = useState("courier");
  const [providerName, setProviderName] = useState("");
  const [executiveName, setExecutiveName] = useState("");
  const [executivePhone, setExecutivePhone] = useState("");
  const [trackingReference, setTrackingReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deliveryFieldErrors, setDeliveryFieldErrors] = useState<Record<string, string>>({});

  const loadData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setLoadError(null);
    try {
      const [data, protocols] = await Promise.all([
        deliveriesApi.list(),
        deliveriesApi.protocols(),
      ]);
      const protocolMap = new Map<string, string>();
      for (const p of protocols || [])
        if ((p as any)?.id) protocolMap.set((p as any).id, (p as any).protocol_type);
      const unitMap = new Map<string, string>();
      for (const u of units) {
        if (u.id && u.unit_number) unitMap.set(u.id, u.unit_number);
      }
      setDeliveries(
        (data || []).map((d: any) => {
          const rawNum = d.unit_number || (d.unit ? d.unit.unit_number : unitMap.get(d.unit_id));
          const unitStr = rawNum ? (String(rawNum).startsWith("Unit ") ? String(rawNum) : `Unit ${rawNum}`) : "—";
          return {
            id: d.id,
            unit_number: unitStr,
            provider_name: d.provider_name || d.delivery_type?.toUpperCase() || "Courier",
            delivery_type: d.delivery_type || "courier",
            executive_name: d.executive_name || "—",
            executive_phone: d.executive_phone || "",
            tracking_reference: d.tracking_reference || d.id.slice(0, 8),
            status: d.status || "expected",
            approval_status: d.approval_status || "pending",
            protocol_type: protocolMap.get(d.protocol_id) || "—",
            arrived_at: d.arrived_at,
          };
        }),
      );
    } catch (err: any) {
      if (showLoading) setLoadError(err?.message || "Failed to load deliveries.");
    }
    if (showLoading) setIsLoading(false);
  };

  useEffect(() => {
    loadUnits();
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
      console.error("Failed to load units for security guard delivery modal:", err);
    }
  };

  const handleOpenModal = () => {
    setSelectedUnitId("");
    setDeliveryType("courier");
    setProviderName("");
    setExecutiveName("");
    setExecutivePhone("");
    setTrackingReference("");
    setModalError(null);
    setDeliveryFieldErrors({});
    setIsModalOpen(true);
    loadUnits();
  };

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedProvider = providerName.trim();
    const trimmedExecName = executiveName.trim();
    const trimmedExecPhone = executivePhone.trim();
    const errors: Record<string, string> = {};

    if (!selectedUnitId) {
      errors.unitId = "Please select a target resident unit.";
    }
    if (!trimmedProvider || trimmedProvider.length < 2) {
      errors.providerName = "Please enter courier / provider name (min 2 characters).";
    }
    if (trimmedExecName) {
      if (trimmedExecName.length < 2 || !isValidPersonName(trimmedExecName)) {
        errors.executiveName = "Delivery executive name must contain only alphabetic letters and spaces (min 2 characters).";
      }
    }
    if (trimmedExecPhone) {
      const phoneDigits = trimmedExecPhone.replace(/\D/g, "");
      if (!/^\+?[0-9\s\-()]{7,20}$/.test(trimmedExecPhone) || phoneDigits.length < 10) {
        errors.executivePhone = "Please enter a valid mobile number for the delivery executive (at least 10 digits).";
      }
    }

    if (Object.keys(errors).length > 0) {
      setDeliveryFieldErrors(errors);
      setModalError("Please resolve the highlighted delivery form errors.");
      toast.error("Please resolve the highlighted delivery form errors.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      await deliveriesApi.create({
        unit_id: selectedUnitId,
        delivery_type: deliveryType,
        provider_name: trimmedProvider,
        executive_name: trimmedExecName || undefined,
        executive_phone: trimmedExecPhone || undefined,
        tracking_reference: trackingReference.trim() || undefined,
      });
      const successText = `Delivery ticket logged for unit! Notification sent to resident for approval.`;
      setActionMessage({
        type: "success",
        text: successText,
      });
      toast.success(successText);
      setIsModalOpen(false);
      loadData(false);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to log delivery entry.";
      setModalError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordArrival = async (id: string, unitLabel?: string) => {
    setActionMessage(null);
    try {
      await deliveriesApi.recordArrival(id);
      const msg = `Courier arrival recorded at gate desk${unitLabel ? ` for ${unitLabel}` : ""}.`;
      setActionMessage({ type: "success", text: msg });
      toast.success(msg);
      loadData(false);
    } catch (err: any) {
      if (err?.code === "NOT_APPROVED" || err?.message?.toLowerCase().includes("not approved")) {
        try {
          await deliveriesApi.sendApprovalRequest(id);
          const msg = `Delivery requires resident approval. An instant approval request has been sent to the resident ${unitLabel ? `(${unitLabel})` : ""}!`;
          setActionMessage({ type: "success", text: msg });
          toast.success(msg);
          loadData(false);
          return;
        } catch {
          // fallback to error message
        }
      }
      const errMsg = err?.message || "Failed to record arrival.";
      setActionMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
    }
  };

  const handleMarkDelivered = async (id: string) => {
    setActionMessage(null);
    try {
      await deliveriesApi.markDelivered(id);
      const msg = "Package marked as delivered / collected.";
      setActionMessage({ type: "success", text: msg });
      toast.success(msg);
      loadData(false);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to mark delivered.";
      setActionMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
    }
  };

  const handleCancel = async (id: string) => {
    setActionMessage(null);
    try {
      await deliveriesApi.cancel(id);
      const msg = "Delivery entry rejected / cancelled.";
      setActionMessage({ type: "success", text: msg });
      toast.success(msg);
      loadData(false);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to cancel delivery.";
      setActionMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
    }
  };

  const [notifyingId, setNotifyingId] = useState<string | null>(null);

  const handleSendApprovalRequest = async (id: string, unitLabel?: string) => {
    setActionMessage(null);
    setNotifyingId(id);
    try {
      await deliveriesApi.sendApprovalRequest(id);
      const msg = `Delivery approval request notification sent to resident ${unitLabel ? `(${unitLabel})` : ""}!`;
      setActionMessage({ type: "success", text: msg });
      toast.success(msg);
      loadData(false);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to send delivery approval request to resident.";
      setActionMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
    } finally {
      setNotifyingId(null);
    }
  };

  const filteredDeliveries = deliveries.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.provider_name.toLowerCase().includes(q) ||
      d.executive_name.toLowerCase().includes(q) ||
      d.tracking_reference.toLowerCase().includes(q) ||
      (d.unit_number && d.unit_number.toLowerCase().includes(q))
    );
  });

  const columns: Column<DeliveryRow>[] = [
    {
      key: "provider_name",
      header: "Provider",
      sortable: true,
      render: (d) => <span style={{ fontWeight: 600, color: "var(--fg)" }}>📦 {d.provider_name}</span>,
    },
    {
      key: "delivery_type",
      header: "Type",
      sortable: true,
      render: (d) => <span style={{ textTransform: "capitalize" }}>{d.delivery_type}</span>,
    },
    {
      key: "unit_number",
      header: "Destination Unit",
      sortable: true,
      render: (d) => <span style={{ fontWeight: 600 }}>{d.unit_number || "—"}</span>,
    },
    {
      key: "executive_name",
      header: "Executive",
      sortable: true,
      render: (d) => <span>{d.executive_name} {d.executive_phone ? `(${d.executive_phone})` : ""}</span>,
    },
    {
      key: "tracking_reference",
      header: "Tracking Ref",
      sortable: true,
      render: (d) => <span style={{ fontFamily: "monospace" }}>{d.tracking_reference}</span>,
    },
    {
      key: "approval_status",
      header: "Resident Approval",
      sortable: true,
      render: (d) => <StatusBadge status={d.approval_status} />,
    },
    {
      key: "status",
      header: "Gate Status",
      sortable: true,
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: "actions",
      header: "Gate Action",
      align: "right",
      render: (d) => (
        <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
          {!["delivered", "collected", "cancelled", "returned"].includes(d.status) && (
            <button
              className="btn btn-primary"
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.5rem",
                background: "#2563eb",
                borderColor: "#1d4ed8",
                color: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontWeight: 600,
              }}
              onClick={() => handleSendApprovalRequest(d.id, d.unit_number)}
              disabled={notifyingId === d.id}
              title="Send real-time delivery approval request notification to resident"
            >
              {notifyingId === d.id ? "Sending…" : "📲 Send Approval Request"}
            </button>
          )}
          {d.status === "expected" && (
            <button
              className="btn btn-primary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
              onClick={() => handleRecordArrival(d.id, d.unit_number)}
            >
              Arrival
            </button>
          )}
          {(d.status === "at_gate" || d.status === "in_transit") && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
              onClick={() => handleMarkDelivered(d.id)}
            >
              Delivered
            </button>
          )}
          {!["delivered", "collected", "cancelled", "returned"].includes(d.status) && (
            <button
              className="btn btn-danger"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
              onClick={() => handleCancel(d.id)}
            >
              Reject
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Delivery Verification & Gate Decision"
        subtitle="Verify courier arrival, record gate hand-off, and track delivery protocol status"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Guard" },
          { label: "Deliveries" },
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
              + Log Gate Delivery
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
            <h3 className="card-title">Delivery Desk Queue</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredDeliveries.length} parcels registered
            </p>
          </div>

          <div style={{ width: "100%", maxWidth: 240 }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search courier/tracking…"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredDeliveries}
          isLoading={isLoading}
          enableClientPagination={true}
          pageSize={10}
          emptyTitle="No Delivery Records Found"
          emptyDescription="There are no expected or active courier deliveries at the gate desk."
          emptyIcon="📦"
        />
      </div>

      {/* LOG DELIVERY MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="📦 Log New Gate Delivery Ticket"
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
              onClick={handleCreateDelivery}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Logging Delivery…" : "Log & Notify Resident"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateDelivery} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              padding: "0.6rem 0.85rem",
              borderRadius: "var(--radius)",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1e40af",
              fontSize: "0.825rem",
              fontWeight: 500,
            }}
          >
            📲 <strong>Real-Time Notification:</strong> Logging this delivery will immediately dispatch an approval and arrival prompt to the resident's mobile app.
          </div>

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
              onChange={(e) => {
                setSelectedUnitId(e.target.value);
                if (deliveryFieldErrors.unitId) {
                  setDeliveryFieldErrors((prev) => ({ ...prev, unitId: "" }));
                }
              }}
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
            {deliveryFieldErrors.unitId && (
              <span style={{ color: "var(--danger, #ef4444)", fontSize: "0.75rem", display: "block", marginTop: "0.25rem" }}>
                {deliveryFieldErrors.unitId}
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                Delivery Category *
              </label>
              <select
                className="form-control"
                value={deliveryType}
                onChange={(e) => setDeliveryType(e.target.value)}
              >
                <option value="courier">Courier / Parcel</option>
                <option value="food">Food Delivery (Zomato/Swiggy)</option>
                <option value="grocery">Grocery / Instant Mart</option>
                <option value="laundry">Laundry / Dry Clean</option>
                <option value="medicine">Pharmacy / Medicine</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                Provider / Brand Name *
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Amazon, Flipkart, Swiggy, Zomato"
                value={providerName}
                onChange={(e) => {
                  setProviderName(e.target.value);
                  if (deliveryFieldErrors.providerName) {
                    setDeliveryFieldErrors((prev) => ({ ...prev, providerName: "" }));
                  }
                }}
                required
              />
              {deliveryFieldErrors.providerName && (
                <span style={{ color: "var(--danger, #ef4444)", fontSize: "0.75rem", display: "block", marginTop: "0.25rem" }}>
                  {deliveryFieldErrors.providerName}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                Executive / Driver Name
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Executive name"
                value={executiveName}
                onChange={(e) => {
                  setExecutiveName(e.target.value);
                  if (deliveryFieldErrors.executiveName) {
                    setDeliveryFieldErrors((prev) => ({ ...prev, executiveName: "" }));
                  }
                }}
              />
              {deliveryFieldErrors.executiveName && (
                <span style={{ color: "var(--danger, #ef4444)", fontSize: "0.75rem", display: "block", marginTop: "0.25rem" }}>
                  {deliveryFieldErrors.executiveName}
                </span>
              )}
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                Executive Mobile Number
              </label>
              <input
                type="tel"
                className="form-control"
                placeholder="10-digit mobile"
                value={executivePhone}
                onChange={(e) => {
                  setExecutivePhone(e.target.value);
                  if (deliveryFieldErrors.executivePhone) {
                    setDeliveryFieldErrors((prev) => ({ ...prev, executivePhone: "" }));
                  }
                }}
              />
              {deliveryFieldErrors.executivePhone && (
                <span style={{ color: "var(--danger, #ef4444)", fontSize: "0.75rem", display: "block", marginTop: "0.25rem" }}>
                  {deliveryFieldErrors.executivePhone}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
              Tracking Reference / Order Number
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. AMZ-987654 or SWG-12345"
              value={trackingReference}
              onChange={(e) => setTrackingReference(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
