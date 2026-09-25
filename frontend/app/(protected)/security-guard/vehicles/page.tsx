"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState } from "@/components/common/ErrorState";
import { SearchInput } from "@/components/forms/SearchInput";
import { VehicleEntriesTable } from "@/components/vehicles/VehicleEntriesTable";
import { ReportViolationModal } from "@/components/vehicles/ReportViolationModal";
import {
  useParkingInventory,
  usePlateLookup,
  useRecordVehicleEntry,
  useRecordVehicleExit,
  useVehicleCommunityId,
  useVehicleEntries,
  useVehicleLookups,
} from "@/hooks/use-vehicles";
import { toast } from "@/store/toast";
import {
  ENTRY_SOURCE_LABELS,
  PLATE_PATTERN,
  normalizePlate,
  type EntrySource,
  type VehicleEntry,
} from "@/types/vehicles";

const PAGE_SIZE = 20;
type View = "inside" | "flagged" | "all";

const entrySchema = z.object({
  registration_number: z
    .string()
    .transform(normalizePlate)
    .refine((v) => PLATE_PATTERN.test(v), "Enter a valid plate (3–15 letters/digits)"),
  gate_id: z.string().optional(),
  source_type: z.enum(Object.keys(ENTRY_SOURCE_LABELS) as [EntrySource, ...EntrySource[]]),
});
type EntryIn = z.input<typeof entrySchema>;
type EntryOut = z.output<typeof entrySchema>;

interface Interception {
  plate: string;
  message: string;
  risk?: string;
}

/**
 * Security Guard — Vehicle Gate Desk (FR-08 / FR-05).
 * Log plate entries and exits, see who is inside, and report parking violations.
 * Blacklisted plates are intercepted server-side before any entry is recorded.
 */
