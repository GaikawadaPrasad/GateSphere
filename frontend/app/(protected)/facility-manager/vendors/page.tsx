"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { vendorsApi, type Vendor } from "@/lib/api";

export default function FacilityManagerVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Review Completion Modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [feedback, setFeedback] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // NOTE: facility_manager does not currently hold users:view in the backend RBAC
      // seed (backend/app/core/rbac.py), so this 403s today — see the integration report.
      const data = await vendorsApi.list();
      setVendors(data);
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load vendors.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReviewWork = async (decision: "Approve" | "Request Rework") => {
    if (!selectedVendor) return;
    try {
      // NOTE: POST /users/{id}/review does not exist in the backend — there is no
      // vendor-work-review concept implemented at all. See the integration report.
      await vendorsApi.reviewCompletion(selectedVendor.id, decision);
      alert(`Work submission for ${selectedVendor.name} has been: ${decision}`);
      setIsReviewModalOpen(false);
      setFeedback("");
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to submit review.");
    }
  };

  const filteredVendors = vendors.filter((v) => {
    const matchSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.contact_person.toLowerCase().includes(search.toLowerCase()) ||
      v.email.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || v.category.includes(categoryFilter);
    return matchSearch && matchCategory;
  });

  return (
    <div>
      <PageHeader
        title="Vendor Directory & Work Oversight"
        subtitle="Manage service vendor profiles, active assignments, and review completed work signoffs"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Facility Manager" }, { label: "Vendors" }]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Contracted Vendors</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredVendors.length} active service vendors
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: "100%", maxWidth: 220 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search vendor name/contact…"
              />
            </div>

            <select
              className="select-field"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Categories</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Elevators">Elevators</option>
              <option value="Electrical">Electrical</option>
              <option value="Horticulture">Horticulture</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor / Company</th>
                <th>Category</th>
                <th>Contact Person</th>
                <th>Phone / Email</th>
                <th>Rating</th>
                <th>Active Jobs</th>
                <th>Completed</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading vendors…
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "var(--danger, #dc2626)",
                    }}
                  >
                    {loadError}
                  </td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No vendors found.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{v.name}</td>
                    <td>{v.category}</td>
                    <td>{v.contact_person}</td>
                    <td>
                      <div>{v.phone}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{v.email}</div>
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--warning)" }}>{v.rating} ★</td>
                    <td style={{ fontWeight: 600 }}>{v.active_jobs} active</td>
                    <td>{v.completed_jobs} done</td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                        onClick={() => {
                          setSelectedVendor(v);
                          setIsReviewModalOpen(true);
                        }}
                      >
                        Review Work
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Completion Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title={`Review Work Completion — ${selectedVendor?.name}`}
        footer={
          <>
            <button
              className="btn btn-danger"
              onClick={() => handleReviewWork("Request Rework")}
              style={{ marginRight: "auto" }}
            >
              🔄 Request Rework
            </button>
            <button className="btn btn-secondary" onClick={() => setIsReviewModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => handleReviewWork("Approve")}>
              ✅ Approve Completion
            </button>
          </>
        }
      >
        <div>
          <p style={{ marginBottom: "0.85rem", fontSize: "0.875rem" }}>
            Vendor <strong>{selectedVendor?.name}</strong> has submitted job completion proof.
          </p>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Manager Review Notes / Rework Instructions
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="e.g. Work approved. Pressure testing passed clean."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
