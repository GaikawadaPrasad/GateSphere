"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { blacklistApi, type BlacklistEntry } from "@/lib/api";

export default function SecuritySupervisorBlacklistPage() {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Add Blacklist Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [reason, setReason] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    const data = await blacklistApi.list();
    setBlacklist(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !reason.trim()) return;
    try {
      await blacklistApi.add({
        phone: phone.trim(),
        reason: `${name.trim() ? name.trim() + ": " : ""}${reason.trim()}${vehicleNumber ? " (Vehicle: " + vehicleNumber + ")" : ""}`,
        risk_level: "high",
      });
      setIsAddModalOpen(false);
      setName("");
      setPhone("");
      setVehicleNumber("");
      setReason("");
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to add to blacklist.");
    }
  };

  const filteredBlacklist = blacklist.filter((b) => {
    return (
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.phone && b.phone.includes(search)) ||
      (b.vehicle_number && b.vehicle_number.toLowerCase().includes(search.toLowerCase()))
    );
  });

  return (
    <div>
      <PageHeader
        title="Blacklist Registry & Restricted Entry"
        subtitle="Manage authorized security blacklist entries, monitor blocked entry attempts, and edit restriction reasons"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Blacklist" },
        ]}
        actions={
          <button className="btn btn-danger" onClick={() => setIsAddModalOpen(true)}>
            🚫 Add to Blacklist
          </button>
        }
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Restricted Entry Registry</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredBlacklist.length} active blacklist entries
            </p>
          </div>

          <div style={{ width: "100%", maxWidth: 220 }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name/phone/plate…"
            />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Blacklisted Entity / Person</th>
                <th>Phone Number</th>
                <th>Vehicle Plate #</th>
                <th>Reason for Restriction</th>
                <th>Added By</th>
                <th>Date Added</th>
                <th>Attempted Entries</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading blacklist records…
                  </td>
                </tr>
              ) : filteredBlacklist.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No blacklist records found.
                  </td>
                </tr>
              ) : (
                filteredBlacklist.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600, color: "var(--danger)" }}>🚫 {b.name}</td>
                    <td>{b.phone || "—"}</td>
                    <td style={{ fontFamily: "monospace" }}>{b.vehicle_number || "—"}</td>
                    <td style={{ maxWidth: 240 }}>{b.reason}</td>
                    <td>{b.added_by}</td>
                    <td>{b.date_added}</td>
                    <td style={{ fontWeight: 600, color: "var(--danger)" }}>
                      {b.attempts_count} attempts
                    </td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Blacklist Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="🚫 Create Security Blacklist Entry"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleAddBlacklist}>
              Confirm Blacklist Entry
            </button>
          </>
        }
      >
        <form onSubmit={handleAddBlacklist}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Full Name / Identifier *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  marginBottom: "0.35rem",
                }}
              >
                Phone Number
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="+91 98000 00000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  marginBottom: "0.35rem",
                }}
              >
                Vehicle Plate Number
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. KA-02-Z-9999"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Detailed Security Reason *
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Explain security violation or reason for restriction..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
