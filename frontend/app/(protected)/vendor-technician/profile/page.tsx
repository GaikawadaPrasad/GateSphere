"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";

export default function VendorProfilePage() {
  const [companyName, setCompanyName] = useState("Apex Water Treatment Solutions");
  const [contactPerson, setContactPerson] = useState("Alexander Wright");
  const [phone, setPhone] = useState("+91 98111 22233");
  const [email, setEmail] = useState("contact@apexwater.in");
  const [specialization, setSpecialization] = useState("Plumbing & Industrial Water Treatment");
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div>
      <PageHeader
        title="Vendor / Technician Profile"
        subtitle="Manage vendor company details, primary contact information, and service specialization areas"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Vendor" }, { label: "Profile" }]}
      />

      {isSaved && (
        <div
          style={{
            padding: "0.85rem",
            marginBottom: "1.25rem",
            background: "var(--success-light)",
            border: "1px solid var(--success-border)",
            borderRadius: "var(--radius-sm)",
            color: "#065f46",
            fontWeight: 600,
          }}
        >
          ✅ Profile details updated successfully.
        </div>
      )}

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-header">
          <h3 className="card-title">Company & Technician Details</h3>
        </div>

        <form onSubmit={handleSaveProfile}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Company / Vendor Name
            </label>
            <input
              type="text"
              className="input-field"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Primary Contact Person
              </label>
              <input
                type="text"
                className="input-field"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Contact Phone
              </label>
              <input
                type="text"
                className="input-field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Official Email
            </label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Service Specializations
            </label>
            <input
              type="text"
              className="input-field"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: "0.65rem 1.5rem" }}>
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
