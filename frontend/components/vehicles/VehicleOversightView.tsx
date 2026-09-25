"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/common/LoadingSkeleton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SearchInput } from "@/components/forms/SearchInput";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { VehicleEntriesTable } from "@/components/vehicles/VehicleEntriesTable";
import { ViolationsTable } from "@/components/vehicles/ViolationsTable";
import { ReportViolationModal } from "@/components/vehicles/ReportViolationModal";
import {
  useParkingInventory,
  useParkingViolations,
  useRecordVehicleExit,
  useTransitionViolation,
  useVehicleCommunityId,
  useVehicleEntries,
  useVehicleLookups,
  useVehicleRegistry,
} from "@/hooks/use-vehicles";
import { toast } from "@/store/toast";
import type {
  ParkingSlot,
  ParkingViolation,
  Vehicle,
  VehicleEntry,
  ViolationStatus,
} from "@/types/vehicles";

const PAGE_SIZE = 20;
type Tab = "gate-log" | "violations" | "registry" | "slots";
const TABS: { id: Tab; label: string }[] = [
  { id: "gate-log", label: "Gate log" },
  { id: "violations", label: "Violations" },
  { id: "registry", label: "Vehicle registry" },
  { id: "slots", label: "Parking slots" },
];

interface Props {
  /** Auditor: GET-only. No exit / report / lifecycle controls are rendered at all. */
  readOnly: boolean;
  title: string;
  subtitle: string;
  breadcrumbs: { label: string }[];
}

/**
 * Vehicle & Parking oversight (FR-08) — Security Supervisor (actions) and Auditor
 * (read-only). The active tab is a search param so a view is linkable (AGENTS.md §5.3).
 */
