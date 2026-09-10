"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatMetric } from "@/components/common/StatMetric";
import { LiveDot } from "@/components/common/LiveDot";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, Column } from "@/components/tables/DataTable";
import { DebouncedInput } from "@/components/forms/DebouncedInput";
import { FilterPanel } from "@/components/forms/FilterPanel";
import { BrandButton } from "@/components/common/BrandButton";
import { Modal } from "@/components/common/Modal";
import {
  useResidentOverview,
  useResidentVisitors,
  useResidentDeliveries,
  useResidentAmenities,
  useAmenitySlots,
  AmenitySlot,
  useResidentComplaints,
  useResidentPayments,
  useResidentFamilyMembers,
  FamilyMember,
  useResidentProfile,
  useResidentDeliveryProtocols,
  useResidentVehicles,
  useResidentDomesticStaff,
  useSendResidentPanic,
  VisitorRequest,
  DeliveryItem,
  Amenity,
  AmenityBooking,
  ComplaintTicket,
  InvoiceItem,
} from "@/hooks/use-owner-tenant-data";
import { useAnnouncements } from "@/hooks/use-communication";
import { useMyNotifications } from "@/hooks/use-notifications";
import { useTableControls } from "@/hooks/use-table-controls";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useUiStore } from "@/store/ui";

export type OwnerTenantTab =
  | "overview"
  | "profile"
  | "property"
  | "family-members"
  | "visitors"
  | "deliveries"
  | "amenities"
  | "maintenance"
  | "complaints"
  | "vehicles"
  | "domestic-staff"
  | "payments"
  | "notifications"
  | "emergency";

import { toast } from "@/store/toast";

interface OwnerTenantDashboardViewProps {
  initialTab?: OwnerTenantTab;
}

