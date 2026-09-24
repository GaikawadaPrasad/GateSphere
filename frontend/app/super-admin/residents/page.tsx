"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { residentsApi } from "@/lib/api";
import { useCommunities, useCommunityUnits, useTowers } from "@/hooks/use-communities";
import { useAddResident, useDeleteResident } from "@/hooks/use-residents";
import type { ResidentProfile } from "@/types/residents";
import type { Community } from "@/types/communities";
import { PasswordField } from "@/components/forms/PasswordField";
import { generateInitialPassword } from "@/lib/utils";
import { toast } from "@/store/toast";
import { useUiStore } from "@/store/ui";
import { ScopeBanner } from "@/components/common/ScopeBanner";
import { isValidPersonName } from "@/constants/locations";

export default function ResidentsPage() {
  const { activeCommunityId, setActiveCommunity } = useUiStore();
  const [search, setSearch] = useState("");
  const [communityId, setCommunityId] = useState(activeCommunityId || "");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setCommunityId(activeCommunityId || "");
    setPage(1);
  }, [activeCommunityId]);

  // Add Resident Modal State
  const [isAddResidentOpen, setIsAddResidentOpen] = useState(false);
  const [targetCommunityId, setTargetCommunityId] = useState("");
  const [targetTowerId, setTargetTowerId] = useState("");
  const [targetUnitId, setTargetUnitId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [occupancyRole, setOccupancyRole] = useState("primary_owner");
  const [isPrimary, setIsPrimary] = useState(true);
  const [agreementRef, setAgreementRef] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: communities } = useCommunities();
  const { data: targetTowers } = useTowers(targetCommunityId || undefined);
  const { data: communityUnits } = useCommunityUnits(targetCommunityId || undefined);
  const addResidentMutation = useAddResident();
  const deleteResidentMutation = useDeleteResident();

  // Delete Resident State
  const [residentToDelete, setResidentToDelete] = useState<ResidentProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const filteredUnits = useMemo(() => {
    if (!communityUnits) return [];
    if (!targetTowerId) return communityUnits;
    return communityUnits.filter((u) => u.tower_id === targetTowerId);
  }, [communityUnits, targetTowerId]);

  const {
    data: residents,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["residents", "list", { page, page_size: pageSize, community_id: communityId }],
    queryFn: () =>
      residentsApi.list({ page, page_size: pageSize, community_id: communityId || undefined }),
  });

  const resetForm = () => {
    const defaultComm = communityId || communities?.[0]?.id || "";
    setTargetCommunityId(defaultComm);
    setTargetTowerId("");
    setTargetUnitId("");
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("resident@Gate2026!");
    setOccupancyRole("primary_owner");
    setIsPrimary(true);
    setAgreementRef("");
    setFormError("");
    setFieldErrors({});
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsAddResidentOpen(true);
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!targetCommunityId) {
      errs.targetCommunityId = "Please select a community.";
    }
    if (!targetUnitId) {
      errs.targetUnitId = "Please select a residential unit.";
    }
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      errs.fullName = "Resident full name is required (min 2 characters).";
    } else if (!isValidPersonName(trimmedName)) {
      errs.fullName = "Resident name must contain only alphabets and spaces.";
    }
    if (!email.trim()) {
      errs.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address (e.g. resident@example.com).";
    }
    if (phone.trim()) {
      const phoneDigits = phone.replace(/\D/g, "");
      if (
        phoneDigits.length < 7 ||
        phoneDigits.length > 15 ||
        !/^\+?[0-9\s\-()]+$/.test(phone.trim())
      ) {
        errs.phone = "Enter a valid phone number (7-15 digits, plus optional country code).";
      }
    }
    if (password.trim() && password.trim().length < 10) {
      errs.password = "Initial password must be at least 10 characters.";
    }
    const trimmedAgreement = agreementRef.trim();
    if (occupancyRole === "tenant" && !trimmedAgreement) {
      errs.agreementRef = "Agreement reference is required for tenants.";
    } else if (trimmedAgreement) {
      if (trimmedAgreement.length < 3 || trimmedAgreement.length > 50) {
        errs.agreementRef = "Agreement reference must be between 3 and 50 characters.";
      } else if (!/^[A-Z0-9\-_/]+$/.test(trimmedAgreement)) {
        errs.agreementRef =
          "Agreement reference must be uppercase letters, numbers, and allowed symbols (e.g. LEASE-2026-081).";
      }
    }
    setFieldErrors(errs);
    return errs;
  };

  const isSubmittingRef = useRef(false);

  const handleAddResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setFormError("Please fill in all required fields marked below.");
      const firstKey = Object.keys(errs)[0];
      const el = document.getElementById(`resident-form-${firstKey}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
      return;
    }

    setFormError("");
    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      await addResidentMutation.mutateAsync({
        communityId: targetCommunityId,
        data: {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          password: password.trim() || generateInitialPassword(fullName, "resident"),
          unit_id: targetUnitId,
          occupancy_role: occupancyRole,
          is_primary: isPrimary,
          agreement_reference: agreementRef.trim() || undefined,
        },
      });
      toast.success(`Resident "${fullName.trim()}" onboarded successfully!`, "Resident Registered");
      setIsAddResidentOpen(false);
      resetForm();
      await refetch();
    } catch (err: any) {
      setFormError(err?.message || "Failed to onboard resident.");
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handleDeleteResident = async () => {
    if (!residentToDelete) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteResidentMutation.mutateAsync(residentToDelete.id);
      toast.success(
        `Deleted resident profile for ${residentToDelete.full_name}.`,
        "Resident Deleted",
      );
      setResidentToDelete(null);
      await refetch();
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete resident profile.");
    } finally {
      setIsDeleting(false);
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
    {
      key: "actions",
      header: "Action",
      align: "center",
      render: (r) => (
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn btn-danger"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}
            onClick={(e) => {
              e.stopPropagation();
              setResidentToDelete(r);
              setDeleteError("");
            }}
            title="Delete Resident Profile"
          >
            🗑️ Delete
          </button>
        </div>
      ),
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
        subtitle={
          activeCommunityId
            ? "Viewing registered residents for selected community"
            : "View registered owners, tenants, and family occupants across communities"
        }
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

      {/* Active Scope Banner */}
      <ScopeBanner
        entityName="residents"
        onClear={() => {
          setCommunityId("");
          setPage(1);
        }}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Resident Profiles</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {isLoading
                ? "Loading residents…"
                : `${filteredResidents?.length || 0} residents listed`}
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
                const newCommId = e.target.value;
                setCommunityId(newCommId);
                setActiveCommunity(newCommId || null);
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
        maxWidth={640}
      >
        <form onSubmit={handleAddResidentSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Header Subtitle */}
            <p style={{ margin: 0, fontSize: "0.825rem", color: "#64748b" }}>
              Assign residential unit occupancy, resident contact credentials, and portal
              permissions.
            </p>

            {formError && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  color: "#991b1b",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span>⚠️</span>
                <span>{formError}</span>
              </div>
            )}

            {/* SECTION 1: COMMUNITY & UNIT ALLOCATION */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontWeight: 600,
                  fontSize: "0.825rem",
                  color: "#334155",
                }}
              >
                <span>🏢</span> Property, Tower &amp; Unit Allocation
              </div>

              {/* Community Selection */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.775rem",
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: "0.35rem",
                  }}
                >
                  Community <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  id="resident-form-targetCommunityId"
                  className="input-field"
                  value={targetCommunityId}
                  onChange={(e) => {
                    setTargetCommunityId(e.target.value);
                    setTargetTowerId("");
                    setTargetUnitId("");
                    if (fieldErrors.targetCommunityId) {
                      setFieldErrors((prev) => ({ ...prev, targetCommunityId: "" }));
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.85rem",
                    borderRadius: "6px",
                    border: `1px solid ${fieldErrors.targetCommunityId ? "#dc2626" : "#cbd5e1"}`,
                    backgroundColor: "#ffffff",
                  }}
                >
                  <option value="">Select Community...</option>
                  {communities?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
                {fieldErrors.targetCommunityId && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#dc2626",
                      marginTop: "0.25rem",
                      display: "block",
                    }}
                  >
                    {fieldErrors.targetCommunityId}
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                {/* Tower Selection */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.775rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Tower / Block
                  </label>
                  <select
                    className="input-field"
                    value={targetTowerId}
                    onChange={(e) => {
                      setTargetTowerId(e.target.value);
                      setTargetUnitId("");
                    }}
                    disabled={!targetCommunityId}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="">All Towers ({targetTowers?.length || 0})</option>
                    {targetTowers?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code || `${t.total_floors} fl`})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unit Selection */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.775rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Residential Unit <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    id="resident-form-targetUnitId"
                    className="input-field"
                    value={targetUnitId}
                    onChange={(e) => {
                      setTargetUnitId(e.target.value);
                      if (fieldErrors.targetUnitId) {
                        setFieldErrors((prev) => ({ ...prev, targetUnitId: "" }));
                      }
                    }}
                    disabled={!targetCommunityId}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: `1px solid ${fieldErrors.targetUnitId ? "#dc2626" : "#cbd5e1"}`,
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="">Select Target Unit...</option>
                    {filteredUnits && filteredUnits.length > 0 ? (
                      filteredUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          Unit {u.unit_number} {u.unit_type ? `(${u.unit_type})` : ""}{" "}
                          {u.sq_ft ? `• ${u.sq_ft} sqft` : ""}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        {targetCommunityId
                          ? targetTowerId
                            ? "No units in this tower"
                            : "No units created yet"
                          : "Select a community first"}
                      </option>
                    )}
                  </select>
                  {fieldErrors.targetUnitId && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#dc2626",
                        marginTop: "0.25rem",
                        display: "block",
                      }}
                    >
                      {fieldErrors.targetUnitId}
                    </span>
                  )}
                </div>
              </div>

              {Boolean(targetCommunityId) && (!communityUnits || communityUnits.length === 0) && (
                <div
                  style={{
                    padding: "0.5rem 0.75rem",
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: "6px",
                    color: "#92400e",
                    fontSize: "0.775rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <span>⚠️</span>
                  <span>
                    No units created yet in this community. Please add towers/units in Community
                    Management first.
                  </span>
                </div>
              )}
            </div>

            {/* SECTION 2: RESIDENT PROFILE & CONTACT */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontWeight: 600,
                  fontSize: "0.825rem",
                  color: "#334155",
                }}
              >
                <span>👤</span> Resident Identity &amp; Contact
              </div>

              {/* Name & Email */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.775rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Full Name <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    id="resident-form-fullName"
                    type="text"
                    className="input-field"
                    value={fullName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFullName(val);
                      setPassword(generateInitialPassword(val, "resident"));
                      if (fieldErrors.fullName) {
                        setFieldErrors((prev) => ({ ...prev, fullName: "" }));
                      }
                    }}
                    placeholder="e.g. Rahul Sharma"
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: `1px solid ${fieldErrors.fullName ? "#dc2626" : "#cbd5e1"}`,
                    }}
                  />
                  {fieldErrors.fullName && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#dc2626",
                        marginTop: "0.25rem",
                        display: "block",
                      }}
                    >
                      {fieldErrors.fullName}
                    </span>
                  )}
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.775rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Email Address <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    id="resident-form-email"
                    type="email"
                    className="input-field"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: "" }));
                      }
                    }}
                    placeholder="e.g. rahul@example.com"
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: `1px solid ${fieldErrors.email ? "#dc2626" : "#cbd5e1"}`,
                    }}
                  />
                  {fieldErrors.email && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#dc2626",
                        marginTop: "0.25rem",
                        display: "block",
                      }}
                    >
                      {fieldErrors.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Phone & Password */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.775rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Phone Number
                  </label>
                  <input
                    id="resident-form-phone"
                    type="tel"
                    className="input-field"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (fieldErrors.phone) {
                        setFieldErrors((prev) => ({ ...prev, phone: "" }));
                      }
                    }}
                    placeholder="e.g. +91 98765 43210"
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: `1px solid ${fieldErrors.phone ? "#dc2626" : "#cbd5e1"}`,
                    }}
                  />
                  {fieldErrors.phone && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#dc2626",
                        marginTop: "0.25rem",
                        display: "block",
                      }}
                    >
                      {fieldErrors.phone}
                    </span>
                  )}
                </div>
                <div>
                  <PasswordField
                    id="resident-form-password"
                    value={password}
                    onChange={(val) => {
                      setPassword(val);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: "" }));
                      }
                    }}
                    placeholder="e.g. rahul@Gate2026!"
                  />
                  {fieldErrors.password && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#dc2626",
                        marginTop: "0.25rem",
                        display: "block",
                      }}
                    >
                      {fieldErrors.password}
                    </span>
                  )}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)" }}>
                💡 Providing credentials allows this resident to sign in to the{" "}
                <strong>Resident Portal</strong> to approve visitors, receive delivery alerts, and
                book amenities.
              </p>
            </div>

            {/* SECTION 3: OCCUPANCY & ROLES */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontWeight: 600,
                  fontSize: "0.825rem",
                  color: "#334155",
                }}
              >
                <span>📋</span> Occupancy Role &amp; Details
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.775rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Occupancy Role <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    className="input-field"
                    value={occupancyRole}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOccupancyRole(val);
                      if (val === "secondary_owner" || val === "occupant") {
                        setIsPrimary(false);
                      } else if (val === "primary_owner") {
                        setIsPrimary(true);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="primary_owner">Primary Owner</option>
                    <option value="secondary_owner">Secondary Owner / Co-Owner</option>
                    <option value="tenant">Tenant / Renter</option>
                    <option value="occupant">Occupant</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.775rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Agreement Reference{" "}
                    {occupancyRole === "tenant" ? (
                      <span style={{ color: "#dc2626" }}>*</span>
                    ) : (
                      "(Optional)"
                    )}
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={agreementRef}
                    onChange={(e) => setAgreementRef(e.target.value)}
                    placeholder="e.g. LEASE-2026-081"
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </div>
              </div>

              {/* Primary Contact Checkbox Box */}
              <div
                style={{
                  background: isPrimary ? "#f0fdf4" : "#f8fafc",
                  border: isPrimary ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onClick={() => setIsPrimary(!isPrimary)}
              >
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  style={{ marginTop: "0.2rem", cursor: "pointer", accentColor: "#16a34a" }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div>
                  <div
                    style={{
                      fontSize: "0.825rem",
                      fontWeight: 600,
                      color: isPrimary ? "#166534" : "#334155",
                    }}
                  >
                    Primary Unit Contact
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: isPrimary ? "#15803d" : "#64748b",
                      marginTop: "0.1rem",
                    }}
                  >
                    Receives all visitor approvals, entry alerts, delivery checkpoints, and invoices
                    for this unit.
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.6rem",
                marginTop: "0.25rem",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAddResidentOpen(false)}
                disabled={isSubmitting}
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "var(--primary, #2563eb)",
                  color: "#ffffff",
                  fontWeight: 600,
                  borderRadius: "6px",
                }}
              >
                {isSubmitting ? "Registering..." : "👤 Register Resident"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Resident Confirmation Modal */}
      <Modal
        isOpen={Boolean(residentToDelete)}
        onClose={() => {
          setResidentToDelete(null);
          setDeleteError("");
        }}
        title="⚠️ Delete Resident Profile"
      >
        {residentToDelete && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-sm)",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🗑️</span>
                <strong style={{ fontSize: "0.95rem", color: "#991b1b" }}>
                  This action is permanent and cannot be undone.
                </strong>
              </div>
              <p style={{ fontSize: "0.85rem", color: "#7f1d1d", margin: 0, lineHeight: 1.5 }}>
                You are about to permanently delete the profile of{" "}
                <strong>{residentToDelete.full_name}</strong> (Unit{" "}
                {residentToDelete.unit_number || "–"}).
              </p>
              <p style={{ fontSize: "0.8rem", color: "#991b1b", margin: 0 }}>
                This will remove their portal access, visitor pre-approvals, and all associated
                records.
              </p>
            </div>

            {deleteError && (
              <div
                style={{
                  padding: "0.6rem 0.85rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "var(--radius-sm)",
                  color: "#b91c1c",
                  fontSize: "0.85rem",
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setResidentToDelete(null);
                  setDeleteError("");
                }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteResident}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