export default function SecurityGuardVehiclesPage() {
  const cid = useVehicleCommunityId();
  const [view, setView] = useState<View>("inside");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPlate, setReportPlate] = useState<string | undefined>();
  const [intercepted, setIntercepted] = useState<Interception | null>(null);
  const [exitingId, setExitingId] = useState<string | null>(null);

  const filters = {
    openOnly: view !== "all",
    flaggedOnly: view === "flagged",
    plate: search.trim() || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  // Live gate state: short polling (TRD §3.1) — a refetch keeps rows on screen.
  const entries = useVehicleEntries(cid, filters, { refetchInterval: 15_000 });
  const { gates, gateName } = useVehicleLookups(cid);
  const { slots } = useParkingInventory(cid);
  const recordEntry = useRecordVehicleEntry(cid);
  const recordExit = useRecordVehicleExit(cid);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm<EntryIn, unknown, EntryOut>({
    resolver: zodResolver(entrySchema),
    defaultValues: { registration_number: "", gate_id: "", source_type: "resident" },
  });
  const typedPlate = normalizePlate(useWatch({ control, name: "registration_number" }) || "");
  const lookup = usePlateLookup(cid, typedPlate);

  const onLogEntry = (v: EntryOut) => {
    setIntercepted(null);
    recordEntry.submit(
      {
        registration_number: v.registration_number,
        gate_id: v.gate_id || undefined,
        source_type: v.source_type,
      },
      {
        onSuccess: (row) => {
          if (row.is_flagged) {
            toast.warning(
              `${row.registration_number} is not registered — entry logged and flagged for the supervisor.`,
              "Flagged entry",
            );
          } else {
            toast.success(`${row.registration_number} entry logged.`, "Vehicle entered");
          }
          reset({ registration_number: "", gate_id: v.gate_id, source_type: v.source_type });
        },
        onError: (err: any) => {
          if (err?.code === "PLATE_BLACKLISTED") {
            setIntercepted({
              plate: v.registration_number,
              message: err.message,
              risk: err?.fields?.risk_level,
            });
            return;
          }
          if (err?.code === "ALREADY_INSIDE") {
            setError("registration_number", {
              message: "This vehicle is already inside — log its exit first.",
            });
            return;
          }
          if (err?.code === "STAFF_ONLY" || err?.status === 403) {
            toast.error("You are not permitted to log gate entries.", "Access denied");
            return;
          }
          setError("root", { message: err?.message || "Could not log the entry." });
        },
      },
    );
  };

  const onExit = (e: VehicleEntry) => {
    setExitingId(e.id);
    recordExit.submit(e.id, {
      onSuccess: () => toast.success(`${e.registration_number} exit logged.`, "Vehicle exited"),
      onError: (err: any) => toast.error(err?.message || "Could not log the exit."),
      onSettled: () => setExitingId(null),
    });
  };

  const precheck = useMemo(() => {
    if (typedPlate.length < 4 || !PLATE_PATTERN.test(typedPlate)) return null;
    if (lookup.isLoading) return { tone: "info", text: "Checking registry…" };
    if (lookup.isError)
      return { tone: "info", text: "Registry check unavailable — entry can still be logged." };
    const v = lookup.data;
    if (!v)
      return {
        tone: "warn",
        text: "Not registered in this community — the entry will be flagged.",
      };
    if (!v.is_active)
      return { tone: "warn", text: "Registration deactivated — the entry will be flagged." };
    const who = v.visitor_id ? "Visitor vehicle" : "Resident vehicle";
    const desc = [v.make, v.model, v.color].filter(Boolean).join(" ");
    return {
      tone: "ok",
      text: `${who}${desc ? ` · ${desc}` : ""}${v.sticker_number ? ` · Sticker ${v.sticker_number}` : ""}`,
    };
  }, [typedPlate, lookup.isLoading, lookup.isError, lookup.data]);

  const toneStyle: Record<string, React.CSSProperties> = {
    ok: {
      background: "var(--success-light)",
      border: "1px solid var(--success-border)",
      color: "#065f46",
    },
    warn: { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" },
    info: { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" },
  };

  const viewTabs: { id: View; label: string }[] = [
    { id: "inside", label: "Inside now" },
    { id: "flagged", label: "Flagged inside" },
    { id: "all", label: "All movements" },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Vehicle Gate Desk"
        subtitle="Log vehicle entries and exits by plate, check registrations, and report parking violations"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Guard" }, { label: "Vehicles" }]}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setReportPlate(undefined);
              setReportOpen(true);
            }}
            disabled={!cid}
          >
            🅿️ Report Violation
          </button>
        }
      />

      {!cid && (
        <ErrorState
          title="No community assigned"
          message="Your account has no community grant, so there is no gate to operate."
        />
      )}

      {intercepted && (
        <div
          role="alert"
          style={{
            padding: "0.9rem 1rem",
            marginBottom: "1rem",
            borderRadius: "var(--radius)",
            background: "var(--danger-light)",
            border: "2px solid #e03b3b",
            color: "#991b1b",
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            alignItems: "flex-start",
          }}
        >
          <div>
            <strong style={{ fontSize: "1rem" }}>⛔ ENTRY BLOCKED — {intercepted.plate}</strong>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
              {intercepted.message}
              {intercepted.risk ? ` (risk: ${intercepted.risk.toUpperCase()})` : ""}. Do not open
              the barrier; inform your supervisor.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIntercepted(null)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {cid && (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {/* LOG ENTRY */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <h3 className="card-title" style={{ marginBottom: "0.75rem" }}>
              Log vehicle entry
            </h3>
            <form
              onSubmit={handleSubmit(onLogEntry)}
              noValidate
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
                gap: "0.9rem",
                alignItems: "end",
              }}
            >
              <div>
                <label className="form-label" htmlFor="ve-plate">
                  Plate number *
                </label>
                <input
                  id="ve-plate"
                  className="form-control"
                  placeholder="KA01AB1234"
                  autoComplete="off"
                  autoFocus
                  style={{
                    textTransform: "uppercase",
                    fontFamily: "monospace",
                    fontSize: "1.05rem",
                  }}
                  aria-invalid={!!errors.registration_number}
                  {...register("registration_number")}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="ve-gate">
                  Gate
                </label>
                <select id="ve-gate" className="form-control" {...register("gate_id")}>
                  <option value="">— Select gate —</option>
                  {gates.map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.name || g.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="ve-source">
                  Vehicle of
                </label>
                <select id="ve-source" className="form-control" {...register("source_type")}>
                  {Object.entries(ENTRY_SOURCE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={recordEntry.isPending}
                aria-busy={recordEntry.isPending}
                style={{ minHeight: 42 }}
              >
                {recordEntry.isPending ? "Logging…" : "✅ Log Entry"}
              </button>
            </form>
            <div aria-live="polite" style={{ marginTop: "0.6rem", display: "grid", gap: "0.4rem" }}>
              {errors.registration_number && (
                <span role="alert" style={{ color: "#e03b3b", fontSize: "0.8rem" }}>
                  {errors.registration_number.message}
                </span>
              )}
              {errors.root && (
                <span role="alert" style={{ color: "#e03b3b", fontSize: "0.8rem" }}>
                  {errors.root.message}
                </span>
              )}
              {precheck && (
                <div
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius)",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    ...toneStyle[precheck.tone],
                  }}
                >
                  {typedPlate}: {precheck.text}
                </div>
              )}
            </div>
          </div>

          {/* GATE LOG */}
          <div className="card">
            <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
              <div
                role="tablist"
                aria-label="Gate log view"
                style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}
              >
                {viewTabs.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={view === t.id}
                    type="button"
                    className={view === t.id ? "btn btn-primary" : "btn btn-secondary"}
                    style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem" }}
                    onClick={() => {
                      setView(t.id);
                      setPage(1);
                    }}
                  >
                    {t.label}
                    {view === t.id && entries.data ? ` (${entries.data.total})` : ""}
                  </button>
                ))}
              </div>
              <div style={{ width: "100%", maxWidth: 240 }}>
                <SearchInput
                  value={search}
                  onChange={(v: string) => {
                    setSearch(v);
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
                onExit={onExit}
                exitingId={exitingId}
                emptyTitle={
                  search
                    ? "No vehicle matches that plate"
                    : view === "all"
                      ? "No vehicle movements yet"
                      : "No vehicles inside"
                }
                emptyDescription={
                  search
                    ? "Try fewer characters, or check the plate with the driver."
                    : view === "flagged"
                      ? "No unregistered vehicles are currently inside."
                      : "Logged entries will appear here."
                }
              />
            )}
          </div>
        </div>
      )}

      <ReportViolationModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        communityId={cid}
        slots={slots.data ?? []}
        allowFine
        defaultPlate={reportPlate}
      />
    </div>
  );
}