export function OwnerTenantDashboardView({ initialTab = "overview" }: OwnerTenantDashboardViewProps) {
  const router = useRouter();
  const activeTab = initialTab;
  const { activeCommunityId } = useUiStore();

  // Modals state
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [visitorPassModalOpen, setVisitorPassModalOpen] = useState(false);
  const [amenityBookingModalOpen, setAmenityBookingModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<AmenityBooking | null>(null);
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const todayDateStr = new Date().toISOString().split("T")[0];
  const [bookingDate, setBookingDate] = useState(todayDateStr);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [bookingGuests, setBookingGuests] = useState<number>(1);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [currentReceiptNumber, setCurrentReceiptNumber] = useState("");
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRelation, setNewMemberRelation] = useState("Spouse");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberAccess, setNewMemberAccess] = useState(true);

  // Resident Profile edit state
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileFullName, setProfileFullName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmergencyName, setProfileEmergencyName] = useState("");
  const [profileEmergencyPhone, setProfileEmergencyPhone] = useState("");
  const [profileEmergencyRel, setProfileEmergencyRel] = useState("Spouse");
  const [profileEmergencyNotes, setProfileEmergencyNotes] = useState("");

  // Visitor Pass form state
  const [passVisitorName, setPassVisitorName] = useState("");
  const [passVisitorPhone, setPassVisitorPhone] = useState("");
  const [passDuration, setPassDuration] = useState(24);

  // Service ticket form state
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketCategory, setTicketCategory] = useState("Plumbing");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketPriority, setTicketPriority] = useState("medium");

  // Dismissed state for live visitor approval banner
  const [visitorBannerDismissed, setVisitorBannerDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("gatesphere_gate_alert_dismissed") === "true") {
      setVisitorBannerDismissed(true);
    }
  }, []);

  // Data queries
  const { data: stats, isLoading: statsLoading } = useResidentOverview(activeCommunityId);
  const visitors = useResidentVisitors();
  const deliveries = useResidentDeliveries();
  const amenities = useResidentAmenities();
  const complaints = useResidentComplaints();
  const payments = useResidentPayments();
  const family = useResidentFamilyMembers();
  const profile = useResidentProfile();
  const deliveryProtocols = useResidentDeliveryProtocols();
  const vehicles = useResidentVehicles();
  const domesticStaff = useResidentDomesticStaff();
  const announcements = useAnnouncements();
  const myNotifications = useMyNotifications({ page_size: 20 });
  const panicMutation = useSendResidentPanic();

  const visitorList = visitors.data || [];
  const deliveryList = deliveries.data || [];
  const complaintList = complaints.data || [];
  const invoiceList = payments.data || [];
  const myOccupancy = profile.data?.occupancies?.[0];

  const nextDueInvoice = invoiceList.find((i) => i.balance_due > 0);
  const openTicket = complaintList.find((t) => t.status !== "resolved" && t.status !== "closed");
  const activeStaffCount = (domesticStaff.data || []).filter((s) => s.is_active).length;
  const nextBooking = (amenities.bookings.data || []).find((b) => b.status === "confirmed");

  const pendingVisitor = visitorList.find((v) => v.status === "pending");

  // Table controls
  const visitorControls = useTableControls<VisitorRequest>({
    data: visitorList,
    searchKeys: ["visitor_name", "phone", "purpose", "status"],
    initialPageSize: 10,
  });

  const deliveryControls = useTableControls<DeliveryItem>({
    data: deliveryList,
    searchKeys: ["courier_company", "package_type", "tracking_id", "status"],
    initialPageSize: 10,
  });

  const complaintControls = useTableControls<ComplaintTicket>({
    data: complaintList,
    searchKeys: ["ticket_number", "subject", "category_name", "priority", "status"],
    initialPageSize: 10,
  });

  const invoiceControls = useTableControls<InvoiceItem>({
    data: invoiceList,
    searchKeys: ["invoice_number", "title", "status", "receipt_number"],
    initialPageSize: 10,
  });

  const handleVisitorDecision = async (requestId: string, approved: boolean) => {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId);
      if (isUuid) {
        await visitors.decide.mutateAsync({ requestId, approved });
      }
      setVisitorBannerDismissed(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("gatesphere_gate_alert_dismissed", "true");
      }
      toast.success(
        approved ? "Visitor entry approved for Main Gate 1." : "Visitor entry request rejected.",
        approved ? "Gate Entry Approved" : "Gate Entry Rejected"
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to record visitor decision.", "Error");
    }
  };

  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await visitors.createPass.mutateAsync({
        visitor_name: passVisitorName,
        phone: passVisitorPhone,
        valid_for_hours: passDuration,
      });
      setVisitorPassModalOpen(false);
      setPassVisitorName("");
      setPassVisitorPhone("");
      toast.success("A QR & 4-digit PIN code have been issued for your guest.", "Visitor Pass Generated");
    } catch {
      toast.error("Failed to generate visitor pass.", "Error");
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await complaints.createTicket.mutateAsync({
        subject: ticketSubject,
        description: ticketDescription,
        priority: ticketPriority,
      });
      setTicketModalOpen(false);
      setTicketSubject("");
      setTicketDescription("");
      toast.success("Facility manager and technician have been notified.", "Service Ticket Raised");
    } catch {
      toast.error("Failed to raise ticket.", "Error");
    }
  };

  const amenitySlots = useAmenitySlots(selectedAmenity?.id);

  // Calculate day of week (Python 0=Mon .. 6=Sun)
  const getDayOfWeek = (dStr: string) => {
    if (!dStr) return 0;
    const d = new Date(`${dStr}T12:00:00`);
    return (d.getDay() + 6) % 7;
  };

  const currentDayOfWeek = getDayOfWeek(bookingDate);
  const rawDaySlots = (amenitySlots.data || []).filter(
    (s) => s.is_active && s.day_of_week === currentDayOfWeek
  );

  // If backend returns only 1 wide monolithic slot (>=6 hrs) or no slots, provide standard 2-hr slots
  const availableDaySlots: AmenitySlot[] = React.useMemo(() => {
    const isMonolithic = rawDaySlots.length === 1 && (() => {
      const s = rawDaySlots[0];
      const startH = parseInt((s.start_time || "06:00").split(":")[0], 10);
      const endH = parseInt((s.end_time || "22:00").split(":")[0], 10);
      return (endH - startH) >= 6;
    })();

    if (rawDaySlots.length > 1 && !isMonolithic) {
      return rawDaySlots;
    }

    // Standard 2-hour slots from 06:00 to 22:00
    const standardIntervals = [
      { start: "06:00", end: "08:00" },
      { start: "08:00", end: "10:00" },
      { start: "10:00", end: "12:00" },
      { start: "12:00", end: "14:00" },
      { start: "14:00", end: "16:00" },
      { start: "16:00", end: "18:00" },
      { start: "18:00", end: "20:00" },
      { start: "20:00", end: "22:00" },
    ];

    const baseSlot = rawDaySlots[0];
    return standardIntervals.map((interval, idx) => ({
      id: baseSlot?.id && idx === 0 ? baseSlot.id : (baseSlot ? `${baseSlot.id}_slot_${idx}` : `slot_${currentDayOfWeek}_${idx}`),
      community_id: baseSlot?.community_id || activeCommunityId || "",
      amenity_id: selectedAmenity?.id || "",
      day_of_week: currentDayOfWeek,
      start_time: interval.start,
      end_time: interval.end,
      capacity: baseSlot?.capacity || selectedAmenity?.capacity || 20,
      fee: baseSlot?.fee || "0",
      is_active: true,
    }));
  }, [rawDaySlots, selectedAmenity, currentDayOfWeek, activeCommunityId]);

  useEffect(() => {
    if (availableDaySlots.length > 0) {
      setSelectedSlotId((prev) => {
        if (prev && availableDaySlots.some((s) => s.id === prev)) {
          return prev;
        }
        return availableDaySlots[0].id;
      });
    } else {
      setSelectedSlotId("");
    }
  }, [bookingDate, selectedAmenity?.id, availableDaySlots]);

  const activeSelectedSlot = availableDaySlots.find((s) => s.id === selectedSlotId) || availableDaySlots[0];
  const slotTotalCapacity = activeSelectedSlot?.capacity || selectedAmenity?.capacity || 20;

  const bookedParticipantCount = (amenities.bookings.data || [])
    .filter(
      (b) =>
        b.amenity_id === selectedAmenity?.id &&
        b.date === bookingDate &&
        b.status !== "cancelled" &&
        (b.slot_id ? b.slot_id === activeSelectedSlot?.id : (b.start_time ? b.start_time === activeSelectedSlot?.start_time : true))
    )
    .reduce((sum, b) => sum + (b.guests_count || 1), 0);

  const remainingSpots = Math.max(0, slotTotalCapacity - bookedParticipantCount);

  const formatSlotTime = (t: string) => {
    if (!t) return "";
    const parts = t.split(":");
    const h = parseInt(parts[0], 10);
    const m = parts[1] || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12 < 10 ? "0" : ""}${h12}:${m} ${ampm}`;
  };

  const handleBookAmenity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmenity) return;
    if (!activeSelectedSlot) {
      toast.error("Please select an available time slot for this date.", "Slot Required");
      return;
    }
    if (bookingGuests > remainingSpots) {
      toast.error(
        `Only ${remainingSpots} spot(s) remaining for this slot. Please reduce the number of people.`,
        "Capacity Exceeded"
      );
      return;
    }
    try {
      await amenities.book.mutateAsync({
        amenity_id: selectedAmenity.id,
        slot_id: activeSelectedSlot.id,
        date: bookingDate,
        guests: bookingGuests,
      });
      setAmenityBookingModalOpen(false);
      toast.success(
        `Booking confirmed for ${selectedAmenity.name} on ${bookingDate} (${bookingGuests} person(s))!`,
        "Amenity Booked"
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to confirm amenity booking.", "Booking Error");
    }
  };

  const handleCancelBooking = (booking: AmenityBooking) => {
    if (booking.status !== "confirmed") {
      toast.info("This booking is already cancelled or completed.", "Booking Status");
      return;
    }
    setBookingToCancel(booking);
  };

  const handleConfirmCancelBooking = async () => {
    if (!bookingToCancel) return;
    try {
      await amenities.cancelBooking.mutateAsync(bookingToCancel.id);
      const amenityName = bookingToCancel.amenity_name;
      setBookingToCancel(null);
      toast.success(`Reservation for ${amenityName} has been cancelled.`, "Booking Cancelled");
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel booking.", "Cancellation Error");
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberPhone.trim()) {
      toast.error("Please enter a valid full name and mobile number.", "Validation Error");
      return;
    }
    try {
      await family.addMember.mutateAsync({
        name: newMemberName.trim(),
        relation: newMemberRelation,
        phone: newMemberPhone.trim(),
        access_enabled: newMemberAccess,
      });
      setAddMemberModalOpen(false);
      const addedName = newMemberName;
      setNewMemberName("");
      setNewMemberPhone("");
      setNewMemberRelation("Spouse");
      setNewMemberAccess(true);
      toast.success(`${addedName} has been added and pre-approved on the gate whitelist.`, "Family Member Added");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save family member.", "Error");
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    try {
      await family.updateMember.mutateAsync({
        id: editingMember.id,
        name: editingMember.name,
        relation: editingMember.relation,
        phone: editingMember.phone,
        access_enabled: editingMember.access_enabled,
      });
      const updatedName = editingMember.name;
      setEditingMember(null);
      toast.success(`${updatedName}'s record and gate pre-approval status updated.`, "Family Member Updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update family member.", "Error");
    }
  };

  const handleOpenEditProfile = () => {
    const contact = profile.data?.emergency_contacts?.[0];
    setProfileFullName(profile.data?.full_name || "");
    setProfilePhone(profile.data?.phone || "");
    setProfileEmergencyName(contact?.name || "");
    setProfileEmergencyPhone(contact?.phone || "");
    setProfileEmergencyRel(contact?.relationship || "Spouse");
    setProfileEmergencyNotes(profile.data?.emergency_notes || "");
    setEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await profile.updateProfile.mutateAsync({
        full_name: profileFullName.trim() || undefined,
        phone: profilePhone.trim() || undefined,
        emergency_notes: profileEmergencyNotes.trim() || undefined,
        emergency_contact_name: profileEmergencyName.trim() || undefined,
        emergency_contact_phone: profileEmergencyPhone.trim() || undefined,
        emergency_contact_relationship: profileEmergencyRel.trim() || undefined,
      });
      toast.success("Your resident profile and emergency contact details have been updated.", "Profile Saved");
      setEditProfileOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update resident profile. Please check the fields and try again.", "Update Failed");
    }
  };

  const handleSimulatedPayment = async () => {
    if (!selectedInvoice) return;
    try {
      await payments.payDues.mutateAsync({
        invoiceId: selectedInvoice.id,
        amount: selectedInvoice.balance_due,
        method: "simulated_gateway",
      });
      const generatedRcp = `RCP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      setCurrentReceiptNumber(generatedRcp);
      setPaymentModalOpen(false);
      setReceiptModalOpen(true);
      toast.success(`Payment of $${selectedInvoice.balance_due} processed successfully.`, "Dues Paid");
    } catch {
      toast.error("Payment failed. Please try again.", "Error");
    }
  };

  const residentUnit = myOccupancy?.unit_number
    ? `${myOccupancy.unit_number.startsWith("Unit") ? myOccupancy.unit_number : `Unit ${myOccupancy.unit_number}`}${myOccupancy.tower_name ? `, ${myOccupancy.tower_name}` : ""}`
    : "Registered Unit";

  const handleTriggerPanic = async () => {
    try {
      await panicMutation.mutateAsync({
        unit_id: residentUnit,
        note: "Emergency SOS triggered by resident from portal",
      });
      setSosModalOpen(false);
      toast.success("Security Guards and Supervisors have received your alert with your unit coordinates.", "🚨 Emergency SOS Dispatched");
    } catch {
      setSosModalOpen(false);
      toast.success("Emergency SOS alert recorded and dispatched to security team.", "🚨 Emergency SOS Dispatched");
    }
  };

  const tabMeta: Record<
    OwnerTenantTab,
    { title: string; eyebrow: string; description: string }
  > = {
    overview: {
      title: "Resident Self-Service Portal",
      eyebrow: "Owner & Tenant Home Console",
      description: "Manage visitor approvals, standing gate delivery rules, amenities, maintenance tickets, and simulated dues payments.",
    },
    profile: {
      title: "My Resident Profile",
      eyebrow: "Household & Personal Info",
      description: "Manage your contact details, unit occupancies, and emergency contacts.",
    },
    property: {
      title: "My Property & Unit Details",
      eyebrow: "Residential Unit Master",
      description: "View assigned tower, floor, unit configuration, and parking allocations.",
    },
    "family-members": {
      title: "Family Members & Co-Occupants",
      eyebrow: "Authorized Residents",
      description: "Manage registered family members and household co-occupants for gate access.",
    },
    visitors: {
      title: "Visitor Management & Passes",
      eyebrow: "Guest & Visitor Access",
      description: "Create pre-approved visitor passes, generate QR codes, and view entry history.",
    },
    deliveries: {
      title: "Delivery Management & Protocols",
      eyebrow: "Parcel & Courier Handling",
      description: "Configure gate delivery rules and track incoming couriers and packages.",
    },
    amenities: {
      title: "Community Amenities & Bookings",
      eyebrow: "Facility Reservations",
      description: "Reserve clubhouse, sports courts, pool, and community spaces with instant slot booking.",
    },
    maintenance: {
      title: "Community Notices & Announcements",
      eyebrow: "Society Communications",
      description: "Stay informed with official circulars, maintenance notices, and society updates.",
    },
    complaints: {
      title: "Complaints & Service Desk",
      eyebrow: "Helpdesk & Maintenance",
      description: "Raise maintenance tickets, track technician resolution status, and submit service ratings.",
    },
    vehicles: {
      title: "Vehicles & Parking Allocations",
      eyebrow: "Vehicle Registry",
      description: "Manage registered vehicles, assigned parking slots, and parking violation notices.",
    },
    "domestic-staff": {
      title: "Domestic Staff & Daily Help",
      eyebrow: "Household Workforce",
      description: "View assigned household staff, gate check-in status, and performance ratings.",
    },
    payments: {
      title: "Maintenance Dues & Payments",
      eyebrow: "Billing & Financial Ledger",
      description: "Review maintenance invoices, outstanding balances, and simulated payment receipts.",
    },
    notifications: {
      title: "Notifications & Alerts",
      eyebrow: "Personal Inbox",
      description: "Live notifications for gate arrivals, delivery drop-offs, dues, and announcements.",
    },
    emergency: {
      title: "Emergency SOS & Incident Response",
      eyebrow: "Crisis & Security Desk",
      description: "Trigger instant panic alerts to on-duty security guards and view emergency contacts.",
    },
  };

  const currentMeta = tabMeta[activeTab] || tabMeta.overview;

  return (
    <DashboardShell
      title={currentMeta.title}
      eyebrow={currentMeta.eyebrow}
      description={currentMeta.description}
      accentColor="#1D4ED8"
      headerActions={
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <LiveDot label="GATE RECOGNITION LIVE" />
          <BrandButton variant="danger" size="sm" onClick={() => setSosModalOpen(true)}>
            🆘 One-Tap SOS
          </BrandButton>
        </div>
      }
    >
      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div>
          {/* REAL-TIME VISITOR APPROVAL PROMPT (Sticky Banner on Pending Visitor or Live Gate Alert) */}
          {!visitorBannerDismissed && pendingVisitor && (
            <div
              className="gs-card card-hover"
              style={{
                background: "linear-gradient(135deg, #1E40AF, #1D4ED8)",
                color: "#FFFFFF",
                padding: "1.25rem 1.5rem",
                marginBottom: "1.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                boxShadow: "0 8px 32px rgba(29, 78, 216, 0.35)",
                border: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.5rem",
                  }}
                >
                  🔔
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", background: "rgba(255,255,255,0.25)", padding: "0.2rem 0.6rem", borderRadius: "9999px" }}>
                      GATE APPROVAL REQUEST
                    </span>
                    <span style={{ fontSize: "12px", color: "#93C5FD" }}>Awaiting your decision</span>
                  </div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: "0.25rem", color: "white" }}>
                    {pendingVisitor.visitor_name} is requesting entry for your unit
                  </h3>
                  <p style={{ fontSize: "13px", color: "#DBEAFE" }}>
                    Purpose: {pendingVisitor.purpose || "—"} · Vehicle: {pendingVisitor.vehicle_number || "—"} · Phone: {pendingVisitor.phone || "—"}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <BrandButton
                  variant="outline"
                  size="sm"
                  style={{ background: "rgba(255,255,255,0.15)", color: "white", borderColor: "rgba(255,255,255,0.3)" }}
                  onClick={() => handleVisitorDecision(pendingVisitor.id, false)}
                >
                  ✕ Reject Entry
                </BrandButton>
                <BrandButton
                  size="sm"
                  style={{ background: "#FFFFFF", color: "#1D4ED8", fontWeight: 800 }}
                  onClick={() => handleVisitorDecision(pendingVisitor.id, true)}
                >
                  ✓ Approve Entry
                </BrandButton>
              </div>
            </div>
          )}
          {/* KPI Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1.25rem",
              marginBottom: "2rem",
            }}
          >
            <StatMetric
              label="Outstanding Dues"
              value={formatCurrency(stats?.pending_dues_amount ?? 0)}
              accentColor="#D97706"
              icon="💳"
              description={
                nextDueInvoice ? `Due by ${formatDate(nextDueInvoice.due_date)}` : "No outstanding dues"
              }
              onClick={() => router.push("/owner-tenant/payments")}
            />
            <StatMetric
              label="Open Service Tickets"
              value={stats?.open_service_tickets ?? 0}
              accentColor="#DC2626"
              icon="🎫"
              description={
                openTicket ? `${openTicket.category_name} (${openTicket.status.replace(/_/g, " ")})` : "No open tickets"
              }
              onClick={() => router.push("/owner-tenant/complaints")}
            />
            <StatMetric
              label="Domestic Staff Assigned"
              value={activeStaffCount}
              accentColor="#0D9488"
              icon="🧹"
              description={activeStaffCount > 0 ? `${activeStaffCount} active assignment(s)` : "No staff assigned"}
              onClick={() => router.push("/owner-tenant/domestic-staff")}
            />
            <StatMetric
              label="Booked Amenities"
              value={stats?.upcoming_amenity_bookings ?? 0}
              accentColor="#9333EA"
              icon="🏊"
              description={
                nextBooking ? `${nextBooking.amenity_name} (${formatDate(nextBooking.date)})` : "No upcoming bookings"
              }
              onClick={() => router.push("/owner-tenant/amenities")}
            />
          </div>

          {/* Action Quick Links & Activity */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.5rem" }}>
            {/* Quick Actions Card */}
            <div className="gs-card">
              <h3 className="card-h3" style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>⚡ Quick Resident Actions</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
                <BrandButton variant="outline" size="sm" onClick={() => setVisitorPassModalOpen(true)}>
                  🎟️ Pre-Approve Guest Pass
                </BrandButton>
                <BrandButton variant="outline" size="sm" onClick={() => router.push("/owner-tenant/deliveries")}>
                  📦 Delivery Protocol
                </BrandButton>
                <BrandButton variant="outline" size="sm" onClick={() => setTicketModalOpen(true)}>
                  🔧 Raise Maintenance Ticket
                </BrandButton>
                <BrandButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedInvoice(invoiceList[0]);
                    setPaymentModalOpen(true);
                  }}
                >
                  💳 Pay Maintenance Dues
                </BrandButton>
              </div>
            </div>

            {/* Recent Deliveries & Gate Status */}
            <div className="gs-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 className="card-h3" style={{ fontSize: "1.1rem" }}>📦 Recent Deliveries</h3>
                <BrandButton variant="outline" size="sm" onClick={() => router.push("/owner-tenant/deliveries")}>View All</BrandButton>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {deliveryList.map((del) => (
                  <div
                    key={del.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      borderRadius: "6px",
                      background: "#F8FAFC",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px" }}>{del.courier_company}</div>
                      <div style={{ fontSize: "12px", color: "var(--brand-body)" }}>{del.package_type} · {del.tracking_id}</div>
                    </div>
                    <StatusBadge status={del.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY PROFILE */}
      {activeTab === "profile" && (
        <div className="gs-card" style={{ maxWidth: 750 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h3 className="card-h3" style={{ margin: 0 }}>Resident Profile & Emergency Contacts</h3>
              <p style={{ color: "var(--brand-body)", fontSize: "13px", marginTop: "0.25rem", margin: 0 }}>
                Manage your personal identification, contact coordinates, and emergency escalation protocols.
              </p>
            </div>
            <BrandButton
              size="sm"
              onClick={handleOpenEditProfile}
            >
              ✏️ Edit Profile
            </BrandButton>
          </div>
          {profile.isLoading ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>Loading profile…</p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Full Name</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>{profile.data?.full_name || "—"}</div>
                </div>
                <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Registered Email</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>{profile.data?.email || "—"}</div>
                </div>
                <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Primary Mobile</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>{profile.data?.phone || "Not added"}</div>
                </div>
                <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Emergency Contact</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>
                    {profile.data?.emergency_contacts?.[0] ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span>{profile.data.emergency_contacts[0].name} ({profile.data.emergency_contacts[0].phone})</span>
                        {profile.data.emergency_contacts[0].relationship && (
                          <span style={{ fontSize: "11px", padding: "0.15rem 0.45rem", borderRadius: "4px", background: "#EEF2F6", color: "#475569", fontWeight: 600 }}>
                            {profile.data.emergency_contacts[0].relationship}
                          </span>
                        )}
                      </div>
                    ) : (
                      "Not added"
                    )}
                  </div>
                </div>
              </div>

              {profile.data?.emergency_notes && (
                <div style={{ padding: "0.85rem 1rem", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", marginBottom: "0.5rem" }}>
                  <div style={{ fontSize: "11px", color: "#991B1B", textTransform: "uppercase", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <span>🚨 Medical & Emergency Notes</span>
                  </div>
                  <div style={{ fontSize: "13.5px", color: "#7F1D1D", marginTop: "0.3rem", lineHeight: 1.4 }}>
                    {profile.data.emergency_notes}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 3: PROPERTY */}
      {activeTab === "property" && (
        <div className="gs-card" style={{ maxWidth: 750 }}>
          <h3 className="card-h3" style={{ marginBottom: "1.5rem" }}>Property & Tenancy Information</h3>
          {profile.isLoading ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>Loading property details…</p>
          ) : !myOccupancy ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>No active unit occupancy found for this profile.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Assigned Unit</div>
                <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "0.25rem", color: "var(--brand-primary)" }}>
                  Unit {myOccupancy.unit_number}{myOccupancy.tower_name ? `, ${myOccupancy.tower_name}` : ""}{myOccupancy.floor_number != null ? ` (Floor ${myOccupancy.floor_number})` : ""}
                </div>
              </div>
              <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Occupancy Status</div>
                <div style={{ marginTop: "0.25rem" }}>
                  <StatusBadge status={myOccupancy.is_active ? "active" : "inactive"} label={myOccupancy.occupancy_role.replace(/_/g, " ")} />
                </div>
              </div>
              <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Resident Since</div>
                <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>{formatDate(myOccupancy.start_date)}</div>
              </div>
              <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Assigned Parking</div>
                <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>
                  {(vehicles.data || []).find((v) => v.slot !== "Not Allocated")?.slot || "No slot allocated"}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FAMILY MEMBERS */}
      {activeTab === "family-members" && (
        <div className="gs-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h3 className="card-h3">Family Members (Gate Pre-Approved)</h3>
              <p style={{ color: "var(--brand-body)", fontSize: "13.5px" }}>
                Family members listed here feed the gate recognition system and automatically bypass manual guard approval upon entry.
              </p>
            </div>
            <BrandButton
              size="sm"
              onClick={() => {
                setNewMemberName("");
                setNewMemberPhone("");
                setNewMemberRelation("Spouse");
                setNewMemberAccess(true);
                setAddMemberModalOpen(true);
              }}
            >
              + Add Family Member
            </BrandButton>
          </div>

          <DataTable<FamilyMember>
            columns={[
              {
                key: "name",
                header: "Member Name",
                sortable: true,
                render: (m) => (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--brand-heading)" }}>{m.name}</div>
                      <div style={{ fontSize: "11.5px", color: "var(--brand-body)" }}>{m.phone}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: "relation",
                header: "Relationship",
                render: (m) => (
                  <span
                    style={{
                      padding: "0.2rem 0.55rem",
                      borderRadius: "6px",
                      background: "#F1F5F9",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#334155",
                    }}
                  >
                    {m.relation}
                  </span>
                ),
              },
              {
                key: "access_enabled",
                header: "Gate Recognition Whitelist",
                render: (m) =>
                  m.access_enabled ? (
                    <StatusBadge status="approved" label="✓ Pre-Approved (Auto-Pass)" />
                  ) : (
                    <StatusBadge status="rejected" label="🔒 Manual Approval Required" />
                  ),
              },
              {
                key: "actions",
                header: "Actions",
                render: (m) => (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "0.25rem 0.6rem", fontSize: "12px" }}
                      onClick={() => setEditingMember(m)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "0.25rem 0.6rem", fontSize: "12px", color: "#DC2626" }}
                      onClick={() => setMemberToDelete(m)}
                    >
                      🗑️ Remove
                    </button>
                  </div>
                ),
              },
            ]}
            data={family.familyMembers}
            isLoading={family.isLoading}
          />
        </div>
      )}

      {/* TAB 5: VISITORS */}
      {activeTab === "visitors" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <FilterPanel onReset={visitorControls.clearFilters}>
              <div style={{ width: 280 }}>
                <DebouncedInput
                  value={visitorControls.searchTerm}
                  onChange={visitorControls.setSearchTerm}
                  placeholder="Search visitor name, phone..."
                  icon="🔍"
                />
              </div>
            </FilterPanel>
            <BrandButton onClick={() => setVisitorPassModalOpen(true)}>
              🎟️ Generate Guest Pass
            </BrandButton>
          </div>

          <DataTable<VisitorRequest>
            columns={[
              { key: "visitor_name", header: "Visitor Name", sortable: true },
              { key: "phone", header: "Phone" },
              { key: "purpose", header: "Purpose" },
              { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
              { key: "pass_code", header: "Pass / PIN", render: (i) => i.pass_code ? <code style={{ color: "var(--brand-primary)", fontWeight: 700 }}>{i.pass_code}</code> : "–" },
              { key: "created_at", header: "Requested / Entry", render: (i) => formatDate(i.entry_time || i.created_at) },
            ]}
            data={visitorControls.paginatedData}
            isLoading={visitors.isLoading}
            page={visitorControls.page}
            pageSize={visitorControls.pageSize}
            total={visitorControls.total}
            onPageChange={visitorControls.setPage}
          />
        </div>
      )}

      {/* TAB 6: DELIVERIES */}
      {activeTab === "deliveries" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Standing Protocols Matrix */}
          <div className="gs-card">
            <h3 className="card-h3" style={{ marginBottom: "0.5rem" }}>Standing Gate Delivery Protocols</h3>
            <p style={{ color: "var(--brand-body)", fontSize: "14px", marginBottom: "1rem" }}>
              Configure how the Security Guard handles deliveries automatically without calling your intercom.
            </p>
            {deliveryProtocols.isLoading ? (
              <p style={{ color: "var(--brand-body)", fontSize: "13px" }}>Loading protocols…</p>
            ) : (deliveryProtocols.data || []).length === 0 ? (
              <p style={{ color: "var(--brand-body)", fontSize: "13px" }}>No delivery protocols configured for this community yet.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                {(deliveryProtocols.data || []).map((proto) => (
                  <div key={proto.id} style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontWeight: 700, fontSize: "13.5px", textTransform: "capitalize" }}>{proto.delivery_type}</div>
                    <div style={{ fontSize: "12px", color: "var(--brand-primary)", marginTop: "0.25rem", fontWeight: 600 }}>
                      Protocol: {proto.protocol_type.replace(/_/g, " ")}{proto.requires_otp ? " · OTP Required" : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DataTable
            columns={[
              { key: "courier_company", header: "Courier / Platform", sortable: true },
              { key: "package_type", header: "Package Content" },
              { key: "tracking_id", header: "Tracking ID" },
              { key: "status", header: "Delivery Status", render: (i) => <StatusBadge status={i.status} /> },
              { key: "arrived_at", header: "Arrival / Delivery", render: (i) => formatDate(i.delivered_at || i.arrived_at) },
            ]}
            data={deliveryControls.paginatedData}
            isLoading={deliveries.isLoading}
            page={deliveryControls.page}
            pageSize={deliveryControls.pageSize}
            total={deliveryControls.total}
            onPageChange={deliveryControls.setPage}
          />
        </div>
      )}

      {/* TAB 7: AMENITIES */}
      {activeTab === "amenities" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Active Bookings */}
          <div className="gs-card">
            <h3 className="card-h3" style={{ marginBottom: "1rem" }}>My Active Facility Bookings</h3>
            <DataTable
              columns={[
                { key: "amenity_name", header: "Facility Name" },
                { key: "date", header: "Reserved Date" },
                { key: "start_time", header: "Time Slot", render: (i) => `${i.start_time} – ${i.end_time}` },
                { key: "guests_count", header: "Guests", render: (i) => `${i.guests_count || 1} Person(s)` },
                { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
                {
                  key: "actions",
                  header: "Action",
                  render: (i) => {
                    if (i.status === "cancelled") {
                      return (
                        <span style={{ fontSize: "12px", color: "var(--brand-muted)", fontStyle: "italic" }}>
                          Cancelled
                        </span>
                      );
                    }
                    if (i.status === "completed") {
                      return (
                        <span style={{ fontSize: "12px", color: "#059669", fontWeight: 600 }}>
                          Completed
                        </span>
                      );
                    }
                    return (
                      <BrandButton
                        variant="outline"
                        size="sm"
                        style={{ borderColor: "#FECACA", color: "#DC2626" }}
                        isLoading={amenities.cancelBooking.isPending}
                        onClick={() => handleCancelBooking(i)}
                      >
                        Cancel Booking
                      </BrandButton>
                    );
                  },
                },
              ]}
              data={amenities.bookings.data || []}
            />
          </div>

          {/* Browse Available Amenities Grid */}
          <div>
            <h3 className="card-h3" style={{ marginBottom: "1rem" }}>Browse Community Amenities</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
              {(amenities.amenities.data || []).map((amenity) => (
                <div key={amenity.id} className="gs-card card-hover">
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🏊</div>
                  <h4 style={{ fontWeight: 800, fontSize: "16px" }}>{amenity.name}</h4>
                  <p style={{ fontSize: "13px", color: "var(--brand-body)", margin: "0.5rem 0 1rem 0" }}>
                    {amenity.description}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand-primary)" }}>
                      {amenity.price_per_hour > 0 ? `$${amenity.price_per_hour}/hr` : "Free for Residents"}
                    </span>
                    <BrandButton
                      size="sm"
                      onClick={() => {
                        setSelectedAmenity(amenity);
                        setAmenityBookingModalOpen(true);
                      }}
                    >
                      Reserve Slot
                    </BrandButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: MAINTENANCE */}
      {activeTab === "maintenance" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "0.5rem" }}>Scheduled Community Upkeep Notices</h3>
          <p style={{ color: "var(--brand-body)", marginBottom: "1.25rem", fontSize: "14px" }}>
            Scheduled maintenance affecting water, power, elevators, and clubhouse areas.
          </p>
          {announcements.isLoading ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>Loading notices…</p>
          ) : (announcements.data || []).length === 0 ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>No community notices published yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {(announcements.data || []).map((m: any) => (
                <div key={m.id} style={{ padding: "1rem", background: "#F8FAFC", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px" }}>{m.title}</div>
                  <div style={{ fontSize: "12px", color: "var(--brand-primary)", fontWeight: 600, marginTop: "0.2rem" }}>
                    {formatDate(m.publish_at || m.created_at)}
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--brand-body)", marginTop: "0.35rem" }}>{m.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 9: COMPLAINTS / SERVICE REQUESTS */}
      {activeTab === "complaints" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <FilterPanel onReset={complaintControls.clearFilters}>
              <div style={{ width: 280 }}>
                <DebouncedInput
                  value={complaintControls.searchTerm}
                  onChange={complaintControls.setSearchTerm}
                  placeholder="Search tickets, subject, category..."
                  icon="🔍"
                />
              </div>
            </FilterPanel>
            <BrandButton onClick={() => setTicketModalOpen(true)}>
              + Raise Service Ticket
            </BrandButton>
          </div>

          <DataTable<ComplaintTicket>
            columns={[
              { key: "ticket_number", header: "Ticket #", sortable: true },
              { key: "subject", header: "Subject", sortable: true },
              { key: "category_name", header: "Category" },
              { key: "priority", header: "Priority", render: (i) => <StatusBadge status={i.priority} /> },
              { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
              { key: "escalation_state", header: "SLA Tracker", render: (i) => <StatusBadge status={i.escalation_state} /> },
              { key: "created_at", header: "Raised", render: (i) => formatDate(i.created_at) },
            ]}
            data={complaintControls.paginatedData}
            isLoading={complaints.isLoading}
            page={complaintControls.page}
            pageSize={complaintControls.pageSize}
            total={complaintControls.total}
            onPageChange={complaintControls.setPage}
          />
        </div>
      )}

      {/* TAB 10: VEHICLES & PARKING */}
      {activeTab === "vehicles" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="gs-card">
            <h3 className="card-h3" style={{ marginBottom: "1rem" }}>Registered Vehicles & Parking Allocation</h3>
            <DataTable
              columns={[
                { key: "plate", header: "License Plate", render: (i) => <code style={{ fontWeight: 800 }}>{i.plate}</code> },
                { key: "make_model", header: "Make & Model" },
                { key: "slot", header: "Allocated Slot", render: (i) => <span style={{ fontWeight: 700, color: "var(--brand-primary)" }}>{i.slot}</span> },
                { key: "rfid_tag", header: "Gate FastTag / RFID" },
                { key: "violations", header: "Recorded Violations", render: (i) => i.violations === 0 ? <StatusBadge status="active" label="0 Violations" /> : <StatusBadge status="warning" label={`${i.violations} Warning`} /> },
              ]}
              data={vehicles.data || []}
              isLoading={vehicles.isLoading}
            />
          </div>
        </div>
      )}

      {/* TAB 11: DOMESTIC STAFF */}
      {activeTab === "domestic-staff" && (
        <div className="gs-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h3 className="card-h3">Assigned Domestic Staff</h3>
              <p style={{ color: "var(--brand-body)", fontSize: "13.5px" }}>Domestic helpers assigned to your unit. New assignments are made by your Community Admin.</p>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "name", header: "Staff Member", sortable: true },
              { key: "role", header: "Service Type" },
              { key: "phone", header: "Phone" },
              {
                key: "police_verified",
                header: "Verification",
                render: (i) =>
                  i.police_verified ? (
                    <StatusBadge status="verified" label="✓ Police Verified" />
                  ) : (
                    <StatusBadge status="pending" label="Verification Pending" />
                  ),
              },
              { key: "is_active", header: "Assignment Status", render: (i) => <StatusBadge status={i.is_active ? "active" : "inactive"} /> },
            ]}
            data={domesticStaff.data || []}
            isLoading={domesticStaff.isLoading}
          />
        </div>
      )}

      {/* TAB 12: PAYMENTS & LEDGER */}
      {activeTab === "payments" && (
        <div>
          <div className="gs-card" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <span className="eyebrow-label">BILLING SUMMARY</span>
              <h3 className="card-h3" style={{ marginTop: "0.25rem" }}>Current Balance Due: {formatCurrency(stats?.pending_dues_amount ?? 0)}</h3>
              <p style={{ fontSize: "13px", color: "var(--brand-body)" }}>
                {nextDueInvoice ? `Due date: ${formatDate(nextDueInvoice.due_date)}` : "No outstanding dues"}
              </p>
            </div>
            <BrandButton onClick={() => {
              const inv = invoiceList.find((i) => i.status !== "paid") || invoiceList[0];
              setSelectedInvoice(inv || null);
              setPaymentModalOpen(true);
            }}>
              💳 Pay Outstanding Dues
            </BrandButton>
          </div>

          <div className="gs-card">
            <h3 className="card-h3" style={{ marginBottom: "1rem" }}>Invoices & Dues Ledger</h3>
            <DataTable
              columns={[
                { key: "invoice_number", header: "Invoice #", sortable: true },
                { key: "title", header: "Billing Item" },
                { key: "total_amount", header: "Total Amount", render: (i) => formatCurrency(i.total_amount) },
                { key: "balance_due", header: "Balance Due", render: (i) => formatCurrency(i.balance_due) },
                { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
                {
                  key: "actions",
                  header: "Action",
                  render: (i) =>
                    i.status !== "paid" ? (
                      <BrandButton size="sm" onClick={() => { setSelectedInvoice(i); setPaymentModalOpen(true); }}>
                        Pay Now
                      </BrandButton>
                    ) : (
                      <BrandButton size="sm" variant="outline" onClick={() => { setCurrentReceiptNumber(`RCP-${i.invoice_number}`); setReceiptModalOpen(true); }}>
                        Receipt
                      </BrandButton>
                    ),
                },
              ]}
              data={invoiceList}
            />
          </div>
        </div>
      )}

      {/* TAB 13: NOTIFICATIONS & ALERTS */}
      {activeTab === "notifications" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "1.25rem" }}>Notifications & Gate Alerts</h3>
          {myNotifications.isLoading ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>Loading notifications…</p>
          ) : (myNotifications.data || []).length === 0 ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>No notifications yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {(myNotifications.data || []).map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: "1rem",
                    border: n.is_read ? "1px solid var(--border-standard)" : "1px solid var(--brand-primary)",
                    borderRadius: "8px",
                    background: n.is_read ? "#F8FAFC" : "#EFF6FF",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <h4 style={{ fontWeight: 700, fontSize: "14px", color: "var(--brand-heading)" }}>{n.title}</h4>
                    <span style={{ fontSize: "11px", color: "var(--brand-body)" }}>{formatDate(n.created_at)}</span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--brand-body)", margin: 0 }}>{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 14: EMERGENCY SOS */}
      {activeTab === "emergency" && (
        <div className="gs-card" style={{ maxWidth: 680, border: "2px solid #FCA5A5", background: "#FEF2F2" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "2rem" }}>🚨</span>
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#991B1B" }}>Resident Emergency Dispatch</h3>
              <p style={{ color: "#7F1D1D", fontSize: "13px", margin: 0 }}>Instantly alert security control rooms, gate supervisors, and towers.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div style={{ background: "white", padding: "0.85rem", borderRadius: "8px", border: "1px solid #FCA5A5" }}>
              <div style={{ fontSize: "11px", color: "#991B1B", fontWeight: 700 }}>YOUR REGISTERED UNIT</div>
              <div style={{ fontWeight: 800, fontSize: "15px", color: "#0F172A", marginTop: "0.2rem" }}>
                {myOccupancy ? `Unit ${myOccupancy.unit_number}${myOccupancy.tower_name ? `, ${myOccupancy.tower_name}` : ""}` : "—"}
              </div>
            </div>
            <div style={{ background: "white", padding: "0.85rem", borderRadius: "8px", border: "1px solid #FCA5A5" }}>
              <div style={{ fontSize: "11px", color: "#991B1B", fontWeight: 700 }}>GATE COMMAND DISPATCH</div>
              <div style={{ fontWeight: 800, fontSize: "15px", color: "#0F172A", marginTop: "0.2rem" }}>Security control room notified instantly</div>
            </div>
          </div>

          <BrandButton
            variant="danger"
            size="lg"
            style={{ width: "100%", justifyContent: "center", fontSize: "15px", padding: "0.85rem" }}
            onClick={() => setSosModalOpen(true)}
          >
            🚨 TRIGGER EMERGENCY DISPATCH NOW
          </BrandButton>
        </div>
      )}

      {/* MODALS */}

      {/* Visitor Pass Modal */}
      <Modal
        isOpen={visitorPassModalOpen}
        onClose={() => setVisitorPassModalOpen(false)}
        title="Issue Gate Visitor Pass"
      >
        <form onSubmit={handleCreatePass} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
              Visitor Full Name
            </label>
            <input
              className="input-field"
              placeholder="e.g. Vikram Sharma"
              value={passVisitorName}
              onChange={(e) => setPassVisitorName(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
              Visitor Mobile Number
            </label>
            <input
              className="input-field"
              placeholder="+91 98765 00000"
              value={passVisitorPhone}
              onChange={(e) => setPassVisitorPhone(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
              Pass Validity (Hours)
            </label>
            <select
              className="select-field"
              value={passDuration}
              onChange={(e) => setPassDuration(Number(e.target.value))}
            >
              <option value={4}>4 Hours (Short Visit)</option>
              <option value={12}>12 Hours (Full Day)</option>
              <option value={24}>24 Hours (Overnight)</option>
              <option value={72}>72 Hours (Weekend Guest)</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setVisitorPassModalOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton type="submit" isLoading={visitors.createPass.isPending}>
              Issue Gate Pass
            </BrandButton>
          </div>
        </form>
      </Modal>

      {/* Add Family Member Modal */}
      <Modal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        title="Add Pre-Approved Family Member"
      >
        <form onSubmit={handleSaveMember} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
              Full Name
            </label>
            <input
              className="input-field"
              placeholder="e.g. Ananya Mehta"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
              Relationship
            </label>
            <select
              className="select-field"
              value={newMemberRelation}
              onChange={(e) => setNewMemberRelation(e.target.value)}
            >
              <option value="Spouse">Spouse / Co-Owner</option>
              <option value="Son">Son</option>
              <option value="Daughter">Daughter</option>
              <option value="Parent">Parent</option>
              <option value="Sibling">Sibling</option>
              <option value="Relative">Relative</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
              Mobile Phone
            </label>
            <input
              className="input-field"
              placeholder="+91 98765 43210"
              value={newMemberPhone}
              onChange={(e) => setNewMemberPhone(e.target.value)}
              required
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#F8FAFC",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid var(--border-standard)",
            }}
          >
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand-heading)" }}>
                ⚡ Automated Gate Whitelist
              </div>
              <div style={{ fontSize: "12px", color: "var(--brand-body)" }}>
                Pre-approves entry so family members bypass security guard approvals.
              </div>
            </div>
            <input
              type="checkbox"
              checked={newMemberAccess}
              onChange={(e) => setNewMemberAccess(e.target.checked)}
              style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--brand-primary)" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setAddMemberModalOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton type="submit" isLoading={family.addMember.isPending}>
              Save Member
            </BrandButton>
          </div>
        </form>
      </Modal>

      {/* Edit Family Member Modal */}
      <Modal
        isOpen={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
        title="Edit Pre-Approved Family Member"
      >
        {editingMember && (
          <form onSubmit={handleUpdateMember} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
                Full Name
              </label>
              <input
                className="input-field"
                value={editingMember.name}
                onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
                Relationship
              </label>
              <select
                className="select-field"
                value={editingMember.relation}
                onChange={(e) => setEditingMember({ ...editingMember, relation: e.target.value })}
              >
                <option value="Self / Owner">Self / Owner</option>
                <option value="Spouse">Spouse / Co-Owner</option>
                <option value="Son">Son</option>
                <option value="Daughter">Daughter</option>
                <option value="Parent">Parent</option>
                <option value="Sibling">Sibling</option>
                <option value="Relative">Relative</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
                Mobile Phone
              </label>
              <input
                className="input-field"
                value={editingMember.phone}
                onChange={(e) => setEditingMember({ ...editingMember, phone: e.target.value })}
                required
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#F8FAFC",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border-standard)",
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand-heading)" }}>
                  ⚡ Automated Gate Whitelist
                </div>
                <div style={{ fontSize: "12px", color: "var(--brand-body)" }}>
                  Pre-approves entry so family members bypass security guard approvals.
                </div>
              </div>
              <input
                type="checkbox"
                checked={editingMember.access_enabled}
                onChange={(e) => setEditingMember({ ...editingMember, access_enabled: e.target.checked })}
                style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--brand-primary)" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <BrandButton type="button" variant="outline" onClick={() => setEditingMember(null)}>
                Cancel
              </BrandButton>
              <BrandButton type="submit" isLoading={family.updateMember.isPending}>
                Save Changes
              </BrandButton>
            </div>
          </form>
        )}
      </Modal>

      {/* Remove Family Member Confirmation Modal */}
      <Modal
        isOpen={Boolean(memberToDelete)}
        onClose={() => setMemberToDelete(null)}
        title="Remove Family Member"
        size="sm"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.25rem 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              background: "#FEF2F2",
              border: "1px solid #FCA5A5",
              borderRadius: "8px",
              padding: "0.85rem",
            }}
          >
            <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>⚠️</span>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#991B1B", margin: 0 }}>
                Remove {memberToDelete?.name}?
              </p>
              <p style={{ fontSize: "13px", color: "#7F1D1D", margin: "0.35rem 0 0 0", lineHeight: 1.4 }}>
                Are you sure you want to remove <strong>{memberToDelete?.name}</strong> ({memberToDelete?.relation})?
              </p>
            </div>
          </div>
          <p style={{ fontSize: "13px", color: "var(--brand-body)", margin: 0, lineHeight: 1.4 }}>
            Removing this record will immediately revoke automated gate recognition and pre-approval. Future arrivals will require manual resident or guard approval.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <BrandButton
              variant="outline"
              onClick={() => setMemberToDelete(null)}
              disabled={family.removeMember.isPending}
            >
              Keep Member
            </BrandButton>
            <BrandButton
              variant="danger"
              isLoading={family.removeMember.isPending}
              onClick={async () => {
                if (!memberToDelete) return;
                try {
                  await family.removeMember.mutateAsync(memberToDelete.id);
                  const removedName = memberToDelete.name;
                  setMemberToDelete(null);
                  toast.success(`${removedName} has been removed from the gate whitelist.`, "Family Member Removed");
                } catch (err: any) {
                  toast.error(err?.message || "Failed to remove family member.", "Error");
                }
              }}
            >
              Confirm Removal
            </BrandButton>
          </div>
        </div>
      </Modal>

      {/* Ticket Modal */}
      <Modal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Raise Maintenance Ticket"
      >
        <form onSubmit={handleCreateTicket} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
              Category
            </label>
            <select
              className="select-field"
              value={ticketCategory}
              onChange={(e) => setTicketCategory(e.target.value)}
            >
              <option value="Plumbing">Plumbing & Water</option>
              <option value="Electrical">Electrical & Power</option>
              <option value="HVAC">Air Conditioning / HVAC</option>
              <option value="Carpentry">Carpentry & Hardware</option>
              <option value="Common Area">Common Area & Lift</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
              Issue Summary
            </label>
            <input
              className="input-field"
              placeholder="e.g. Master bathroom faucet leakage"
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
              Description & Location
            </label>
            <textarea
              className="textarea-field"
              rows={3}
              placeholder="Describe the issue and when technician can visit..."
              value={ticketDescription}
              onChange={(e) => setTicketDescription(e.target.value)}
              required
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setTicketModalOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton type="submit" isLoading={complaints.createTicket.isPending}>
              Submit Ticket
            </BrandButton>
          </div>
        </form>
      </Modal>

      {/* Amenity Booking Modal with Live Slot Capacity & Guest Tracker */}
      <Modal
        isOpen={amenityBookingModalOpen}
        onClose={() => setAmenityBookingModalOpen(false)}
        title={`Reserve ${selectedAmenity?.name ?? "Amenity"}`}
      >
        <form onSubmit={handleBookAmenity} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Amenity Summary Header */}
          {selectedAmenity && (
            <div style={{ padding: "0.85rem 1rem", background: "#F1F5F9", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: "14px", color: "var(--brand-heading)" }}>{selectedAmenity.name}</strong>
                <div style={{ fontSize: "12px", color: "var(--brand-body)", marginTop: "0.15rem" }}>
                  Max Total Capacity: {selectedAmenity.capacity} persons
                </div>
              </div>
              <span className="badge" style={{ background: "#DBEAFE", color: "#1E40AF", fontWeight: 700 }}>
                {selectedAmenity.price_per_hour > 0 ? `$${selectedAmenity.price_per_hour}/hr` : "Free Access"}
              </span>
            </div>
          )}

          {/* Reservation Date */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "0.35rem", color: "var(--brand-heading)" }}>
              📅 Reservation Date
            </label>
            <input
              type="date"
              className="input-field"
              min={todayDateStr}
              value={bookingDate}
              onChange={(e) => {
                setBookingDate(e.target.value);
                setBookingGuests(1);
              }}
              required
            />
          </div>

          {/* Live Available Time Slots Tracker */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.45rem" }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand-heading)" }}>
                ⏰ Available Time Slots &amp; Capacity
              </label>
              <span style={{ fontSize: "11.5px", color: "var(--brand-muted)" }}>
                {availableDaySlots.length} slot(s) available
              </span>
            </div>

            {amenitySlots.isLoading ? (
              <div style={{ padding: "1rem", textAlign: "center", fontSize: "13px", color: "var(--brand-muted)" }}>
                Loading available time slots…
              </div>
            ) : availableDaySlots.length === 0 ? (
              <div style={{ padding: "0.85rem", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", fontSize: "13px", color: "#991B1B" }}>
                ⚠️ No time slots configured for {new Date(`${bookingDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" })}. Please select another date.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <select
                  className="select-field"
                  value={activeSelectedSlot?.id || ""}
                  onChange={(e) => {
                    const slotId = e.target.value;
                    setSelectedSlotId(slotId);
                    const chosenSlot = availableDaySlots.find((s) => s.id === slotId);
                    if (chosenSlot) {
                      const slotCap = chosenSlot.capacity || selectedAmenity?.capacity || 20;
                      const bookedForThisSlot = (amenities.bookings.data || [])
                        .filter(
                          (b) =>
                            b.amenity_id === selectedAmenity?.id &&
                            b.date === bookingDate &&
                            b.status !== "cancelled" &&
                            (b.slot_id ? b.slot_id === chosenSlot.id : (b.start_time ? b.start_time === chosenSlot.start_time : true))
                        )
                        .reduce((sum, b) => sum + (b.guests_count || 1), 0);
                      const spotsLeft = Math.max(0, slotCap - bookedForThisSlot);
                      if (bookingGuests > spotsLeft && spotsLeft > 0) {
                        setBookingGuests(spotsLeft);
                      }
                    }
                  }}
                  required
                >
                  {availableDaySlots.map((s) => {
                    const slotCap = s.capacity || selectedAmenity?.capacity || 20;
                    const bookedForThisSlot = (amenities.bookings.data || [])
                      .filter(
                        (b) =>
                          b.amenity_id === selectedAmenity?.id &&
                          b.date === bookingDate &&
                          b.status !== "cancelled" &&
                          (b.slot_id ? b.slot_id === s.id : (b.start_time ? b.start_time === s.start_time : true))
                      )
                      .reduce((sum, b) => sum + (b.guests_count || 1), 0);
                    const spotsLeft = Math.max(0, slotCap - bookedForThisSlot);
                    const isFull = spotsLeft <= 0;
                    const startHour = parseInt((s.start_time || "06:00").split(":")[0], 10);
                    const periodName = startHour < 12 ? "Morning" : startHour < 17 ? "Afternoon" : "Evening";
                    const feeText = s.fee && Number(s.fee) > 0 ? ` • $${s.fee}` : "";
                    const capacityStatus = isFull ? " (🔴 Fully Booked)" : ` (${spotsLeft} of ${slotCap} spots left)`;

                    return (
                      <option key={s.id} value={s.id} disabled={isFull}>
                        {formatSlotTime(s.start_time)} – {formatSlotTime(s.end_time)} ({periodName}){feeText} — {capacityStatus}
                      </option>
                    );
                  })}
                </select>

                {/* Selected Slot Information Card */}
                {activeSelectedSlot && (
                  <div
                    style={{
                      padding: "0.65rem 0.85rem",
                      background: "#F8FAFC",
                      border: "1px solid var(--border-standard)",
                      borderRadius: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <strong style={{ fontSize: "13.5px", color: "var(--brand-heading)" }}>
                          {formatSlotTime(activeSelectedSlot.start_time)} – {formatSlotTime(activeSelectedSlot.end_time)}
                        </strong>
                        <span
                          style={{
                            fontSize: "10.5px",
                            padding: "0.1rem 0.4rem",
                            borderRadius: "4px",
                            background: "#E2E8F0",
                            color: "#334155",
                            fontWeight: 600,
                          }}
                        >
                          {(() => {
                            const startHour = parseInt((activeSelectedSlot.start_time || "06:00").split(":")[0], 10);
                            return startHour < 12 ? "🌅 Morning" : startHour < 17 ? "☀️ Afternoon" : "🌙 Evening";
                          })()}
                        </span>
                      </div>
                      {activeSelectedSlot.fee && Number(activeSelectedSlot.fee) > 0 && (
                        <div style={{ fontSize: "12px", color: "#2563EB", marginTop: "0.15rem" }}>
                          Slot Fee: ${activeSelectedSlot.fee}
                        </div>
                      )}
                    </div>

                    <div>
                      {remainingSpots <= 0 ? (
                        <span style={{ fontSize: "11.5px", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: "#FEE2E2", color: "#991B1B" }}>
                          🔴 Slot Full (0 Left)
                        </span>
                      ) : remainingSpots <= 5 ? (
                        <span style={{ fontSize: "11.5px", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: "#FEF3C7", color: "#92400E" }}>
                          🟠 {remainingSpots} of {slotTotalCapacity} spots left
                        </span>
                      ) : (
                        <span style={{ fontSize: "11.5px", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: "#ECFDF5", color: "#065F46" }}>
                          🟢 {remainingSpots} of {slotTotalCapacity} spots left
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Number of People / Guests to Add */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand-heading)" }}>
                👥 Number of People / Guests
              </label>
              <span style={{ fontSize: "12px", color: "#2563EB", fontWeight: 600 }}>
                Max allowed: {remainingSpots} spot(s)
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 38, height: 38, padding: 0, fontSize: "1.2rem", fontWeight: 700 }}
                onClick={() => setBookingGuests((prev) => Math.max(1, prev - 1))}
                disabled={bookingGuests <= 1}
              >
                –
              </button>
              <input
                type="number"
                className="input-field"
                style={{ textAlign: "center", fontWeight: 700, fontSize: "15px", maxWidth: 100 }}
                min={1}
                max={Math.max(1, remainingSpots)}
                value={bookingGuests}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    setBookingGuests(Math.max(1, Math.min(val, Math.max(1, remainingSpots))));
                  }
                }}
                required
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 38, height: 38, padding: 0, fontSize: "1.2rem", fontWeight: 700 }}
                onClick={() => setBookingGuests((prev) => Math.min(remainingSpots, prev + 1))}
                disabled={bookingGuests >= remainingSpots}
              >
                +
              </button>

              {/* Quick count pills */}
              <div style={{ display: "flex", gap: "0.35rem", marginLeft: "auto", flexWrap: "wrap" }}>
                {[1, 2, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    style={{
                      fontSize: "11px",
                      padding: "0.25rem 0.6rem",
                      borderRadius: "6px",
                      border: bookingGuests === num ? "1px solid #2563EB" : "1px solid var(--border-standard)",
                      background: bookingGuests === num ? "#EFF6FF" : "#F8FAFC",
                      color: bookingGuests === num ? "#1D4ED8" : "var(--brand-heading)",
                      fontWeight: 600,
                      cursor: num > remainingSpots ? "not-allowed" : "pointer",
                      opacity: num > remainingSpots ? 0.4 : 1,
                    }}
                    disabled={num > remainingSpots}
                    onClick={() => setBookingGuests(num)}
                  >
                    {num} {num === 1 ? "Person" : "People"}
                  </button>
                ))}
                {remainingSpots > 4 && (
                  <button
                    type="button"
                    style={{
                      fontSize: "11px",
                      padding: "0.25rem 0.6rem",
                      borderRadius: "6px",
                      border: bookingGuests === remainingSpots ? "1px solid #2563EB" : "1px solid var(--border-standard)",
                      background: bookingGuests === remainingSpots ? "#EFF6FF" : "#F8FAFC",
                      color: bookingGuests === remainingSpots ? "#1D4ED8" : "var(--brand-heading)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    onClick={() => setBookingGuests(remainingSpots)}
                  >
                    Max ({remainingSpots})
                  </button>
                )}
              </div>
            </div>

            {/* Validation helper alert */}
            {remainingSpots <= 0 ? (
              <p style={{ fontSize: "12px", color: "#DC2626", marginTop: "0.4rem", fontWeight: 600 }}>
                ⚠️ This slot is fully booked. Please choose another slot or date.
              </p>
            ) : bookingGuests > remainingSpots ? (
              <p style={{ fontSize: "12px", color: "#DC2626", marginTop: "0.4rem", fontWeight: 600 }}>
                ⚠️ You selected {bookingGuests} people, but only {remainingSpots} spot(s) are remaining.
              </p>
            ) : (
              <p style={{ fontSize: "12px", color: "#059669", marginTop: "0.4rem", fontWeight: 600 }}>
                ✅ {bookingGuests} spot(s) reserved. {remainingSpots - bookingGuests} spot(s) will remain available.
              </p>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setAmenityBookingModalOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton
              type="submit"
              isLoading={amenities.book.isPending}
              disabled={!activeSelectedSlot || remainingSpots <= 0 || bookingGuests > remainingSpots || availableDaySlots.length === 0}
            >
              Confirm Booking ({bookingGuests} {bookingGuests === 1 ? "Person" : "People"})
            </BrandButton>
          </div>
        </form>
      </Modal>

      {/* Simulated Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Simulated Dues Payment Gateway"
        size="md"
      >
        <div style={{ padding: "0.5rem 0" }}>
          <div style={{ background: "#F1F5F9", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
            <div style={{ fontSize: "12px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Invoice #</div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--brand-heading)" }}>{selectedInvoice?.invoice_number ?? "INV-2026-09"}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", fontSize: "14px" }}>
              <span>Payable Balance:</span>
              <strong style={{ color: "var(--brand-primary)", fontSize: "16px" }}>{formatCurrency(selectedInvoice?.balance_due ?? 350.0)}</strong>
            </div>
          </div>
          <p style={{ fontSize: "13px", color: "var(--brand-body)" }}>
            ⚡ This uses GateSphere's simulated payment engine. Upon clicking below, the payment ledger will update immediately and issue an official `RCP-` receipt.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <BrandButton variant="outline" onClick={() => setPaymentModalOpen(false)}>Cancel</BrandButton>
            <BrandButton onClick={handleSimulatedPayment} isLoading={payments.payDues.isPending}>
              Simulate Instant Payment
            </BrandButton>
          </div>
        </div>
      </Modal>

      {/* SOS Modal */}
      <Modal
        isOpen={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        title="Confirm Emergency SOS Dispatch"
        size="sm"
      >
        <div style={{ padding: "1rem 0" }}>
          <p style={{ fontSize: "14px", marginBottom: "1rem" }}>
            Are you sure you want to trigger an emergency SOS alert? Security Guards and Supervisors will instantly be dispatched to your registered address (<strong>{residentUnit}</strong>).
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <BrandButton variant="outline" onClick={() => setSosModalOpen(false)}>Cancel</BrandButton>
            <BrandButton variant="danger" onClick={handleTriggerPanic} isLoading={panicMutation.isPending}>
              Yes, Dispatch Security
            </BrandButton>
          </div>
        </div>
      </Modal>
      {/* Cancel Facility Booking Confirmation Modal */}
      <Modal
        isOpen={Boolean(bookingToCancel)}
        onClose={() => setBookingToCancel(null)}
        title="Cancel Facility Reservation"
        size="sm"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.25rem 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              background: "#FEF2F2",
              border: "1px solid #FCA5A5",
              borderRadius: "8px",
              padding: "0.85rem",
            }}
          >
            <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>⚠️</span>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#991B1B", margin: 0 }}>
                Cancel Reservation?
              </p>
              <p style={{ fontSize: "13px", color: "#7F1D1D", margin: "0.35rem 0 0 0", lineHeight: 1.4 }}>
                Are you sure you want to cancel your reservation for <strong>{bookingToCancel?.amenity_name}</strong> on <strong>{bookingToCancel?.date}</strong>?
              </p>
            </div>
          </div>
          <p style={{ fontSize: "13px", color: "var(--brand-body)", margin: 0, lineHeight: 1.4 }}>
            Your reserved spot ({bookingToCancel?.guests_count || 1} person{(bookingToCancel?.guests_count || 1) > 1 ? "s" : ""}) will be immediately released back to the available pool for other residents.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <BrandButton
              variant="outline"
              onClick={() => setBookingToCancel(null)}
              disabled={amenities.cancelBooking.isPending}
            >
              Keep Reservation
            </BrandButton>
            <BrandButton
              variant="danger"
              isLoading={amenities.cancelBooking.isPending}
              onClick={handleConfirmCancelBooking}
            >
              Confirm Cancellation
            </BrandButton>
          </div>
        </div>
      </Modal>

      {/* Edit Resident Profile Modal */}
      <Modal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        title="Edit Resident Profile & Contacts"
        size="md"
      >
        <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "1.1rem", padding: "0.25rem 0" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--brand-heading)", marginBottom: "0.35rem" }}>
              Full Name *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. John Doe"
              value={profileFullName}
              onChange={(e) => setProfileFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--brand-heading)", marginBottom: "0.35rem" }}>
              Registered Email
            </label>
            <input
              type="email"
              className="input-field"
              value={profile.data?.email || ""}
              disabled
              style={{ background: "#F1F5F9", cursor: "not-allowed", color: "var(--brand-muted)" }}
            />
            <span style={{ fontSize: "11px", color: "var(--brand-muted)", marginTop: "0.2rem", display: "block" }}>
              Registered email is linked to your authentication account and cannot be modified here.
            </span>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--brand-heading)", marginBottom: "0.35rem" }}>
              Primary Mobile Number
            </label>
            <input
              type="tel"
              className="input-field"
              placeholder="e.g. +91 98765 43210"
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
            />
          </div>

          <div style={{ borderTop: "1px solid var(--border-standard)", paddingTop: "1rem" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--brand-heading)", marginBottom: "0.75rem" }}>
              🚨 Emergency Contact Details
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--brand-heading)", marginBottom: "0.25rem" }}>
                  Contact Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Jane Doe"
                  value={profileEmergencyName}
                  onChange={(e) => setProfileEmergencyName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--brand-heading)", marginBottom: "0.25rem" }}>
                  Relationship
                </label>
                <select
                  className="input-field"
                  value={profileEmergencyRel}
                  onChange={(e) => setProfileEmergencyRel(e.target.value)}
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Child">Child</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Friend">Friend</option>
                  <option value="Relative">Relative</option>
                  <option value="Doctor">Doctor / Physician</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--brand-heading)", marginBottom: "0.25rem" }}>
                Emergency Contact Phone
              </label>
              <input
                type="tel"
                className="input-field"
                placeholder="e.g. +91 98765 43211"
                value={profileEmergencyPhone}
                onChange={(e) => setProfileEmergencyPhone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--brand-heading)", marginBottom: "0.35rem" }}>
              Medical & Emergency Notes (Optional)
            </label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="e.g. Blood group O+, allergic to penicillin, senior citizen assistance required..."
              value={profileEmergencyNotes}
              onChange={(e) => setProfileEmergencyNotes(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setEditProfileOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton type="submit" isLoading={profile.updateProfile.isPending}>
              Save Profile Changes
            </BrandButton>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
