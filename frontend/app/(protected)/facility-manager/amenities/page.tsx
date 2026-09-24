"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { Pagination } from "@/components/tables/Pagination";
import { amenitiesApi, facilitiesApi, type Amenity, type AmenityBooking } from "@/lib/api";

export default function FacilityManagerAmenitiesPage() {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [bookings, setBookings] = useState<AmenityBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pagination for Amenities
  const [amenityPage, setAmenityPage] = useState(1);
  const [amenityPageSize, setAmenityPageSize] = useState(10);

  // Pagination for Bookings
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingPageSize, setBookingPageSize] = useState(10);

  // Add Amenity Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("hall");
  const [newCapacity, setNewCapacity] = useState("50");
  const [newLocation, setNewLocation] = useState("");
  const [isCreatingAmenity, setIsCreatingAmenity] = useState(false);

  // Maintenance Block Modal
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [blockFrom, setBlockFrom] = useState("");
  const [blockTo, setBlockTo] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [amRes, bkRes] = await Promise.allSettled([
        amenitiesApi.list(),
        amenitiesApi.bookings(),
      ]);
      if (amRes.status === "fulfilled") {
        const baseAmenities = amRes.value || [];
        // Fetch active blocks for each amenity via GET /amenities/{id}/blocks
        const withBlocks = await Promise.all(
          baseAmenities.map(async (a: any) => {
            try {
              const blockList = await fetch(`/api/v1/amenities/${a.id}/blocks`, {
                credentials: "include",
                headers: { Accept: "application/json", "X-Session-Role": "facility_manager" },
              })
                .then((r) => r.json())
                .then((r) => r.data || []);
              const activeBlock = blockList.find((b: any) => new Date(b.blocked_to) > new Date());
              return { ...a, block_id: activeBlock?.id || null };
            } catch {
              return { ...a, block_id: null };
            }
          }),
        );
        setAmenities(withBlocks);
      } else {
        setLoadError((amRes as any).reason?.message || "Failed to load amenities.");
      }
      if (bkRes.status === "fulfilled") {
        setBookings(bkRes.value || []);
      }
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load amenities.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const paginatedAmenities = useMemo(() => {
    const start = (amenityPage - 1) * amenityPageSize;
    return amenities.slice(start, start + amenityPageSize);
  }, [amenities, amenityPage, amenityPageSize]);

  const paginatedBookings = useMemo(() => {
    const start = (bookingPage - 1) * bookingPageSize;
    return bookings.slice(start, start + bookingPageSize);
  }, [bookings, bookingPage, bookingPageSize]);

  const handleAddAmenity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newName.trim().length < 2) {
      alert("Amenity name must be at least 2 characters.");
      return;
    }
    const cap = parseInt(newCapacity, 10);
    if (isNaN(cap) || cap < 1) {
      alert("Capacity must be a positive number.");
      return;
    }
    setIsCreatingAmenity(true);
    try {
      const generatedCode =
        newName
          .replace(/[^A-Za-z0-9]/g, "")
          .toUpperCase()
          .slice(0, 8) +
        "-" +
        Math.floor(10 + Math.random() * 90);

      await facilitiesApi.create({
        code: generatedCode,
        name: newName.trim(),
        amenity_type: newType,
        location_text: newLocation.trim() || undefined,
        capacity: cap,
        booking_required: true,
      });
      setIsAddModalOpen(false);
      setNewName("");
      setNewLocation("");
      setNewCapacity("50");
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to create amenity.");
    } finally {
      setIsCreatingAmenity(false);
    }
  };

  const handleBlockSlot = async () => {
    if (!selectedAmenity || !blockFrom || !blockTo) return;
    if (new Date(blockTo) <= new Date(blockFrom)) {
      alert("'Block To' must be after 'Block From'.");
      return;
    }
    try {
      await amenitiesApi.blockSlot({
        amenity_id: selectedAmenity.id,
        blocked_from: new Date(blockFrom).toISOString(),
        blocked_to: new Date(blockTo).toISOString(),
        reason: blockReason || undefined,
      });
      setIsBlockModalOpen(false);
      setBlockReason("");
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to block slot.");
    }
  };

  const handleUnblockSlot = async (amenity: any) => {
    try {
      if (!amenity.block_id) return;
      await amenitiesApi.unblockSlot(amenity.block_id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to unblock slot.");
    }
  };

  const openBlockModal = (a: Amenity) => {
    setSelectedAmenity(a);
    const now = new Date();
    const plus24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    setBlockFrom(now.toISOString().slice(0, 16));
    setBlockTo(plus24.toISOString().slice(0, 16));
    setBlockReason("");
    setIsBlockModalOpen(true);
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm("Cancel this booking?")) return;
    try {
      await amenitiesApi.cancelBooking(bookingId, "Cancelled by facility manager");
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to cancel booking.");
    }
  };

  // Derive a display label for amenity status
  const getAmenityStatus = (a: any) =>
    a.block_id ? "Maintenance Block" : a.is_active ? "Available" : "Inactive";

  // Format booking slot from start_at / end_at
  const formatSlot = (b: any) => {
    if (!b.start_at) return "—";
    const start = new Date(b.start_at);
    const end = b.end_at ? new Date(b.end_at) : null;
    const timeStr = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const endStr = end ? end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    return end ? `${timeStr} – ${endStr}` : timeStr;
  };

  const formatBookingDate = (b: any) => {
    if (b.booking_date) return String(b.booking_date);
    if (b.start_at) return new Date(b.start_at).toLocaleDateString();
    return "—";
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
        actions={
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
            + Add Amenity
          </button>
        }
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
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="card-title">Community Amenities</h3>
            <span style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {amenities.length} total
            </span>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Amenity Name</th>
                  <th>Type</th>
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
                ) : loadError ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        padding: "1.5rem",
                        color: "var(--danger, #dc2626)",
                      }}
                    >
                      {loadError}
                    </td>
                  </tr>
                ) : amenities.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}
                    >
                      No amenities found.
                    </td>
                  </tr>
                ) : (
                  paginatedAmenities.map((a: any) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600, color: "var(--fg)" }}>{a.name}</td>
                      <td style={{ textTransform: "capitalize" }}>
                        {a.amenity_type?.replace(/_/g, " ") || "—"}
                      </td>
                      <td>{a.capacity} max</td>
                      <td>
                        <StatusBadge status={getAmenityStatus(a)} />
                      </td>
                      <td>
                        {a.block_id ? (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => handleUnblockSlot(a)}
                          >
                            Unblock Slot
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => openBlockModal(a)}
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
          {amenities.length > 0 && (
            <Pagination
              page={amenityPage}
              pageSize={amenityPageSize}
              total={amenities.length}
              onPageChange={setAmenityPage}
              onPageSizeChange={(sz) => {
                setAmenityPageSize(sz);
                setAmenityPage(1);
              }}
            />
          )}
        </div>

        {/* Right Side: Active Resident Bookings */}
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="card-title">Upcoming Resident Bookings</h3>
            <span style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {bookings.length} total
            </span>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Amenity</th>
                  <th>Resident / Booked By</th>
                  <th>Unit / Tower</th>
                  <th>Booking Date</th>
                  <th>Time Slot</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "1.5rem" }}>
                      Loading bookings…
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}
                    >
                      No upcoming bookings.
                    </td>
                  </tr>
                ) : (
                  paginatedBookings.map((b: any) => {
                    const residentName =
                      b.resident_name ||
                      b.resident_user?.full_name ||
                      (b.resident_user_id ? "Resident" : "—");
                    const unitDisplay =
                      b.unit_label ||
                      (b.unit_number
                        ? `Unit ${b.unit_number}${b.tower_name ? `, ${b.tower_name}` : ""}`
                        : "—");
                    const phoneDisplay = b.resident_phone || b.resident_user?.phone || "";

                    return (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 600, color: "var(--fg)" }}>
                          {b.amenity_name ||
                            amenities.find((a: any) => a.id === b.amenity_id)?.name ||
                            "Amenity"}
                        </td>
                        <td>
                          <div
                            style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--fg)" }}
                          >
                            👤 {residentName}
                          </div>
                          {phoneDisplay && (
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--muted)",
                                fontFamily: "monospace",
                                marginTop: "0.1rem",
                              }}
                            >
                              {phoneDisplay}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              display: "inline-block",
                              fontWeight: 600,
                              fontSize: "0.8rem",
                              color: "var(--primary-dark, #1e40af)",
                              background: "var(--primary-subtle, #eff6ff)",
                              padding: "0.2rem 0.5rem",
                              borderRadius: "4px",
                              border: "1px solid #bfdbfe",
                              whiteSpace: "nowrap",
                            }}
                          >
                            📍 {unitDisplay}
                          </span>
                        </td>
                        <td>{formatBookingDate(b)}</td>
                        <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                          {formatSlot(b)}
                        </td>
                        <td>
                          <StatusBadge status={b.status} />
                        </td>
                        <td>
                          {b.status !== "cancelled" && (
                            <button
                              className="btn btn-danger"
                              style={{ fontSize: "0.72rem", padding: "0.15rem 0.4rem" }}
                              onClick={() => handleCancelBooking(b.id)}
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {bookings.length > 0 && (
            <Pagination
              page={bookingPage}
              pageSize={bookingPageSize}
              total={bookings.length}
              onPageChange={setBookingPage}
              onPageSizeChange={(sz) => {
                setBookingPageSize(sz);
                setBookingPage(1);
              }}
            />
          )}
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
            <button
              className="btn btn-primary"
              onClick={handleBlockSlot}
              disabled={!blockFrom || !blockTo}
            >
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
                Block From *
              </label>
              <input
                type="datetime-local"
                className="input-field"
                value={blockFrom}
                onChange={(e) => setBlockFrom(e.target.value)}
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
                Block To *
              </label>
              <input
                type="datetime-local"
                className="input-field"
                value={blockTo}
                onChange={(e) => setBlockTo(e.target.value)}
                required
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
              Reason for Maintenance Block
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Scheduled Pool Cleaning & Chlorination"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Add Amenity Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Amenity"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-amenity-form"
              className="btn btn-primary"
              disabled={isCreatingAmenity}
            >
              {isCreatingAmenity ? "Creating…" : "Create Amenity"}
            </button>
          </>
        }
      >
        <form id="add-amenity-form" onSubmit={handleAddAmenity}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Amenity Name *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Badminton Court A"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
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
                Type *
              </label>
              <select
                className="input-field"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              >
                <option value="hall">Community Hall</option>
                <option value="clubhouse">Clubhouse</option>
                <option value="pool">Swimming Pool</option>
                <option value="gym">Gym / Fitness Center</option>
                <option value="tennis">Tennis / Badminton Court</option>
                <option value="guest_room">Guest Suite</option>
                <option value="park">Garden / Park</option>
                <option value="other">Other Facility</option>
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
                Capacity (People) *
              </label>
              <input
                type="number"
                min={1}
                className="input-field"
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: "0.5rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Location / Instructions
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Block B, Ground Floor"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
