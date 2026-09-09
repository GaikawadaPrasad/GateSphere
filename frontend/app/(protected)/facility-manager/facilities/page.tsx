"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { facilitiesApi, type Facility } from "@/lib/api";

export default function FacilityManagerFacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  // Add Facility Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("Community Hall");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("50");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await facilitiesApi.list();
      setFacilities(
        (data || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          code: a.code,
          type: a.amenity_type ? a.amenity_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Other",
          location: a.location_text || "Community Grounds",
          capacity: a.capacity || 0,
          status: a.is_active ? "Available" : "Under Maintenance",
          last_maintenance: "Active",
        }))
      );
    } catch {
      // fallback
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const generatedCode = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8) + "-" + Math.floor(10 + Math.random() * 90);
      const rawType = type.toLowerCase();
      let amenityType = "other";
      if (rawType.includes("pool")) amenityType = "pool";
      else if (rawType.includes("sport") || rawType.includes("tennis") || rawType.includes("court") || rawType.includes("ball")) amenityType = "tennis";
      else if (rawType.includes("gym") || rawType.includes("fitness") || rawType.includes("wellness")) amenityType = "gym";
      else if (rawType.includes("club")) amenityType = "clubhouse";
      else if (rawType.includes("guest") || rawType.includes("room")) amenityType = "guest_room";
      else if (rawType.includes("park") || rawType.includes("ground")) amenityType = "park";
      else if (rawType.includes("hall")) amenityType = "hall";

      await facilitiesApi.create({
        code: generatedCode,
        name: name.trim(),
        amenity_type: amenityType,
        location_text: location || undefined,
        capacity: parseInt(capacity) || 10,
        booking_required: true,
      });
      setIsAddModalOpen(false);
      setName("");
      setLocation("");
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to add facility (Admin approval required).");
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const isActive = newStatus === "Available" || newStatus === "Occupied/Booked";
      await facilitiesApi.updateStatus(id, isActive ? "true" : "false");
      setFacilities((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: newStatus as any } : f))
      );
    } catch {
      // Keep optimistic or notify
    }
  };

  const filteredFacilities = facilities.filter((f) => {
    const matchSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || f.status === statusFilter;
    const matchType = typeFilter === "all" || f.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  return (
    <div>
      <PageHeader
        title="Facility Management"
        subtitle="Manage community facilities, operational availability, schedules, and maintenance status"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Facility Manager" }, { label: "Facilities" }]}
        actions={
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
            ➕ Add Facility
          </button>
        }
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">All Community Facilities</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredFacilities.length} facilities listed
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: 220 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search facility name/location…" />
            </div>

            <select
              className="select-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Occupied/Booked">Occupied/Booked</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Unavailable">Unavailable</option>
            </select>

            <select
              className="select-field"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Types</option>
              <option value="Sports">Sports</option>
              <option value="Community Hall">Community Hall</option>
              <option value="Wellness">Wellness</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Facility Name</th>
                <th>Type</th>
                <th>Location</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Last Maintenance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading facilities…
                  </td>
                </tr>
              ) : filteredFacilities.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No facilities found.
                  </td>
                </tr>
              ) : (
                filteredFacilities.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{f.name}</td>
                    <td>{f.type}</td>
                    <td>{f.location}</td>
                    <td>{f.capacity || "N/A"} persons</td>
                    <td>
                      <StatusBadge status={f.status} />
                    </td>
                    <td>{f.last_maintenance || "N/A"}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <select
                          className="select-field"
                          value={f.status}
                          onChange={(e) => handleStatusChange(f.id, e.target.value)}
                          style={{ height: 28, fontSize: "0.75rem", padding: "0 0.3rem" }}
                        >
                          <option value="Available">Available</option>
                          <option value="Occupied/Booked">Booked</option>
                          <option value="Under Maintenance">Under Maintenance</option>
                          <option value="Unavailable">Unavailable</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Facility Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Facility"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAddFacility}>
              Add Facility
            </button>
          </>
        }
      >
        <form onSubmit={handleAddFacility}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Facility Name *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Squash Court 2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Type
              </label>
              <select className="select-field" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="Sports">Sports / Court</option>
                <option value="Community Hall">Community Hall</option>
                <option value="Swimming Pool">Swimming Pool</option>
                <option value="Gym">Gym & Fitness</option>
                <option value="Clubhouse">Clubhouse</option>
                <option value="Park">Park & Ground</option>
                <option value="Guest Room">Guest Room</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Max Capacity
              </label>
              <input
                type="number"
                className="input-field"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Location / Block
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. East Wing Level 1"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
