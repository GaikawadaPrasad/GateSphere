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
    const data = await deliveriesApi.list();
    setDeliveries(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredDeliveries = deliveries.filter((d) => {
    const matchSearch =
      d.company.toLowerCase().includes(search.toLowerCase()) ||
      d.courier.toLowerCase().includes(search.toLowerCase()) ||
      d.unit.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || d.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div>
      <PageHeader
        title="Delivery Management & Protocol Oversight"
        subtitle="Monitor commercial delivery gate activity, courier verification, and resident delivery protocol decisions"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Supervisor" }, { label: "Delivery Management" }]}
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
            <div style={{ width: 220 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search courier/company/unit…" />
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
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
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
