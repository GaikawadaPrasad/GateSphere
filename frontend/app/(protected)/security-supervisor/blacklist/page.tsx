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

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleRemove = async (id: string, nameLabel: string) => {
    if (!window.confirm(`Are you sure you want to remove "${nameLabel}" from the security blacklist?`)) {
      return;
    }
    setIsDeleting(id);
    try {
      await blacklistApi.remove(id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to remove from blacklist.");
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredBlacklist = blacklist.filter((b) => {
    const q = search.toLowerCase();
    const nameStr = (b.name || "").toLowerCase();
    const phoneStr = (b.phone || "").toLowerCase();
    const vehicleStr = (b.vehicle_number || "").toLowerCase();
    const reasonStr = (b.reason || "").toLowerCase();
    return (
      !search ||
      nameStr.includes(q) ||
      phoneStr.includes(q) ||
      vehicleStr.includes(q) ||
      reasonStr.includes(q)
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

          <div style={{ width: "100%", maxWidth: 240 }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name/phone/reason…"
            />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Blacklisted Entity / Person</th>
                <th>Phone Number</th>
                <th>Risk Level</th>
                <th>Reason for Restriction</th>
                <th>Date Added</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading blacklist records…
                  </td>
                </tr>
              ) : filteredBlacklist.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No blacklist records found.
                  </td>
                </tr>
              ) : (
                filteredBlacklist.map((b) => {
                  const displayName =
                    b.name ||
                    (b.reason && b.reason.includes(":") ? b.reason.split(":")[0] : null) ||
                    "Restricted Visitor";
                  const displayPhone = b.phone || (b.phone_hash ? `Hash: ${String(b.phone_hash).slice(0, 8)}…` : "—");
                  const displayDate = b.date_added || (b.created_at ? new Date(b.created_at).toLocaleDateString() : "Active");
                  const statusStr = b.status || (b.is_active !== false ? "Active" : "Inactive");
                  const riskLevel = b.risk_level || "high";

                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600, color: "var(--danger)" }}>🚫 {displayName}</td>
                      <td>{displayPhone}</td>
                      <td>
                        <StatusBadge status={riskLevel} />
                      </td>
                      <td style={{ maxWidth: 260 }}>{b.reason || "Security restriction"}</td>
                      <td>{displayDate}</td>
                      <td>
                        <StatusBadge status={statusStr} />
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "var(--danger)" }}
                          onClick={() => handleRemove(b.id, displayName)}
                          disabled={isDeleting === b.id}
                        >
                          {isDeleting === b.id ? "Removing…" : "Remove"}
                        </button>
                      </td>
                    </tr>
                  );
                })
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
