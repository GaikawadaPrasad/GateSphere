"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { deliveriesApi } from "@/lib/api";

export default function SecuritySupervisorDeliveryManagementPage() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await deliveriesApi.list();
      setDeliveries(
        (data || []).map((d: any) => ({
          id: d.id,
          gate_time: d.arrived_at
            ? new Date(d.arrived_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "Expected",
          company: d.provider_name || "Commercial Courier",
          courier:
            d.executive_name ||
            (d.executive_phone ? `Phone: ${d.executive_phone}` : "Courier Executive"),
          category: d.delivery_type
            ? d.delivery_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
            : "Package",
          unit: `Unit ${d.unit_id ? d.unit_id.slice(0, 6) : "Direct"}`,
          protocol: d.approval_status
            ? d.approval_status.replace(/_/g, " ").toUpperCase()
            : "STANDARD",
          status: d.status
            ? d.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
            : "Expected",
        })),
      );
    } catch {
      // fallback
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredDeliveries = deliveries.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      (d.company && d.company.toLowerCase().includes(q)) ||
      (d.courier && d.courier.toLowerCase().includes(q)) ||
      (d.unit && d.unit.toLowerCase().includes(q));
    const matchCategory =
      categoryFilter === "all" || (d.category && d.category.toLowerCase().includes(categoryFilter.toLowerCase()));
    return matchSearch && matchCategory;
  });

  return (
    <div>
      <PageHeader
        title="Delivery Management & Protocol Oversight"
        subtitle="Monitor commercial delivery gate activity, courier verification, and resident delivery protocol decisions"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Delivery Management" },
        ]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Delivery Gate Logs</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredDeliveries.length} deliveries logged today
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: "100%", maxWidth: 220 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search courier/company/unit…"
              />
            </div>

            <select
              className="select-field"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Categories</option>
              <option value="Food">Food (Swiggy/Zomato)</option>
              <option value="Grocery">Grocery (Blinkit/Zepto)</option>
              <option value="E-commerce">E-commerce (Amazon/Flipkart)</option>
              <option value="Courier">Courier (FedEx/DHL)</option>
              <option value="Pharmacy">Pharmacy</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Company / Platform</th>
                <th>Courier Name</th>
                <th>Category</th>
                <th>Destination Unit</th>
                <th>Protocol Decision</th>
                <th>Gate Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading delivery logs…
                  </td>
                </tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No delivery records found.
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((d) => (
                  <tr key={d.id}>
                    <td>{d.gate_time}</td>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{d.company}</td>
                    <td>{d.courier}</td>
                    <td>{d.category}</td>
                    <td>{d.unit}</td>
                    <td>
                      <StatusBadge status={d.protocol} />
                    </td>
                    <td>
                      <StatusBadge status={d.status} />
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
