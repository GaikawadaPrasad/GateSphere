"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { deliveriesApi } from "@/lib/api";

export default function SecurityGuardDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [search, setSearch] = useState("");
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

  const handleDecision = (id: string, newStatus: string) => {
    setDeliveries((prev) => prev.map((d) => (d.id === id ? { ...d, status: newStatus } : d)));
  };

  const filteredDeliveries = deliveries.filter((d) => {
    return (
      d.company.toLowerCase().includes(search.toLowerCase()) ||
      d.courier.toLowerCase().includes(search.toLowerCase()) ||
      d.unit.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div>
      <PageHeader
        title="Delivery Verification & Gate Decision"
        subtitle="Verify courier platform, check resident delivery protocol, and record final gate decision"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Guard" }, { label: "Deliveries" }]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Delivery Desk Queue</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredDeliveries.length} deliveries
            </p>
          </div>

          <div style={{ width: 220 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search courier/company/unit…" />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Courier Name</th>
                <th>Category</th>
                <th>Destination Unit</th>
                <th>Resident Protocol</th>
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
              ) : (
                filteredDeliveries.map((d) => (
                  <tr key={d.id}>
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
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {d.protocol === "Allow at Gate" && (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => handleDecision(d.id, "Handed Over")}
                          >
                            Mark Handed Over
                          </button>
                        )}
                        {d.protocol === "Leave at Gate Desk" && (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => handleDecision(d.id, "Desk Left")}
                          >
                            Mark Left at Desk
                          </button>
                        )}
                        {d.protocol === "Resident Approval Required" && (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => handleDecision(d.id, "Pending Approval")}
                          >
                            Request Approval
                          </button>
                        )}
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                          onClick={() => handleDecision(d.id, "Rejected")}
                        >
                          Reject
                        </button>
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
