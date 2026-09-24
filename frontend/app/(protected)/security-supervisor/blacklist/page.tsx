"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { blacklistApi, type BlacklistEntry } from "@/lib/api";
import { isValidPersonName } from "@/lib/utils";
import { toast } from "@/store/toast";

export default function SecuritySupervisorBlacklistPage() {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Add Blacklist Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [idType, setIdType] = useState("aadhaar");
  const [idNumber, setIdNumber] = useState("");
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

  const [blacklistFieldErrors, setBlacklistFieldErrors] = useState<Record<string, string>>({});

  const handleAddBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanId = idNumber.trim().toUpperCase();
    const cleanVehicle = vehicleNumber.trim().toUpperCase();
    const errors: Record<string, string> = {};

    if (cleanName) {
      if (cleanName.length < 2 || !isValidPersonName(cleanName)) {
        errors.name = "Name must contain only alphabetic letters and spaces (min 2 characters).";
      }
    }
    if (!cleanPhone && !cleanId && !cleanVehicle) {
      errors.phone =
        "Provide either a mobile number, Government ID, or Vehicle Plate to blacklist.";
      errors.idNumber =
        "Provide either a mobile number, Government ID, or Vehicle Plate to blacklist.";
    }
    if (cleanPhone) {
      const phoneDigits = cleanPhone.replace(/\D/g, "");
      if (!/^\+?[0-9\s\-()]{7,20}$/.test(cleanPhone) || phoneDigits.length < 10) {
        errors.phone = "Please enter a valid phone number (at least 10 digits).";
      }
    }
    if (cleanVehicle) {
      const cleanVehicleNoSpaces = cleanVehicle.replace(/[\s\-]/g, "");
      if (!/^[A-Z0-9]{4,15}$/.test(cleanVehicleNoSpaces)) {
        errors.vehicleNumber = "Vehicle plate must be 4-15 alphanumeric characters.";
      }
    }
    if (!reason.trim() || reason.trim().length < 5) {
      errors.reason = "Please provide a detailed restriction reason (min 5 characters).";
    }

    if (Object.keys(errors).length > 0) {
      setBlacklistFieldErrors(errors);
      toast.error("Please resolve the highlighted form errors.");
      return;
    }

    try {
      let formattedPhone: string | undefined = undefined;
      if (cleanPhone) {
        const stripped = cleanPhone.replace(/[\s\-()]/g, "");
        formattedPhone = stripped.startsWith("+")
          ? stripped
          : stripped.length === 10
            ? `+91${stripped}`
            : `+${stripped}`;
      }

      await blacklistApi.add({
        phone: formattedPhone,
        // `id_type` has no backing column on the backend (BlacklistCreate has no such field
        // and write bodies are extra="forbid", so sending it 422s the whole request) — the ID
        // type is already embedded in `reason` below for the human-readable audit trail, and
        // the raw id_number is still sent/hashed server-side (GS-BUG-038).
        id_number: cleanId || undefined,
        vehicle_number: cleanVehicle || undefined,
        reason: `${cleanName ? cleanName + ": " : ""}${reason.trim()}${cleanId ? ` [${idType.toUpperCase()}: ${cleanId}]` : ""}${cleanVehicle ? " (Vehicle: " + cleanVehicle + ")" : ""}`,
        risk_level: "high",
      });
      toast.success("Security blacklist entry added successfully.");
      setIsAddModalOpen(false);
      setBlacklistFieldErrors({});
      setName("");
      setPhone("");
      setIdType("aadhaar");
      setIdNumber("");
      setVehicleNumber("");
      setReason("");
      loadData();
    } catch (err: any) {
      const errMsg = err?.message || "Failed to add to blacklist.";
      toast.error(errMsg);
    }
  };

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleRemove = async (id: string, nameLabel: string) => {
    if (
      !window.confirm(`Are you sure you want to remove "${nameLabel}" from the security blacklist?`)
    ) {
      return;
    }
    setIsDeleting(id);
    try {
      await blacklistApi.remove(id);
      toast.success(`"${nameLabel}" removed from the security blacklist.`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove from blacklist.");
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredBlacklist = blacklist.filter((b) => {
    const q = search.toLowerCase();
    const nameStr = (b.name || "").toLowerCase();
    const phoneStr = (b.phone || "").toLowerCase();
    const idStr = (b.id_number || "").toLowerCase();
    const vehicleStr = (b.vehicle_number || "").toLowerCase();
    const reasonStr = (b.reason || "").toLowerCase();
    return (
      !search ||
      nameStr.includes(q) ||
      phoneStr.includes(q) ||
      idStr.includes(q) ||
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
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={loadData} disabled={isLoading}>
              🔄 {isLoading ? "Refreshing…" : "Refresh"}
            </button>
            <button className="btn btn-danger" onClick={() => setIsAddModalOpen(true)}>
              🚫 Add to Blacklist
            </button>
          </div>
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
              placeholder="Search name/phone/ID/reason…"
            />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Blacklisted Entity / Person</th>
                <th>Phone Number</th>
                <th>Govt ID / Identifier</th>
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
                filteredBlacklist.map((b) => {
                  const displayName =
                    b.name ||
                    (b.reason && b.reason.includes(":") ? b.reason.split(":")[0] : null) ||
                    "Restricted Visitor";
                  const displayPhone =
                    b.phone || (b.phone_hash ? `Hash: ${String(b.phone_hash).slice(0, 8)}…` : "—");
                  const displayDate =
                    b.date_added ||
                    (b.created_at ? new Date(b.created_at).toLocaleDateString() : "Active");
                  const statusStr = b.status || (b.is_active !== false ? "Active" : "Inactive");
                  const riskLevel = b.risk_level || "high";

                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600, color: "var(--danger)" }}>🚫 {displayName}</td>
                      <td>{displayPhone}</td>
                      <td>
                        {b.id_number ? (
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              color: "#991b1b",
                              background: "#fee2e2",
                              padding: "0.15rem 0.45rem",
                              borderRadius: "4px",
                            }}
                          >
                            {b.id_type ? `${b.id_type.toUpperCase()}: ` : ""}
                            {b.id_number}
                          </span>
                        ) : b.id_number_hash ? (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--muted)",
                              fontFamily: "monospace",
                            }}
                          >
                            ID Hash: {b.id_number_hash.slice(0, 8)}…
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>—</span>
                        )}
                      </td>
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
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.2rem 0.5rem",
                            color: "var(--danger)",
                          }}
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
              Full Name / Identifier
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (blacklistFieldErrors.name) {
                  setBlacklistFieldErrors((prev) => ({ ...prev, name: "" }));
                }
              }}
            />
            {blacklistFieldErrors.name && (
              <span
                style={{
                  color: "var(--danger, #ef4444)",
                  fontSize: "0.75rem",
                  display: "block",
                  marginTop: "0.25rem",
                }}
              >
                {blacklistFieldErrors.name}
              </span>
            )}
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
                type="tel"
                className="input-field"
                placeholder="e.g. +91 98000 00000"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (blacklistFieldErrors.phone) {
                    setBlacklistFieldErrors((prev) => ({ ...prev, phone: "" }));
                  }
                }}
              />
              {blacklistFieldErrors.phone && (
                <span
                  style={{
                    color: "var(--danger, #ef4444)",
                    fontSize: "0.75rem",
                    display: "block",
                    marginTop: "0.25rem",
                  }}
                >
                  {blacklistFieldErrors.phone}
                </span>
              )}
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
                Vehicle Plate Number (Optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. KA-02-Z-9999"
                value={vehicleNumber}
                onChange={(e) => {
                  setVehicleNumber(e.target.value);
                  if (blacklistFieldErrors.vehicleNumber) {
                    setBlacklistFieldErrors((prev) => ({ ...prev, vehicleNumber: "" }));
                  }
                }}
              />
              {blacklistFieldErrors.vehicleNumber && (
                <span
                  style={{
                    color: "var(--danger, #ef4444)",
                    fontSize: "0.75rem",
                    display: "block",
                    marginTop: "0.25rem",
                  }}
                >
                  {blacklistFieldErrors.vehicleNumber}
                </span>
              )}
            </div>
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
                Govt ID Type
              </label>
              <select
                className="input-field"
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
              >
                <option value="aadhaar">Aadhaar Card (12 digits)</option>
                <option value="pan">PAN Card (10 chars)</option>
                <option value="voter_id">Voter ID</option>
                <option value="driving_license">Driving License</option>
                <option value="passport">Passport</option>
                <option value="other">Other Government ID</option>
              </select>
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
                Govt ID Number
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 1234 5678 9012 or ABCDE1234F"
                value={idNumber}
                onChange={(e) => {
                  setIdNumber(e.target.value.toUpperCase());
                  if (blacklistFieldErrors.idNumber) {
                    setBlacklistFieldErrors((prev) => ({ ...prev, idNumber: "" }));
                  }
                }}
              />
              {blacklistFieldErrors.idNumber && (
                <span
                  style={{
                    color: "var(--danger, #ef4444)",
                    fontSize: "0.75rem",
                    display: "block",
                    marginTop: "0.25rem",
                  }}
                >
                  {blacklistFieldErrors.idNumber}
                </span>
              )}
            </div>
          </div>

          <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "1rem" }}>
            💡 Provide at least Mobile Number or Government ID (Aadhaar / PAN / Voter ID / DL /
            Passport) to restrict gate entry.
          </p>

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
              onChange={(e) => {
                setReason(e.target.value);
                if (blacklistFieldErrors.reason) {
                  setBlacklistFieldErrors((prev) => ({ ...prev, reason: "" }));
                }
              }}
              required
            />
            {blacklistFieldErrors.reason && (
              <span
                style={{
                  color: "var(--danger, #ef4444)",
                  fontSize: "0.75rem",
                  display: "block",
                  marginTop: "0.25rem",
                }}
              >
                {blacklistFieldErrors.reason}
              </span>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
