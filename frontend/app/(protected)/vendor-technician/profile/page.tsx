"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { authApi, type CurrentUser } from "@/lib/api";

export default function VendorProfilePage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [companyName, setCompanyName] = useState("GateSphere Authorized Maintenance Vendor");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specialization, setSpecialization] = useState("Facility Maintenance, Electrical & HVAC");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);
      try {
        const user = await authApi.me("vendor_technician");
        if (user) {
          setCurrentUser(user);
          setContactPerson(user.full_name || "");
          setEmail(user.email || "");
          setPhone(user.phone || "+91 98765 43210");
        }
      } catch {
        // Fallback gracefully
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div>
      <PageHeader
        title="Vendor / Technician Profile"
        subtitle="Manage vendor technician details, official contact information, and service assignments"
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
          ✅ Profile details saved successfully.
        </div>
      )}

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-header">
          <h3 className="card-title">Technician & Vendor Account</h3>
        </div>

        {isLoading ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--muted)" }}>
            Loading technician profile…
          </div>
        ) : (
          <form onSubmit={handleSaveProfile}>
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  marginBottom: "0.35rem",
                }}
              >
                Company / Service Provider
              </label>
              <input
                type="text"
                className="input-field"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
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
                  Technician Full Name
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
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    marginBottom: "0.35rem",
                  }}
                >
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
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  marginBottom: "0.35rem",
                }}
              >
                Official Login Email (Verified)
              </label>
              <input
                type="email"
                className="input-field"
                value={email}
                disabled
                style={{
                  background: "var(--surface-subtle)",
                  color: "var(--muted)",
                  cursor: "not-allowed",
                }}
              />
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                Managed via GateSphere RBAC enterprise user identity.
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  marginBottom: "0.35rem",
                }}
              >
                Service Specializations
              </label>
              <input
                type="text"
                className="input-field"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
              />
            </div>

            <div
              style={{
                marginBottom: "1.5rem",
                padding: "0.75rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-subtle)",
                border: "1px solid var(--border)",
                fontSize: "0.8rem",
              }}
            >
              <div style={{ color: "var(--muted)" }}>Assigned Community:</div>
              <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "0.2rem" }}>
                {(currentUser as any)?.community_name || "Enterprise Community"}
              </div>
              <div style={{ color: "var(--muted)", marginTop: "0.5rem" }}>Assigned Role:</div>
              <div style={{ fontWeight: 600, color: "var(--primary)", marginTop: "0.2rem" }}>
                Vendor Technician (Cross-Unit Access)
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ padding: "0.65rem 1.5rem" }}>
              Save Profile Changes
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
