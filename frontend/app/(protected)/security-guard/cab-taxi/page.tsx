"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";

export default function SecurityGuardCabTaxiPage() {
  const [cabs, setCabs] = useState([
    { id: "cab-1", service: "Uber Go", vehicle: "KA-03-AB-9988", passenger: "Dr. Vikram Seth", unit: "Tower A 1102", status: "Entry Approved", time: "10:15" },
    { id: "cab-2", service: "Ola Sedan", vehicle: "KA-01-MJ-1234", passenger: "Priya Sharma", unit: "Tower B 401", status: "Expected", time: "10:30" },
  ]);
  const [search, setSearch] = useState("");

  const handleAllowEntry = (id: string) => {
    setCabs((prev) => prev.map((c) => (c.id === id ? { ...c, status: "Entry Approved" } : c)));
  };

  const handleMarkExit = (id: string) => {
    setCabs((prev) => prev.map((c) => (c.id === id ? { ...c, status: "Exited" } : c)));
  };

  const filteredCabs = cabs.filter(
    (c) =>
      c.vehicle.toLowerCase().includes(search.toLowerCase()) ||
      c.passenger.toLowerCase().includes(search.toLowerCase()) ||
      c.unit.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Cab & Taxi Verification"
        subtitle="Verify cab arrivals, match resident passenger bookings, and log vehicle gate exit timestamps"
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
                <th>Service Provider</th>
                <th>Vehicle Plate #</th>
                <th>Passenger Resident</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCabs.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>🚖 {c.service}</td>
                  <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{c.vehicle}</td>
                  <td>{c.passenger}</td>
                  <td>{c.unit}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>
                    {c.status === "Expected" ? (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                        onClick={() => handleAllowEntry(c.id)}
                      >
                        Allow Entry
                      </button>
                    ) : c.status === "Entry Approved" ? (
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                        onClick={() => handleMarkExit(c.id)}
                      >
                        Mark Exit
                      </button>
                    ) : (
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