export function VehicleOversightView({ readOnly, title, subtitle, breadcrumbs }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "gate-log") as Tab;
  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  const cid = useVehicleCommunityId();
  const { gateName, unitName } = useVehicleLookups(cid);
  const { slots, allocations } = useParkingInventory(cid);

  // KPI tiles — `total` from page_size=1 reads; never the whole table.
  const insideNow = useVehicleEntries(
    cid,
    { openOnly: true, pageSize: 1 },
    { refetchInterval: 30_000 },
  );
  const flaggedInside = useVehicleEntries(
    cid,
    { openOnly: true, flaggedOnly: true, pageSize: 1 },
    { refetchInterval: 30_000 },
  );
  const openViolations = useParkingViolations(cid, { status: "open", pageSize: 1 });

  const slotCode = useMemo(
    () => new Map((slots.data ?? []).map((s) => [s.id, s.slot_code])),
    [slots.data],
  );
  const allocatedVehicle = useMemo(
    () => new Map((allocations.data ?? []).map((a) => [a.slot_id, a.vehicle_id])),
    [allocations.data],
  );
  const occupied = (slots.data ?? []).filter((s) => s.status === "allocated").length;

  const [reportOpen, setReportOpen] = useState(false);

  const kpis = [
    { label: "Vehicles inside", value: insideNow.data?.total, accent: "#4f8ef7" },
    { label: "Flagged inside", value: flaggedInside.data?.total, accent: "#f59e0b" },
    { label: "Open violations", value: openViolations.data?.total, accent: "#e03b3b" },
    {
      label: "Slots allocated",
      value: slots.data ? `${occupied} / ${slots.data.length}` : undefined,
      accent: "#1aab5f",
    },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        actions={
          readOnly ? (
            <StatusBadge status="info" label="🔒 Read-only access" />
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setReportOpen(true)}
              disabled={!cid}
            >
              🅿️ Report Violation
            </button>
          )
        }
      />

      {!cid ? (
        <ErrorState
          title="No community selected"
          message="Select a community to view its vehicle and parking records."
        />
      ) : (
        <>
          <div
            aria-live="polite"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
              gap: "0.9rem",
              marginBottom: "1.25rem",
            }}
          >
            {kpis.map((k) => (
              <div
                key={k.label}
                className="card"
                style={{ padding: "0.9rem 1rem", borderTop: `3px solid ${k.accent}` }}
              >
                <div
                  style={{
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  {k.label}
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.2rem" }}>
                  {k.value ?? (
                    <span aria-busy="true" style={{ display: "block", paddingTop: "0.35rem" }}>
                      <span className="sr-only">Loading {k.label}</span>
                      <Skeleton width={56} height={26} borderRadius={6} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div
            role="tablist"
            aria-label="Vehicle records"
            style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.9rem" }}
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                className={tab === t.id ? "btn btn-primary" : "btn btn-secondary"}
                style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem" }}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "gate-log" && <GateLogTab cid={cid} readOnly={readOnly} gateName={gateName} />}
          {tab === "violations" && (
            <ViolationsTab cid={cid} readOnly={readOnly} slotCode={slotCode} />
          )}
          {tab === "registry" && <RegistryTab cid={cid} unitName={unitName} />}
          {tab === "slots" && (
            <SlotsTab
              slots={slots.data ?? []}
              isLoading={slots.isLoading}
              isError={slots.isError}
              onRetry={() => slots.refetch()}
              unitName={unitName}
              allocatedVehicle={allocatedVehicle}
            />
          )}
        </>
      )}

      {!readOnly && (
        <ReportViolationModal
          isOpen={reportOpen}
          onClose={() => setReportOpen(false)}
          communityId={cid}
          slots={slots.data ?? []}
          allowFine
        />
      )}
    </div>
  );
}

// -- tabs ----------------------------------------------------------------------------- //
function GateLogTab({
  cid,
  readOnly,
  gateName,
}: {
  cid: string;
  readOnly: boolean;
  gateName: Map<string, string>;
}) {
  const [page, setPage] = useState(1);
  const [plate, setPlate] = useState("");
  const [scope, setScope] = useState<"all" | "inside" | "flagged">("all");
  const [exitingId, setExitingId] = useState<string | null>(null);
  const entries = useVehicleEntries(
    cid,
    {
      openOnly: scope !== "all",
      flaggedOnly: scope === "flagged",
      plate: plate.trim() || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
    { refetchInterval: 30_000 },
  );
  const recordExit = useRecordVehicleExit(cid);
  const onExit = (e: VehicleEntry) => {
    setExitingId(e.id);
    recordExit.submit(e.id, {
      onSuccess: () => toast.success(`${e.registration_number} exit logged.`),
      onError: (err: any) => toast.error(err?.message || "Could not log the exit."),
      onSettled: () => setExitingId(null),
    });
  };

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
        <select
          className="form-control"
          aria-label="Filter gate log"
          style={{ maxWidth: 220 }}
          value={scope}
          onChange={(e) => {
            setScope(e.target.value as typeof scope);
            setPage(1);
          }}
        >
          <option value="all">All movements</option>
          <option value="inside">Inside now</option>
          <option value="flagged">Flagged (unregistered) inside</option>
        </select>
        <div style={{ width: "100%", maxWidth: 240 }}>
          <SearchInput
            value={plate}
            onChange={(v: string) => {
              setPlate(v);
              setPage(1);
            }}
            placeholder="Search plate…"
          />
        </div>
      </div>
      {entries.isError && !entries.data ? (
        <ErrorState
          title="Could not load the gate log"
          message={(entries.error as Error)?.message}
          onRetry={() => entries.refetch()}
        />
      ) : (
        <VehicleEntriesTable
          rows={entries.data?.rows ?? []}
          total={entries.data?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          isLoading={entries.isLoading}
          gateName={gateName}
          onExit={readOnly ? undefined : onExit}
          exitingId={exitingId}
          emptyTitle={
            plate || scope !== "all"
              ? "No movements match your filters"
              : "No vehicle movements recorded yet"
          }
          emptyDescription={
            plate || scope !== "all"
              ? "Clear the search or change the filter."
              : "Gate entries logged by guards appear here."
          }
        />
      )}
    </div>
  );
}

function ViolationsTab({
  cid,
  readOnly,
  slotCode,
}: {
  cid: string;
  readOnly: boolean;
  slotCode: Map<string, string>;
}) {
  const [page, setPage] = useState(1);
  const [plate, setPlate] = useState("");
  const [status, setStatus] = useState<ViolationStatus | "">("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const violations = useParkingViolations(cid, {
    status,
    plate: plate.trim() || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const transition = useTransitionViolation(cid);
  const onTransition = (v: ParkingViolation, next: ViolationStatus) => {
    setBusyId(v.id);
    transition.submit(
      { id: v.id, status: next },
      {
        onSuccess: () =>
          toast.success(`Violation for ${v.registration_number || "vehicle"} marked ${next}.`),
        onError: (err: any) => toast.error(err?.message || "Could not update the violation."),
        onSettled: () => setBusyId(null),
      },
    );
  };
  const filtered = !!plate || !!status;

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
        <select
          className="form-control"
          aria-label="Filter by status"
          style={{ maxWidth: 200 }}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ViolationStatus | "");
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="waived">Waived</option>
        </select>
        <div style={{ width: "100%", maxWidth: 240 }}>
          <SearchInput
            value={plate}
            onChange={(v: string) => {
              setPlate(v);
              setPage(1);
            }}
            placeholder="Search plate…"
          />
        </div>
      </div>
      {violations.isError && !violations.data ? (
        <ErrorState
          title="Could not load violations"
          message={(violations.error as Error)?.message}
          onRetry={() => violations.refetch()}
        />
      ) : (
        <ViolationsTable
          rows={violations.data?.rows ?? []}
          total={violations.data?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          isLoading={violations.isLoading}
          slotCode={slotCode}
          onTransition={readOnly ? undefined : onTransition}
          busyId={busyId}
          emptyTitle={
            filtered ? "No violations match your filters" : "No parking violations reported"
          }
          emptyDescription={
            filtered
              ? "Clear the search or pick another status."
              : "Violations reported by guards and residents appear here."
          }
        />
      )}
    </div>
  );
}

function RegistryTab({ cid, unitName }: { cid: string; unitName: Map<string, string> }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const registry = useVehicleRegistry(cid, { q: q.trim() || undefined, page, pageSize: PAGE_SIZE });
  const columns: Column<Vehicle>[] = [
    {
      key: "registration_number",
      header: "Plate",
      render: (v) => (
        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{v.registration_number}</span>
      ),
    },
    { key: "owner", header: "Owner", render: (v) => (v.visitor_id ? "Visitor" : "Resident") },
    {
      key: "unit_id",
      header: "Unit",
      render: (v) => (v.unit_id ? unitName.get(v.unit_id) || "—" : "—"),
    },
    {
      key: "vehicle_type",
      header: "Type",
      render: (v) => (
        <span style={{ textTransform: "capitalize" }}>{v.vehicle_type.replace("_", " ")}</span>
      ),
    },
    {
      key: "make",
      header: "Make / model",
      render: (v) => [v.make, v.model, v.color].filter(Boolean).join(" ") || "—",
    },
    { key: "sticker_number", header: "Sticker", render: (v) => v.sticker_number || "Not issued" },
    { key: "is_active", header: "Status", render: (v) => <StatusBadge status={v.is_active} /> },
  ];
  return (
    <div className="card">
      <div className="card-header">
        <div style={{ width: "100%", maxWidth: 260 }}>
          <SearchInput
            value={q}
            onChange={(v: string) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Search plate…"
          />
        </div>
      </div>
      {registry.isError && !registry.data ? (
        <ErrorState
          title="Could not load the registry"
          message={(registry.error as Error)?.message}
          onRetry={() => registry.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={registry.data?.rows ?? []}
          total={registry.data?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          isLoading={registry.isLoading}
          keyExtractor={(v) => v.id}
          emptyTitle={q ? "No vehicle matches that plate" : "No vehicles registered yet"}
          emptyDescription={
            q ? "Check the plate and try again." : "Residents register vehicles from their portal."
          }
          emptyIcon="🚙"
        />
      )}
    </div>
  );
}

function SlotsTab({
  slots,
  isLoading,
  isError,
  onRetry,
  unitName,
  allocatedVehicle,
}: {
  slots: ParkingSlot[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  unitName: Map<string, string>;
  allocatedVehicle: Map<string, string>;
}) {
  const columns: Column<ParkingSlot>[] = [
    { key: "slot_code", header: "Slot", render: (s) => <strong>{s.slot_code}</strong> },
    {
      key: "slot_type",
      header: "Type",
      render: (s) => (
        <span style={{ textTransform: "capitalize" }}>
          {s.slot_type}
          {s.is_guest_slot ? " · guest" : ""}
        </span>
      ),
    },
    { key: "level", header: "Level", render: (s) => s.level || "—" },
    {
      key: "reserved_for_unit_id",
      header: "Reserved for",
      render: (s) =>
        s.reserved_for_unit_id ? unitName.get(s.reserved_for_unit_id) || "Unit" : "—",
    },
    {
      key: "status",
      header: "Status",
      render: (s) => (
        <StatusBadge
          status={
            s.status === "available" ? "active" : s.status === "blocked" ? "inactive" : "assigned"
          }
          label={s.status}
        />
      ),
    },
    {
      key: "vehicle",
      header: "Allocated",
      render: (s) => (allocatedVehicle.has(s.id) ? "Yes" : "—"),
    },
  ];
  if (isError) return <ErrorState title="Could not load parking slots" onRetry={onRetry} />;
  return (
    <div className="card">
      <DataTable
        columns={columns}
        data={slots}
        isLoading={isLoading}
        enableClientPagination
        pageSize={PAGE_SIZE}
        keyExtractor={(s) => s.id}
        emptyTitle="No parking slots configured"
        emptyDescription="Slots are created by the community admin or facility manager."
        emptyIcon="🅿️"
      />
    </div>
  );
}
