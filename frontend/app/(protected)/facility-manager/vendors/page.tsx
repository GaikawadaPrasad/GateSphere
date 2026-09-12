"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { DataTable } from "@/components/tables/DataTable";
import { vendorsApi, communitiesApi } from "@/lib/api";

interface VendorUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  role_slug: string;
}

export default function FacilityManagerVendorsPage() {
  const [vendors, setVendors] = useState<VendorUser[]>([]);
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Create vendor modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newCommunityId, setNewCommunityId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [vendorsRes, commRes] = await Promise.allSettled([
        vendorsApi.list(),
        communitiesApi.list(),
      ]);
      if (vendorsRes.status === "fulfilled") {
        setVendors(
          (vendorsRes.value || []).map((v: any) => ({
            id: v.id,
            full_name: v.full_name || v.name || "—",
            email: v.email || "—",
            phone: v.phone || null,
            is_active: v.is_active !== false,
            role_slug:
              v.role_slug ||
              (Array.isArray(v.roles) ? v.roles[0]?.role_slug || v.roles[0] : null) ||
              "vendor_technician",
          })),
        );
      } else {
        setLoadError((vendorsRes as any).reason?.message || "Failed to load vendor technicians.");
      }
      if (commRes.status === "fulfilled") {
        setCommunities((commRes.value || []).map((c: any) => ({ id: c.id, name: c.name })));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleActive = async (v: VendorUser) => {
    const next = !v.is_active;
    setVendors((prev) => prev.map((x) => (x.id === v.id ? { ...x, is_active: next } : x)));
    try {
      await vendorsApi.toggleActive(v.id, next);
    } catch (err: any) {
      setVendors((prev) => prev.map((x) => (x.id === v.id ? { ...x, is_active: v.is_active } : x)));
      alert(err?.message || "Failed to update vendor status.");
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) return;
    setIsCreating(true);
    try {
      await vendorsApi.create({
        full_name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        phone: newPhone.trim() || undefined,
        community_id: newCommunityId || undefined,
      });
      setIsCreateModalOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewPassword("");
      setNewCommunityId("");
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to create vendor.");
    } finally {
      setIsCreating(false);
    }
  };

  const filteredVendors = vendors.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.full_name.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q) ||
      (v.phone || "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title="Vendor & Technician Directory"
        subtitle="Registered vendor technicians available for ticket assignment"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Facility Manager" }, { label: "Vendors" }]}
        actions={
          <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
            ➕ Add Vendor Technician
          </button>
        }
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Vendor Technicians</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredVendors.length} registered technicians
            </p>
          </div>
          <div style={{ width: "100%", maxWidth: 240 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, phone…" />
          </div>
        </div>

        <DataTable
          columns={[
            {
              key: "full_name",
              header: "Full Name",
              sortable: true,
              render: (v: VendorUser) => <span style={{ fontWeight: 600, color: "var(--fg)" }}>{v.full_name}</span>,
            },
            {
              key: "email",
              header: "Email",
              sortable: true,
              render: (v: VendorUser) => <span style={{ fontSize: "0.85rem" }}>{v.email}</span>,
            },
            {
              key: "phone",
              header: "Phone",
              sortable: true,
              render: (v: VendorUser) => <span style={{ fontSize: "0.85rem" }}>{v.phone || "—"}</span>,
            },
            {
              key: "role_slug",
              header: "Role",
              sortable: true,
              render: (v: VendorUser) => (
                <span style={{ fontSize: "0.8rem", textTransform: "capitalize" }}>
                  {v.role_slug.replace(/_/g, " ")}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              sortable: true,
              render: (v: VendorUser) => <StatusBadge status={v.is_active ? "active" : "inactive"} />,
            },
            {
              key: "actions",
              header: "Actions",
              render: (v: VendorUser) => (
                <button
                  type="button"
                  className={v.is_active ? "btn btn-secondary" : "btn btn-primary"}
                  style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                  onClick={() => handleToggleActive(v)}
                >
                  {v.is_active ? "Deactivate" : "Activate"}
                </button>
              ),
            },
          ]}
          data={filteredVendors as (VendorUser & Record<string, unknown>)[]}
          isLoading={isLoading}
          emptyTitle="No vendors match your search"
          emptyDescription={search ? "Try adjusting your search criteria." : "No vendor technicians registered yet. Click 'Add Vendor Technician' to create one."}
          enableClientPagination={true}
          enableClientSort={true}
          pageSize={10}
        />
      </div>

      {/* Create Vendor Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Vendor Technician"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="create-vendor-form" disabled={isCreating}>
              {isCreating ? "Creating…" : "Create Vendor"}
            </button>
          </>
        }
      >
        <form id="create-vendor-form" onSubmit={handleCreateVendor}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Full Name *
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Ravi Kumar"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Email *
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="vendor@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Password *
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="Min 10 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={10}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Phone
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="+91 98765 43210"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
          </div>

          {communities.length > 0 && (
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Assign to Community
              </label>
              <select
                className="select-field"
                value={newCommunityId}
                onChange={(e) => setNewCommunityId(e.target.value)}
              >
                <option value="">— All communities —</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
