"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { residentsApi } from "@/lib/api";
import { useCommunities, useCommunityUnits } from "@/hooks/use-communities";
import { useAddResident } from "@/hooks/use-residents";
import type { ResidentProfile } from "@/types/residents";
import type { Community } from "@/types/communities";

export default function ResidentsPage() {
  const [search, setSearch] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Add Resident Modal State
  const [isAddResidentOpen, setIsAddResidentOpen] = useState(false);
  const [targetCommunityId, setTargetCommunityId] = useState("");
  const [targetUnitId, setTargetUnitId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [occupancyRole, setOccupancyRole] = useState("primary_owner");
  const [isPrimary, setIsPrimary] = useState(true);
  const [agreementRef, setAgreementRef] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: communities } = useCommunities();
  const { data: communityUnits } = useCommunityUnits(targetCommunityId || undefined);
  const addResidentMutation = useAddResident();

  const { data: residents, isLoading, refetch } = useQuery({
    queryKey: ["residents", "list", { page, page_size: pageSize, community_id: communityId }],
    queryFn: () =>
      residentsApi.list({ page, page_size: pageSize, community_id: communityId || undefined }),
  });

  const resetForm = () => {
    const defaultComm = communities?.[0]?.id || "";
    setTargetCommunityId(defaultComm);
    setTargetUnitId("");
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setOccupancyRole("primary_owner");
    setIsPrimary(true);
    setAgreementRef("");
    setFormError("");
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsAddResidentOpen(true);
  };

  const handleAddResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCommunityId) {
      setFormError("Please select a community.");
      return;
    }
    if (!targetUnitId) {
      setFormError("Please select a residential unit.");
      return;
    }
    if (!fullName.trim() || !email.trim()) {
      setFormError("Full name and email are required.");
      return;
    }

    setFormError("");
    setIsSubmitting(true);
    try {
      await addResidentMutation.mutateAsync({
        communityId: targetCommunityId,
        data: {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          password: password.trim() || undefined,
          unit_id: targetUnitId,
          occupancy_role: occupancyRole,
          is_primary: isPrimary,
          agreement_reference: agreementRef.trim() || undefined,
        },
      });
      setIsAddResidentOpen(false);
      refetch();
    } catch (err: any) {
      setFormError(err?.message || "Failed to onboard resident.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<ResidentProfile>[] = [
    {
      key: "full_name",
      header: "Resident Name",
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--fg)" }}>{r.full_name}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {r.email || r.phone || "No contact"}
          </div>
        </div>
      ),
    },
    {
      key: "resident_type",
      header: "Role / Type",
      align: "center",
      render: (r) => (
        <span className="badge badge-primary" style={{ textTransform: "capitalize" }}>
          {r.resident_type?.replace(/_/g, " ") || "Resident"}
        </span>
      ),
    },
    {
      key: "unit_number",
      header: "Unit / Tower",
      align: "center",
      render: (r) => <span>{r.unit_number ? `Unit ${r.unit_number}` : "–"}</span>,
    },
    {
      key: "primary_occupant",
      header: "Primary Occupant",
      align: "center",
      render: (r) => <span>{r.primary_occupant || (r as any).is_primary ? "✅ Yes" : "No"}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (r) => <StatusBadge status={r.status || (r as any).profile_status || "active"} />,
    },
  ];

  const filteredResidents = residents?.filter((r) => {
    const term = search.toLowerCase();
    return (
      !search ||
      r.full_name?.toLowerCase().includes(term) ||
      r.email?.toLowerCase().includes(term) ||
      r.unit_number?.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <PageHeader
        title="Global Residents Directory"
        subtitle="View registered owners, tenants, and family occupants across communities"
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Residents" },
        ]}
        action={
          <button type="button" className="btn btn-primary" onClick={handleOpenAddModal}>
            👤 + Add Resident
          </button>
        }
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Resident Profiles</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredResidents?.length || 0} residents listed
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: 240 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search name or unit…" />
            </div>

            <select
              className="select-field"
              value={communityId}
              onChange={(e) => {
                setCommunityId(e.target.value);
                setPage(1);
              }}
              style={{ width: "auto", height: 36, padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
            >
              <option value="">All Communities</option>
              {communities?.map((c: Community) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredResidents}
          isLoading={isLoading}
          page={page}
          pageSize={pageSize}
          total={filteredResidents?.length || 0}
          onPageChange={setPage}
          emptyTitle="No residents found"
          emptyDescription="There are no resident records matching your query."
        />
      </div>

      {/* Add Resident Modal */}
      <Modal
        isOpen={isAddResidentOpen}
        onClose={() => setIsAddResidentOpen(false)}
        title="👤 Onboard New Resident"
      >
        <form onSubmit={handleAddResidentSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {formError && (
              <div
                style={{
                  padding: "0.6rem 0.8rem",
                  background: "#fee2e2",
                  border: "1px solid #f87171",
                  borderRadius: "6px",
                  color: "#b91c1c",
                  fontSize: "0.85rem",
                }}
              >
                {formError}
              </div>
            )}

            {/* Community Selection */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                Community <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                className="input"
                value={targetCommunityId}
                onChange={(e) => {
                  setTargetCommunityId(e.target.value);
                  setTargetUnitId("");
                }}
                required
                style={{ width: "100%" }}
              >
                <option value="">Select Community...</option>
                {communities?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Selection */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                Target Unit <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                className="input"
                value={targetUnitId}
                onChange={(e) => setTargetUnitId(e.target.value)}
                required
                disabled={!targetCommunityId}
                style={{ width: "100%" }}
              >
                <option value="">Select Unit...</option>
                {communityUnits && communityUnits.length > 0 ? (
                  communityUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unit_number} {u.unit_type ? `(${u.unit_type})` : ""} {u.sq_ft ? `• ${u.sq_ft} sqft` : ""}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    {targetCommunityId ? "No units created yet for this community" : "Select a community first"}
                  </option>
                )}
              </select>
            </div>

            {/* Name & Email */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Full Name <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Email Address <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rahul@example.com"
                  required
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Phone & Password */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Initial Password (Optional)
                </label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Auto-generated if empty"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Occupancy Role & Primary Status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", alignItems: "center" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Occupancy Role
                </label>
                <select
                  className="input"
                  value={occupancyRole}
                  onChange={(e) => setOccupancyRole(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="primary_owner">Primary Owner</option>
                  <option value="secondary_owner">Secondary Owner / Co-Owner</option>
                  <option value="tenant">Tenant / Renter</option>
                  <option value="family">Family Member</option>
                  <option value="occupant">Occupant</option>
                </select>
              </div>
              <div style={{ paddingTop: "1.2rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                  />
                  <span>Primary Unit Contact</span>
                </label>
              </div>
            </div>

            {/* Agreement Reference */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                Agreement Reference (Optional)
              </label>
              <input
                type="text"
                className="input"
                value={agreementRef}
                onChange={(e) => setAgreementRef(e.target.value)}
                placeholder="e.g. LEASE-2026-081"
                style={{ width: "100%" }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAddResidentOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || !targetCommunityId || !targetUnitId}
              >
                {isSubmitting ? "Onboarding..." : "👤 Register Resident"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
