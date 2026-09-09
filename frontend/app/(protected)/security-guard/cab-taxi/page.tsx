"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { visitorsApi } from "@/lib/api";

interface CabMovement {
  id: string;
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

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [requests, directory, entries] = await Promise.all([
        visitorsApi.requests(),
        visitorsApi.directory(),
        visitorsApi.entries(),
      ]);
      const visitorMap = new Map<string, any>();
      for (const v of directory || []) if ((v as any)?.id) visitorMap.set((v as any).id as string, v);
      const openEntryByRequest = new Map<string, any>();
      for (const e of entries || []) {
        if ((e as any).request_id && !(e as any).exit_at) openEntryByRequest.set((e as any).request_id as string, e);
      }

      // Real backend: "cab_taxi" is a visitor_type on /visitors/requests (backend/app/modules/visitors/models.py VISITOR_TYPES).
      const cabRequests = (requests || []).filter((r: any) => r.visitor_type === "cab_taxi");
      setCabs(
        cabRequests.map((r: any) => {
          const visitor = visitorMap.get(r.visitor_id);
          const openEntry = openEntryByRequest.get(r.id);
          return {
            id: r.id,
            visitorName: visitor?.full_name || "Cab / Taxi Driver",
            vehicleNumber: r.vehicle_number || visitor?.vehicle_number || "—",
            purpose: r.purpose || "Cab / Taxi",
            status: r.status,
            entryId: openEntry?.id,
          };
        })
      );
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load cab/taxi movements.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAllowEntry = async (cab: CabMovement) => {
    try {
      await visitorsApi.recordEntry({ request_id: cab.id });
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to record entry.");
    }
  };

  const handleMarkExit = async (cab: CabMovement) => {
    if (!cab.entryId) return;
    try {
      await visitorsApi.recordExit(cab.entryId);
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to record exit.");
    }
  };

  const filteredCabs = cabs.filter(
    (c) =>
      c.vehicleNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.visitorName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Cab & Taxi Verification"
        subtitle="Verify cab arrivals against resident-approved requests, and log gate entry/exit timestamps"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Guard" }, { label: "Cab / Taxi" }]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Commercial Cab Movements</h3>
          </div>
          <div style={{ width: 220 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search vehicle/passenger…" />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle Plate #</th>
                <th>Driver / Passenger</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>Loading…</td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--danger, #dc2626)" }}>{loadError}</td>
                </tr>
              ) : filteredCabs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No cab/taxi requests found.
                  </td>
                </tr>
              ) : (
                filteredCabs.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: "monospace", fontWeight: 700 }}>🚖 {c.vehicleNumber}</td>
                    <td>{c.visitorName}</td>
                    <td>{c.purpose}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      {c.status === "approved" ? (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                          onClick={() => handleAllowEntry(c)}
                        >
                          Allow Entry
                        </button>
                      ) : c.status === "entered" && c.entryId ? (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                          onClick={() => handleMarkExit(c)}
                        >
                          Mark Exit
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
