"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { deliveriesApi } from "@/lib/api";

interface DeliveryRow {
  id: string;
  provider_name: string;
  delivery_type: string;
  executive_name: string;
  tracking_reference: string;
  status: string;
  protocol_type: string;
  arrived_at?: string | null;
}

export default function SecurityGuardDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [data, protocols] = await Promise.all([
        deliveriesApi.list(),
        deliveriesApi.protocols(),
      ]);
      const protocolMap = new Map<string, string>();
      for (const p of protocols || [])
        if ((p as any)?.id) protocolMap.set((p as any).id, (p as any).protocol_type);
      setDeliveries(
        (data || []).map((d: any) => ({
          id: d.id,
          provider_name: d.provider_name || d.delivery_type?.toUpperCase() || "Courier",
          delivery_type: d.delivery_type,
          executive_name: d.executive_name || "—",
          tracking_reference: d.tracking_reference || d.id.slice(0, 8),
          status: d.status,
          protocol_type: protocolMap.get(d.protocol_id) || "—",
          arrived_at: d.arrived_at,
        })),
      );
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load deliveries.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordArrival = async (id: string) => {
    try {
      await deliveriesApi.recordArrival(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to record arrival.");
    }
  };

  const handleMarkDelivered = async (id: string) => {
    try {
      await deliveriesApi.markDelivered(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to mark delivered.");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await deliveriesApi.cancel(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to cancel delivery.");
    }
  };

  const filteredDeliveries = deliveries.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.provider_name.toLowerCase().includes(q) ||
      d.executive_name.toLowerCase().includes(q) ||
      d.tracking_reference.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title="Delivery Verification & Gate Decision"
        subtitle="Verify courier arrival, record gate hand-off, and track delivery protocol status"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Guard" },
          { label: "Deliveries" },
        ]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Delivery Desk Queue</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredDeliveries.length} deliveries
            </p>
          </div>

          <div style={{ width: "100%", maxWidth: 220 }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search courier/tracking…"
            />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Type</th>
                <th>Executive</th>
                <th>Tracking Ref</th>
                <th>Protocol</th>
                <th>Status</th>
                <th>Gate Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading deliveries…
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
              ) : filteredDeliveries.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No deliveries found.
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{d.provider_name}</td>
                    <td style={{ textTransform: "capitalize" }}>{d.delivery_type}</td>
                    <td>{d.executive_name}</td>
                    <td style={{ fontFamily: "monospace" }}>{d.tracking_reference}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {d.protocol_type.replace(/_/g, " ")}
                    </td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {d.status === "expected" && (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => handleRecordArrival(d.id)}
                          >
                            Record Arrival
                          </button>
                        )}
                        {(d.status === "at_gate" || d.status === "in_transit") && (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => handleMarkDelivered(d.id)}
                          >
                            Mark Delivered
                          </button>
                        )}
                        {!["delivered", "collected", "cancelled", "returned"].includes(
                          d.status,
                        ) && (
                          <button
                            className="btn btn-danger"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => handleCancel(d.id)}
                          >
                            Reject
                          </button>
                        )}
                      </div>
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
