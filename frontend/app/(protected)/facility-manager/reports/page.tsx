"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { complaintsApi, amenitiesApi } from "@/lib/api";

interface CategoryReportRow {
  category_name: string;
  total: number;
  resolved: number;
  onTrackPct: number;
}

export default function FacilityManagerReportsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categoryRows, setCategoryRows] = useState<CategoryReportRow[]>([]);
  const [amenityBookingsTotal, setAmenityBookingsTotal] = useState(0);
  const [amenityBookingsCancelled, setAmenityBookingsCancelled] = useState(0);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [tickets, categories, bookings] = await Promise.all([
          complaintsApi.list(),
          complaintsApi.categories(),
          amenitiesApi.bookings(),
        ]);

        const categoryMap = new Map<string, string>();
        for (const c of categories || []) if (c?.id) categoryMap.set(c.id, c.name);

        const byCategory = new Map<string, { total: number; resolved: number; onTrack: number }>();
        for (const t of tickets || []) {
          const name = categoryMap.get((t as any).category_id) || "Uncategorized";
          const bucket = byCategory.get(name) || { total: 0, resolved: 0, onTrack: 0 };
          bucket.total += 1;
          if ((t as any).status === "resolved" || (t as any).status === "closed") bucket.resolved += 1;
          if (!(t as any).sla_breached_at) bucket.onTrack += 1;
          byCategory.set(name, bucket);
        }
        setCategoryRows(
          Array.from(byCategory.entries()).map(([category_name, s]) => ({
            category_name,
            total: s.total,
            resolved: s.resolved,
            onTrackPct: s.total > 0 ? Math.round((s.onTrack / s.total) * 100) : 0,
          }))
        );

        setAmenityBookingsTotal((bookings || []).length);
        setAmenityBookingsCancelled((bookings || []).filter((b: any) => b.status === "cancelled").length);
      } catch (err: any) {
        setLoadError(err?.message || "Failed to load report data.");
      }
      setIsLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="Facility & Operational Reports"
        subtitle="Ticket volume and SLA performance by category, and amenity booking activity"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Facility Manager" }, { label: "Reports" }]}
      />

      <div className="card" style={{ marginBottom: "1.75rem" }}>
        <div className="card-header">
          <h3 className="card-title">Service Tickets by Category</h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Total Tickets</th>
                <th>Resolved / Closed</th>
                <th>SLA On-Track %</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading…
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--danger, #dc2626)" }}>
                    {loadError}
                  </td>
                </tr>
              ) : categoryRows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No tickets recorded yet.
                  </td>
                </tr>
              ) : (
                categoryRows.map((row) => (
                  <tr key={row.category_name}>
                    <td style={{ fontWeight: 600 }}>{row.category_name}</td>
                    <td>{row.total} Tickets</td>
                    <td>{row.resolved} Resolved</td>
                    <td style={{ color: row.onTrackPct >= 90 ? "var(--success)" : "var(--warning)", fontWeight: 600 }}>
                      {row.onTrackPct}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Amenity Booking Activity</h3>
        </div>
        {isLoading ? (
          <p style={{ padding: "1rem", color: "var(--muted)" }}>Loading…</p>
        ) : (
          <div style={{ padding: "0.5rem 1rem 1rem", display: "flex", gap: "2rem", fontSize: "0.875rem" }}>
            <div>
              <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Total Bookings</div>
              <div style={{ fontWeight: 700, fontSize: "1.25rem" }}>{amenityBookingsTotal}</div>
            </div>
            <div>
              <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Cancelled</div>
              <div style={{ fontWeight: 700, fontSize: "1.25rem" }}>{amenityBookingsCancelled}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
