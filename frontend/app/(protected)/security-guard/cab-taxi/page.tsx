"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import { visitorsApi, communitiesApi, authApi } from "@/lib/api";
import type { Unit } from "@/types/communities";
import { isValidPersonName, formatDateTime } from "@/lib/utils";
import { toast } from "@/store/toast";

export interface CabMovement {
  id: string;
  unit_id?: string;
  unit_number?: string;
  visitorName: string;
  visitorPhone?: string;
  vehicleNumber: string;
  purpose: string;
  status: string;
  entryId?: string;
  enteredAt?: string;
  exitedAt?: string;
  expectedAt?: string;
  createdAt?: string;
  driverPhotoUrl?: string;
}

export default function SecurityGuardCabTaxiPage() {
  const [cabs, setCabs] = useState<CabMovement[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "entered" | "completed"
  >("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Verification Modal State (Fast Lookup by Plate, Unit, Driver)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifySearchQuery, setVerifySearchQuery] = useState("");

  // Selected Cab for Full Details Modal
  const [selectedCabDetails, setSelectedCabDetails] = useState<CabMovement | null>(null);

  // Sending Approval Request State
  const [sendingApprovalId, setSendingApprovalId] = useState<string | null>(null);
  const [admittingId, setAdmittingId] = useState<string | null>(null);

  // Log Cab Arrival Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [cabCompany, setCabCompany] = useState("Uber");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [cabFieldErrors, setCabFieldErrors] = useState<Record<string, string>>({});

  const loadData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setLoadError(null);
    try {
      const [requestsRes, directoryRes, entriesRes, me] = await Promise.all([
        visitorsApi.requests({ page_size: 100 }),
        visitorsApi.directory({ page_size: 100 }),
        visitorsApi.entries({ page_size: 100 }),
        authApi.me().catch(() => null),
      ]);

      const requests = Array.isArray(requestsRes) ? requestsRes : (requestsRes as any)?.data || [];
      const directory = Array.isArray(directoryRes)
        ? directoryRes
        : (directoryRes as any)?.data || [];
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
          // unit map fallback
        }
      }

      const visitorMap = new Map<string, any>();
      for (const v of directory || []) {
        if ((v as any)?.id) visitorMap.set((v as any).id as string, v);
      }

      const openEntryByRequest = new Map<string, any>();
      const latestEntryByRequest = new Map<string, any>();
      for (const e of entries || []) {
        if ((e as any).request_id) {
          latestEntryByRequest.set((e as any).request_id, e);
          if (!(e as any).exit_at) {
            openEntryByRequest.set((e as any).request_id, e);
          }
        }
      }

      setCabs(
        (requests || [])
          .filter(
            (r: any) =>
              r.visitor_type === "cab_taxi" ||
              r.purpose?.toLowerCase().includes("cab") ||
              r.purpose?.toLowerCase().includes("taxi") ||
              r.purpose?.toLowerCase().includes("uber") ||
              r.purpose?.toLowerCase().includes("ola") ||
              r.purpose?.toLowerCase().includes("rapido"),
          )
          .map((r: any) => {
            const visitor = visitorMap.get(r.visitor_id);
            const openEntry = openEntryByRequest.get(r.id);
            const anyEntry = latestEntryByRequest.get(r.id);
            const entryId = openEntry?.id || anyEntry?.id;
            const enteredAt = openEntry?.entry_at || anyEntry?.entry_at;
            const exitedAt = openEntry?.exit_at || anyEntry?.exit_at;
            const unitNumberFromMap = unitMap.get(r.unit_id);
            const displayUnit =
              r.unit_number ||
              (unitNumberFromMap ? `Unit ${unitNumberFromMap}` : "") ||
              (r.unit ? `Unit ${r.unit.unit_number}` : "") ||
              (r.unit_id ? `Unit #${r.unit_id.slice(0, 5)}` : "—");

            return {
              id: r.id,
              unit_id: r.unit_id,
              unit_number: displayUnit,
              visitorName:
                r.visitor_name || r.visitor?.full_name || visitor?.full_name || "Cab Driver",
              visitorPhone: r.visitor_phone || r.visitor?.phone || visitor?.phone || undefined,
              vehicleNumber:
                r.vehicle_number || r.visitor?.vehicle_number || visitor?.vehicle_number || "—",
              purpose: r.purpose || "Cab / Taxi",
              status: r.status || "pending",
              entryId,
              enteredAt,
              exitedAt,
              expectedAt: r.expected_at,
              createdAt: r.created_at,
              driverPhotoUrl: visitor?.photo_url || r.visitor?.photo_url,
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
          if (sorted.length > 0 && !selectedUnitId) {
            setSelectedUnitId(sorted[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load units for security guard cab modal:", err);
    }
  };

  const handleOpenModal = (prefillPlate = "", prefillUnitId = "") => {
    setSelectedUnitId(prefillUnitId);
    setDriverName("");
    setDriverPhone("");
    setVehicleNumber(prefillPlate);
    setCabCompany("Uber");
    setModalError(null);
    setCabFieldErrors({});
    setIsModalOpen(true);
    loadUnits();
  };

  const handleOpenVerifyModal = () => {
    setVerifySearchQuery("");
    setIsVerifyModalOpen(true);
  };

  const handleCreateCabArrival = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlate = vehicleNumber.trim().toUpperCase();
    const trimmedDriverName = driverName.trim();
    const trimmedDriverPhone = driverPhone.trim();
    const errors: Record<string, string> = {};

    if (!selectedUnitId) {
      errors.unitId = "Please select a target resident unit.";
    }
    if (!cleanPlate) {
      errors.vehicleNumber = "Please enter vehicle plate number (e.g. KA-01-AB-1234).";
    } else {
      const cleanPlateNoSpaces = cleanPlate.replace(/[\s\-]/g, "");
      if (!/^[A-Z0-9]{4,15}$/.test(cleanPlateNoSpaces)) {
        errors.vehicleNumber =
          "Vehicle plate number must be 4-15 alphanumeric characters (e.g. KA01AB1234).";
      }
    }
    if (trimmedDriverName) {
      if (trimmedDriverName.length < 2 || !isValidPersonName(trimmedDriverName)) {
        errors.driverName =
          "Driver name must contain only alphabetic letters and spaces (min 2 characters).";
      }
    }
    if (trimmedDriverPhone) {
      const phoneDigits = trimmedDriverPhone.replace(/\D/g, "");
      if (!/^\+?[0-9\s\-()]{7,20}$/.test(trimmedDriverPhone) || phoneDigits.length < 10) {
        errors.driverPhone =
          "Please enter a valid mobile number for the driver (at least 10 digits).";
      }
    }

    if (Object.keys(errors).length > 0) {
      setCabFieldErrors(errors);
      setModalError("Please resolve the highlighted form errors.");
      toast.error("Please resolve the highlighted form errors.");
      return;
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
      const successText = `🚖 Cab arrival logged! Notification sent to resident for approval.`;
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

  // Direct 1-Click Allow Entry (No photo capture required for cabs)
  const handleAllowEntry = async (cab: CabMovement) => {
    setActionMessage(null);
    setAdmittingId(cab.id);
    try {
      await visitorsApi.recordEntry({
        request_id: cab.id,
        vehicle_number: cab.vehicleNumber !== "—" ? cab.vehicleNumber : undefined,
      });
      const successText = `✅ Gate entry recorded for cab ${cab.vehicleNumber}! Timestamp logged.`;
      setActionMessage({ type: "success", text: successText });
      toast.success(successText);
      setIsVerifyModalOpen(false);
      setSelectedCabDetails(null);
      loadData(false);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to record cab gate entry.";
      setActionMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
    } finally {
      setAdmittingId(null);
    }
  };

  const handleSendApprovalRequest = async (cab: CabMovement) => {
    setSendingApprovalId(cab.id);
    setActionMessage(null);
    try {
      if ((visitorsApi as any).sendApprovalRequest) {
        await (visitorsApi as any).sendApprovalRequest(cab.id);
      } else {
        await visitorsApi.notifyResident(cab.id);
      }
      const successText = `Approval request notification dispatched to resident for cab ${cab.vehicleNumber} (${cab.unit_number})!`;
      setActionMessage({ type: "success", text: successText });
      toast.success(successText);
      loadData(false);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to send approval request to resident.";
      setActionMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
    } finally {
      setSendingApprovalId(null);
    }
  };

  const handleMarkExit = async (cab: CabMovement) => {
    if (!cab.entryId) {
      toast.error("No active gate entry record found for this cab.");
      return;
    }
    setActionMessage(null);
    try {
      await visitorsApi.recordExit(cab.entryId);
      const successText = `🚪 Gate exit recorded for cab ${cab.vehicleNumber}! Exit timestamp logged.`;
      setActionMessage({ type: "success", text: successText });
      toast.success(successText);
      loadData(false);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to record cab exit.";
      setActionMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
    }
  };

  // Filtered cabs list
  const filteredCabs = useMemo(() => {
    return cabs.filter((c) => {
      // 1. Status Filter Tab
      if (statusFilter === "pending" && c.status !== "pending") return false;
      if (statusFilter === "approved" && c.status !== "approved") return false;
      if (statusFilter === "entered" && c.status !== "entered") return false;
      if (
        statusFilter === "completed" &&
        c.status !== "completed" &&
        c.status !== "rejected" &&
        c.status !== "cancelled"
      )
        return false;

      // 2. Search Text
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        c.vehicleNumber.toLowerCase().includes(q) ||
        c.visitorName.toLowerCase().includes(q) ||
        (c.visitorPhone && c.visitorPhone.includes(q)) ||
        (c.unit_number && c.unit_number.toLowerCase().includes(q)) ||
        c.purpose.toLowerCase().includes(q)
      );
    });
  }, [cabs, search, statusFilter]);

  // Verification matched cabs
  const verifiedMatches = useMemo(() => {
    const q = verifySearchQuery.toLowerCase().trim();
    if (!q) return [];
    return cabs.filter(
      (c) =>
        c.vehicleNumber.toLowerCase().includes(q) ||
        (c.unit_number && c.unit_number.toLowerCase().includes(q)) ||
        c.visitorName.toLowerCase().includes(q) ||
        (c.visitorPhone && c.visitorPhone.includes(q)),
    );
  }, [cabs, verifySearchQuery]);

  const counts = useMemo(() => {
    return {
      all: cabs.length,
      pending: cabs.filter((c) => c.status === "pending").length,
      approved: cabs.filter((c) => c.status === "approved").length,
      entered: cabs.filter((c) => c.status === "entered").length,
      completed: cabs.filter(
        (c) => c.status === "completed" || c.status === "rejected" || c.status === "cancelled",
      ).length,
    };
  }, [cabs]);

  const columns: Column<CabMovement>[] = [
    {
      key: "vehicleNumber",
      header: "Vehicle Plate #",
      sortable: true,
      render: (c) => (
        <button
          type="button"
          onClick={() => setSelectedCabDetails(c)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
          title="Click to view full ticket & driver details"
        >
          <span
            style={{
              fontFamily: "monospace",
              fontWeight: 800,
              fontSize: "0.875rem",
              color: "var(--primary, #2563eb)",
              padding: "0.15rem 0.4rem",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "4px",
            }}
          >
            🚖 {c.vehicleNumber}
          </span>
        </button>
      ),
    },
    {
      key: "visitorName",
      header: "Driver / Passenger",
      sortable: true,
      render: (c) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--fg)" }}>{c.visitorName}</div>
          {c.visitorPhone && (
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontFamily: "monospace" }}>
              📞 {c.visitorPhone}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "unit_number",
      header: "Destination Unit",
      sortable: true,
      render: (c) => (
        <span
          style={{
            fontWeight: 700,
            color: "var(--fg)",
            padding: "0.2rem 0.5rem",
            background: "#f1f5f9",
            borderRadius: "4px",
            fontSize: "0.825rem",
          }}
        >
          {c.unit_number || "—"}
        </span>
      ),
    },
    {
      key: "purpose",
      header: "Service Provider",
      sortable: true,
      render: (c) => {
        const pLower = c.purpose.toLowerCase();
        let badgeColor = "#475569";
        let badgeBg = "#f8fafc";
        if (pLower.includes("uber")) {
          badgeColor = "#000000";
          badgeBg = "#f1f5f9";
        } else if (pLower.includes("ola")) {
          badgeColor = "#059669";
          badgeBg = "#ecfdf5";
        } else if (pLower.includes("rapido")) {
          badgeColor = "#d97706";
          badgeBg = "#fffbeb";
        }
        return (
          <span
            style={{
              fontWeight: 700,
              fontSize: "0.775rem",
              padding: "0.2rem 0.5rem",
              borderRadius: "4px",
              color: badgeColor,
              background: badgeBg,
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            {c.purpose}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Approval / Gate Status",
      sortable: true,
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "enteredAt",
      header: "Gate Activity / Time",
      sortable: true,
      render: (c) => {
        if (c.status === "entered" && c.enteredAt) {
          return (
            <div style={{ fontSize: "0.775rem" }}>
              <span style={{ color: "#059669", fontWeight: 700 }}>🟢 Entered:</span>{" "}
              {formatDateTime(c.enteredAt)}
            </div>
          );
        }
        if (c.status === "completed" && c.exitedAt) {
          return (
            <div style={{ fontSize: "0.775rem" }}>
              <span style={{ color: "#64748b", fontWeight: 700 }}>🏁 Exited:</span>{" "}
              {formatDateTime(c.exitedAt)}
            </div>
          );
        }
        if (c.expectedAt) {
          return (
            <div style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              ⏱️ Expected: {formatDateTime(c.expectedAt)}
            </div>
          );
        }
        return (
          <span style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
            {c.createdAt ? formatDateTime(c.createdAt) : "—"}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Gate Action",
      align: "right",
      render: (c) => (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          {c.status === "approved" && (
            <button
              className="btn btn-primary"
              style={{
                fontSize: "0.75rem",
                padding: "0.3rem 0.75rem",
                fontWeight: 700,
                background: "#059669",
                borderColor: "#059669",
              }}
              onClick={() => handleAllowEntry(c)}
              disabled={admittingId === c.id}
              title="Allow gate entry directly"
            >
              {admittingId === c.id ? "Admitting…" : "✅ Allow Entry"}
            </button>
          )}

          {c.status === "pending" && (
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <button
                className="btn btn-secondary"
                style={{
                  fontSize: "0.75rem",
                  padding: "0.3rem 0.6rem",
                  fontWeight: 600,
                  color: "#d97706",
                  borderColor: "#fde68a",
                  background: "#fffdf0",
                }}
                onClick={() => handleSendApprovalRequest(c)}
                disabled={sendingApprovalId === c.id}
                title="Send real-time approval request notification to resident"
              >
                📲 {sendingApprovalId === c.id ? "Sending…" : "Send Approval Request"}
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.55rem" }}
                onClick={() => handleAllowEntry(c)}
                disabled={admittingId === c.id}
                title="Security override / Admit directly"
              >
                Allow Entry
              </button>
            </div>
          )}

          {c.status === "entered" && (
            <button
              className="btn btn-secondary"
              style={{
                fontSize: "0.75rem",
                padding: "0.3rem 0.65rem",
                fontWeight: 700,
                color: "#1e293b",
              }}
              onClick={() => handleMarkExit(c)}
              title="Log exit timestamp for this vehicle"
            >
              🚪 Mark Exit
            </button>
          )}

          {(c.status === "completed" || c.status === "rejected" || c.status === "cancelled") && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
              onClick={() => setSelectedCabDetails(c)}
            >
              👁️ View
            </button>
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
            <button
              className="btn btn-secondary"
              style={{
                fontWeight: 700,
                color: "var(--primary, #2563eb)",
                borderColor: "var(--primary, #2563eb)",
                background: "#eff6ff",
              }}
              onClick={handleOpenVerifyModal}
            >
              🔍 Verify Cab / Taxi
            </button>
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
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
            background:
              actionMessage.type === "success" ? "var(--success-light)" : "var(--danger-light)",
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

      {/* Quick Verification Banner for Security Guards */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
          color: "#ffffff",
          padding: "1rem 1.25rem",
          borderRadius: "10px",
          marginBottom: "1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              fontSize: "1.5rem",
              background: "rgba(255, 255, 255, 0.2)",
              padding: "0.5rem",
              borderRadius: "8px",
            }}
          >
            🚖
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
              Live Gate Cab & Commercial Taxi Verification
            </h4>
            <p style={{ margin: 0, fontSize: "0.825rem", opacity: 0.9 }}>
              Verify arriving cabs against resident approvals and log instant gate entry and exit
              timestamps.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn"
            onClick={handleOpenVerifyModal}
            style={{
              background: "#ffffff",
              color: "#1e3a8a",
              fontWeight: 700,
              fontSize: "0.85rem",
              padding: "0.45rem 1rem",
              border: "none",
            }}
          >
            🔍 Fast Verification
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          {/* Status Filter Tabs */}
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {[
              { id: "all", label: "All Movements", count: counts.all },
              { id: "pending", label: "Pending Approval", count: counts.pending },
              { id: "approved", label: "Approved / Expected", count: counts.approved },
              { id: "entered", label: "Inside Premises", count: counts.entered },
              { id: "completed", label: "Exited / Closed", count: counts.completed },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id as any)}
                  style={{
                    border: "1px solid",
                    borderColor: active ? "var(--primary, #2563eb)" : "var(--border, #e2e8f0)",
                    background: active ? "var(--primary, #2563eb)" : "#ffffff",
                    color: active ? "#ffffff" : "var(--fg, #334155)",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      background: active ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                      color: active ? "#ffffff" : "var(--muted, #64748b)",
                      padding: "0.05rem 0.4rem",
                      borderRadius: "10px",
                      fontSize: "0.725rem",
                      fontWeight: 700,
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ width: "100%", maxWidth: 260 }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search plate, unit, driver…"
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
          emptyDescription="No cab or taxi entries currently match your filter criteria."
          emptyIcon="🚖"
        />
      </div>

      {/* FAST CAB VERIFICATION MODAL */}
      <Modal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        title="🔍 Verify Cab or Taxi Gate Arrival"
        size="lg"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Instructions banner */}
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              fontSize: "0.85rem",
              color: "#1e40af",
            }}
          >
            💡 <strong>Quick Gate Verification:</strong> Search by Vehicle Plate number, Destination
            Unit, or Driver name to confirm resident approval and admit vehicle.
          </div>

          {/* Search by Plate / Unit */}
          <div>
            <label
              className="form-label"
              style={{ fontWeight: 700, marginBottom: "0.35rem", display: "block" }}
            >
              Search Active Cab Bookings (Vehicle Plate / Unit # / Driver)
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. KA-01-AB-1234 or Unit 101 or Driver name"
              value={verifySearchQuery}
              onChange={(e) => setVerifySearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Search Results Preview */}
          {verifySearchQuery.trim().length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)" }}>
                MATCHED CAB BOOKINGS ({verifiedMatches.length})
              </div>

              {verifiedMatches.length === 0 ? (
                <div
                  style={{
                    padding: "1.25rem",
                    borderRadius: "8px",
                    background: "#f8fafc",
                    border: "1px dashed #cbd5e1",
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600, color: "var(--fg)" }}>
                    No pre-approved cab bookings match &quot;{verifySearchQuery}&quot;.
                  </p>
                  <p
                    style={{
                      margin: "0.25rem 0 0.75rem",
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                    }}
                  >
                    You can log this arrival immediately for the destination unit.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: "0.825rem", padding: "0.35rem 0.85rem" }}
                    onClick={() => {
                      setIsVerifyModalOpen(false);
                      handleOpenModal(verifySearchQuery);
                    }}
                  >
                    + Log New Arrival For &quot;{verifySearchQuery}&quot;
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {verifiedMatches.map((cab) => (
                    <div
                      key={cab.id}
                      style={{
                        padding: "0.85rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border, #e2e8f0)",
                        background: "#ffffff",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            marginBottom: "0.25rem",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 800,
                              fontSize: "0.95rem",
                            }}
                          >
                            🚖 {cab.vehicleNumber}
                          </span>
                          <span
                            style={{
                              padding: "0.15rem 0.4rem",
                              background: "#f1f5f9",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            {cab.purpose}
                          </span>
                          <StatusBadge status={cab.status} />
                        </div>
                        <div style={{ fontSize: "0.825rem", color: "var(--muted)" }}>
                          Destination:{" "}
                          <strong style={{ color: "var(--fg)" }}>{cab.unit_number}</strong> ·
                          Driver: <strong>{cab.visitorName}</strong>{" "}
                          {cab.visitorPhone ? `(${cab.visitorPhone})` : ""}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {cab.status === "approved" && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{
                              fontSize: "0.8rem",
                              padding: "0.35rem 0.75rem",
                              background: "#059669",
                              borderColor: "#059669",
                            }}
                            onClick={() => {
                              handleAllowEntry(cab);
                            }}
                            disabled={admittingId === cab.id}
                          >
                            {admittingId === cab.id ? "Admitting…" : "✅ Allow Entry"}
                          </button>
                        )}
                        {cab.status === "pending" && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              fontSize: "0.8rem",
                              padding: "0.35rem 0.75rem",
                              color: "#d97706",
                              borderColor: "#fde68a",
                            }}
                            onClick={() => {
                              handleSendApprovalRequest(cab);
                            }}
                            disabled={sendingApprovalId === cab.id}
                          >
                            📲 {sendingApprovalId === cab.id ? "Sending…" : "Send Approval"}
                          </button>
                        )}
                        {cab.status === "entered" && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                            onClick={() => {
                              handleMarkExit(cab);
                              setIsVerifyModalOpen(false);
                            }}
                          >
                            🚪 Mark Exit
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* FULL CAB DETAILS MODAL */}
      {selectedCabDetails && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCabDetails(null)}
          title={`🚖 Cab Ticket Details: ${selectedCabDetails.vehicleNumber}`}
          size="md"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                padding: "1rem",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                  Vehicle Plate #
                </span>
                <strong style={{ fontFamily: "monospace", fontSize: "1rem", color: "var(--fg)" }}>
                  {selectedCabDetails.vehicleNumber}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                  Gate Status
                </span>
                <StatusBadge status={selectedCabDetails.status} />
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                  Destination Unit
                </span>
                <strong style={{ color: "var(--fg)" }}>{selectedCabDetails.unit_number}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                  Service Provider
                </span>
                <strong>{selectedCabDetails.purpose}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                  Driver Name
                </span>
                <span>{selectedCabDetails.visitorName}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                  Driver Phone
                </span>
                <span style={{ fontFamily: "monospace" }}>
                  {selectedCabDetails.visitorPhone || "—"}
                </span>
              </div>
              {selectedCabDetails.enteredAt && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                    Entered Timestamp
                  </span>
                  <span style={{ fontWeight: 600, color: "#059669" }}>
                    {formatDateTime(selectedCabDetails.enteredAt)}
                  </span>
                </div>
              )}
              {selectedCabDetails.exitedAt && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                    Exited Timestamp
                  </span>
                  <span style={{ fontWeight: 600, color: "#64748b" }}>
                    {formatDateTime(selectedCabDetails.exitedAt)}
                  </span>
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                marginTop: "0.75rem",
              }}
            >
              {selectedCabDetails.status === "approved" && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: "#059669", borderColor: "#059669" }}
                  onClick={() => {
                    handleAllowEntry(selectedCabDetails);
                  }}
                  disabled={admittingId === selectedCabDetails.id}
                >
                  {admittingId === selectedCabDetails.id ? "Admitting…" : "✅ Allow Entry"}
                </button>
              )}
              {selectedCabDetails.status === "pending" && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ color: "#d97706", borderColor: "#fde68a" }}
                  onClick={() => {
                    handleSendApprovalRequest(selectedCabDetails);
                  }}
                  disabled={sendingApprovalId === selectedCabDetails.id}
                >
                  📲{" "}
                  {sendingApprovalId === selectedCabDetails.id
                    ? "Sending…"
                    : "Send Approval Request"}
                </button>
              )}
              {selectedCabDetails.status === "entered" && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const c = selectedCabDetails;
                    setSelectedCabDetails(null);
                    handleMarkExit(c);
                  }}
                >
                  🚪 Mark Exit
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedCabDetails(null)}
              >
                Close
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
        <form
          onSubmit={handleCreateCabArrival}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
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
            <label
              className="form-label"
              style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}
            >
              Destination Resident Unit *
            </label>
            <select
              className="form-control"
              value={selectedUnitId}
              onChange={(e) => {
                setSelectedUnitId(e.target.value);
                if (cabFieldErrors.unitId) {
                  setCabFieldErrors((prev) => ({ ...prev, unitId: "" }));
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
            {cabFieldErrors.unitId && (
              <span
                style={{
                  color: "var(--danger, #ef4444)",
                  fontSize: "0.75rem",
                  display: "block",
                  marginTop: "0.25rem",
                }}
              >
                {cabFieldErrors.unitId}
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label
                className="form-label"
                style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}
              >
                Vehicle Plate Number *
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. KA-01-AB-1234"
                value={vehicleNumber}
                onChange={(e) => {
                  setVehicleNumber(e.target.value);
                  if (cabFieldErrors.vehicleNumber) {
                    setCabFieldErrors((prev) => ({ ...prev, vehicleNumber: "" }));
                  }
                }}
                required
              />
              {cabFieldErrors.vehicleNumber && (
                <span
                  style={{
                    color: "var(--danger, #ef4444)",
                    fontSize: "0.75rem",
                    display: "block",
                    marginTop: "0.25rem",
                  }}
                >
                  {cabFieldErrors.vehicleNumber}
                </span>
              )}
            </div>

            <div>
              <label
                className="form-label"
                style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}
              >
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
              <label
                className="form-label"
                style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}
              >
                Driver Name (Optional)
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Driver full name"
                value={driverName}
                onChange={(e) => {
                  setDriverName(e.target.value);
                  if (cabFieldErrors.driverName) {
                    setCabFieldErrors((prev) => ({ ...prev, driverName: "" }));
                  }
                }}
              />
              {cabFieldErrors.driverName && (
                <span
                  style={{
                    color: "var(--danger, #ef4444)",
                    fontSize: "0.75rem",
                    display: "block",
                    marginTop: "0.25rem",
                  }}
                >
                  {cabFieldErrors.driverName}
                </span>
              )}
            </div>

            <div>
              <label
                className="form-label"
                style={{ fontWeight: 600, marginBottom: "0.35rem", display: "block" }}
              >
                Driver Phone (Optional)
              </label>
              <input
                type="tel"
                className="form-control"
                placeholder="10-digit mobile"
                value={driverPhone}
                onChange={(e) => {
                  setDriverPhone(e.target.value);
                  if (cabFieldErrors.driverPhone) {
                    setCabFieldErrors((prev) => ({ ...prev, driverPhone: "" }));
                  }
                }}
              />
              {cabFieldErrors.driverPhone && (
                <span
                  style={{
                    color: "var(--danger, #ef4444)",
                    fontSize: "0.75rem",
                    display: "block",
                    marginTop: "0.25rem",
                  }}
                >
                  {cabFieldErrors.driverPhone}
                </span>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
