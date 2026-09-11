"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { amenitiesApi, getCsrfToken, type Amenity, type AmenityBooking } from "@/lib/api";

export default function FacilityManagerAmenitiesPage() {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [bookings, setBookings] = useState<AmenityBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
              }).then((r) => r.json()).then((r) => r.data || []);
              const activeBlock = blockList.find(
                (b: any) => new Date(b.blocked_to) > new Date()
              );
              return { ...a, block_id: activeBlock?.id || null };
            } catch {
              return { ...a, block_id: null };
            }
          })
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

  const handleBlockSlot = async () => {
    if (!selectedAmenity || !blockFrom || !blockTo) return;
    if (new Date(blockTo) <= new Date(blockFrom)) {
      alert("'Block To' must be after 'Block From'.");
      return;
    }
    try {
      const block = await amenitiesApi.blockSlot({
        amenity_id: selectedAmenity.id,
        blocked_from: new Date(blockFrom).toISOString(),
        blocked_to: new Date(blockTo).toISOString(),
        reason: blockReason || undefined,
      });
      setAmenities((prev) =>
        prev.map((a) =>
          a.id === selectedAmenity.id
            ? { ...a, is_active: false, block_id: block?.id }
            : a,
        ),
      );
      setIsBlockModalOpen(false);
      setBlockReason("");
    } catch (err: any) {
      alert(err?.message || "Failed to block slot.");
    }
  };

  const handleUnblockSlot = async (amenity: any) => {
    try {
      const csrf = getCsrfToken();
      const res = await fetch(`/api/v1/amenities/${amenity.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Session-Role": "facility_manager",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Failed to unblock (${res.status})`);
      }
      setAmenities((prev) =>
        prev.map((a: any) => (a.id === amenity.id ? { ...a, is_active: true, block_id: null } : a)),
      );
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
      setBookings((prev) => prev.map((b: any) => b.id === bookingId ? { ...b, status: "cancelled" } : b));
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
                    <td colSpan={5} style={{ textAlign: "center", padding: "1.5rem", color: "var(--danger, #dc2626)" }}>
                      {loadError}
                    </td>
                  </tr>
                ) : amenities.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}>
                      No amenities found.
                    </td>
                  </tr>
                ) : (
                  amenities.map((a: any) => (
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
                  <th>Booking Date</th>
                  <th>Time Slot</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "1.5rem" }}>
                      Loading bookings…
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}
                    >
                      No upcoming bookings.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b: any) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>
                        {amenities.find((a: any) => a.id === b.amenity_id)?.name || b.amenity_id}
                      </td>
                      <td>{formatBookingDate(b)}</td>
                      <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        {formatSlot(b)}
                      </td>
                      <td><StatusBadge status={b.status} /></td>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
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
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
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
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
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
    </div>
  );
}
