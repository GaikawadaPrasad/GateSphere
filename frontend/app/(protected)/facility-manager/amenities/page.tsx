"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { amenitiesApi, type Amenity, type AmenityBooking } from "@/lib/api";

export default function FacilityManagerAmenitiesPage() {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [bookings, setBookings] = useState<AmenityBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Maintenance Block Modal
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    const [amData, bkData] = await Promise.all([amenitiesApi.list(), amenitiesApi.bookings()]);
    setAmenities(amData);
    setBookings(bkData);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBlockSlot = async () => {
    if (!selectedAmenity) return;
    await amenitiesApi.blockSlot(selectedAmenity.id, blockReason);
    setAmenities((prev) =>
      prev.map((a) => (a.id === selectedAmenity.id ? { ...a, status: "Maintenance Block" } : a)),
    );
    setIsBlockModalOpen(false);
    setBlockReason("");
  };

  const handleUnblockSlot = async (id: string) => {
    await amenitiesApi.unblockSlot(id);
    setAmenities((prev) => prev.map((a) => (a.id === id ? { ...a, status: "Available" } : a)));
  };

  return (
    <div>
      <PageHeader
        title="Amenities & Slot Management"
        subtitle="Manage resident amenity availability, view booking schedules, and enforce maintenance blocks"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Facility Manager" },
          { label: "Amenities" },
        ]}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.75rem",
          alignItems: "start",
        }}
      >
        {/* Left Side: Amenities List & Block Controls */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Community Amenities</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Amenity Name</th>
                  <th>Category</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "1.5rem" }}>
                      Loading amenities…
                    </td>
                  </tr>
                ) : (
                  amenities.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600, color: "var(--fg)" }}>{a.name}</td>
                      <td>{a.category}</td>
                      <td>{a.capacity} max</td>
                      <td>
                        <StatusBadge status={a.status} />
                      </td>
                      <td>
                        {a.status === "Maintenance Block" ? (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => handleUnblockSlot(a.id)}
                          >
                            Unblock Slot
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => {
                              setSelectedAmenity(a);
                              setIsBlockModalOpen(true);
                            }}
                          >
                            Block Slot
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Active Resident Bookings */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Upcoming Resident Bookings</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Amenity</th>
                  <th>Resident</th>
                  <th>Slot / Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "1.5rem" }}>
                      Loading bookings…
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}
                    >
                      No upcoming bookings.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.amenity_name}</td>
                      <td>
                        <div>{b.resident_name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{b.unit}</div>
                      </td>
                      <td>
                        <div>{b.date}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {b.time_slot}
                        </div>
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
      </div>

      {/* Block Slot Modal */}
      <Modal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        title={`Create Maintenance Block — ${selectedAmenity?.name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsBlockModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleBlockSlot}>
              Block Slot
            </button>
          </>
        }
      >
        <div>
          <p style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
            Create an operational maintenance block to prevent resident bookings for{" "}
            <strong>{selectedAmenity?.name}</strong>:
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
              Reason for Maintenance Block *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Scheduled Pool Cleaning & Chlorination"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              required
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
