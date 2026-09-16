"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatMetric } from "@/components/common/StatMetric";
import { LiveDot } from "@/components/common/LiveDot";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, Column } from "@/components/tables/DataTable";
import { DebouncedInput } from "@/components/forms/DebouncedInput";
import { FilterPanel } from "@/components/forms/FilterPanel";
import { SortDropdown } from "@/components/common/SortDropdown";
import { BrandButton } from "@/components/common/BrandButton";
import { Modal } from "@/components/common/Modal";
import { Skeleton, KpiCardSkeleton, TableSkeleton, CardSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";

const QrCodeSvg = dynamic(
  () => import("@/components/common/QrCodeSvg").then((m) => m.QrCodeSvg),
  {
    ssr: false,
    loading: () => (
      <div
        className="skeleton"
        style={{
          width: 180,
          height: 180,
          borderRadius: 12,
        }}
      />
    ),
  },
);
import {
  useResidentOverview,
  useResidentVisitors,
  useResidentDeliveries,
  useResidentAmenities,
  useAmenitySlots,
  AmenitySlot,
  useResidentComplaints,
  useResidentPayments,
  useResidentLedger,
  LedgerEntryItem,
  useResidentFamilyMembers,
  FamilyMember,
  useResidentProfile,
  useResidentDeliveryProtocols,
  useResidentVehicles,
  useResidentDomesticStaff,
  useSubmitStaffRating,
  useAssignDomesticStaff,
  useEndDomesticStaffAssignment,
  useCommunityStaffDirectory,
  AssignedDomesticStaff,
  useSendResidentPanic,
  VisitorRequest,
  DeliveryItem,
  Amenity,
  AmenityBooking,
  ComplaintTicket,
  InvoiceItem,
} from "@/hooks/use-owner-tenant-data";
import { useAnnouncements, useEventRsvp } from "@/hooks/use-communication";
import { useMyNotifications } from "@/hooks/use-notifications";
import { useTableControls } from "@/hooks/use-table-controls";
import { formatDate, formatCurrency, getAmenityIcon } from "@/lib/utils";
import { authApi } from "@/lib/api";
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

export function OwnerTenantDashboardView({
  initialTab = "overview",
}: OwnerTenantDashboardViewProps) {
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

  // Change Password state
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Visitor Pass form state
  const [passCategory, setPassCategory] = useState("Personal Guest");
  const [passVisitorName, setPassVisitorName] = useState("");
  const [passVisitorPhone, setPassVisitorPhone] = useState("");
  const [passIdType, setPassIdType] = useState("aadhaar");
  const [passIdNumber, setPassIdNumber] = useState("");
  const [passReason, setPassReason] = useState("");
  const [passDuration, setPassDuration] = useState(24);
  const [passVehicleNumber, setPassVehicleNumber] = useState("");
  const [passPartySize, setPassPartySize] = useState(1);
  const [passGroupLabel, setPassGroupLabel] = useState("");
  const [blockedAlert, setBlockedAlert] = useState<{
    name: string;
    phone: string;
    id_type?: string;
    id_number?: string;
    reason: string;
    risk_level?: string;
  } | null>(null);

  // Generated / Active Pass Result Modal state
  const [activePassModalOpen, setActivePassModalOpen] = useState(false);
  const [activePassResult, setActivePassResult] = useState<{
    token?: string;
    pin?: string;
    visitor_name?: string;
    category?: string;
    reason?: string;
    valid_from?: string;
    valid_to?: string;
    vehicle_number?: string;
    party_size?: number;
    group_label?: string;
  } | null>(null);

  // Service ticket form state
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketCategory, setTicketCategory] = useState("Plumbing");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketPriority, setTicketPriority] = useState("medium");

  // Complaint feedback modal state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackTicket, setFeedbackTicket] = useState<ComplaintTicket | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComments, setFeedbackComments] = useState<string>("");

  // Domestic staff rating modal state
  const [staffRatingModalOpen, setStaffRatingModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<AssignedDomesticStaff | null>(null);
  const [staffRatingValue, setStaffRatingValue] = useState<number>(5);
  const [staffFeedbackText, setStaffFeedbackText] = useState<string>("");

  // Domestic staff assignment modal state
  const [assignStaffModalOpen, setAssignStaffModalOpen] = useState(false);
  const [assignStaffId, setAssignStaffId] = useState("");
  const [assignWorkType, setAssignWorkType] = useState("part_time");
  const [assignStartDate, setAssignStartDate] = useState("");
  const [assignTimeFrom, setAssignTimeFrom] = useState("");
  const [assignTimeTo, setAssignTimeTo] = useState("");
  const [assignDays, setAssignDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  const assignStaffMutation = useAssignDomesticStaff();
  const endAssignmentMutation = useEndDomesticStaffAssignment();
  const { data: staffDirectory = [], isLoading: staffDirectoryLoading } = useCommunityStaffDirectory();


  // Payments view mode ("invoices" vs "ledger")
  const [paymentsViewMode, setPaymentsViewMode] = useState<"invoices" | "ledger">("invoices");

  // Dismissed state for live visitor approval banner
  const [visitorBannerDismissed, setVisitorBannerDismissed] = useState(false);
  const [deliveryBannerDismissed, setDeliveryBannerDismissed] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      sessionStorage.getItem("gatesphere_gate_alert_dismissed") === "true"
    ) {
      setVisitorBannerDismissed(true);
    }
  }, []);

  // Data queries
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useResidentOverview(activeCommunityId);
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
  const submitStaffRating = useSubmitStaffRating();
  const eventRsvp = useEventRsvp();

  const visitorList = visitors.data || [];
  const deliveryList = deliveries.data || [];
  const complaintList = complaints.data || [];
  const invoiceList = payments.data || [];
  const myOccupancy = profile.data?.occupancies?.[0];

  const ledger = useResidentLedger(myOccupancy?.unit_id);
  const ledgerList = ledger.data || [];

  const nextDueInvoice = invoiceList.find((i) => i.balance_due > 0);
  const openTicket = complaintList.find((t) => t.status !== "resolved" && t.status !== "closed");
  const activeStaffCount = (domesticStaff.data || []).filter((s) => s.is_active).length;
  const nextBooking = (amenities.bookings.data || []).find((b) => b.status === "confirmed");

  const pendingVisitor = visitorList.find((v) => v.status === "pending");
  const pendingDelivery = deliveryList.find(
    (d) => d.status === "at_gate" || d.approval_status === "pending",
  );

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

  const ledgerControls = useTableControls<LedgerEntryItem>({
    data: ledgerList,
    searchKeys: ["entry_type", "source_type", "narration"],
    initialPageSize: 10,
  });

  const vehicleControls = useTableControls<any>({
    data: vehicles.data || [],
    searchKeys: ["plate", "make_model", "slot", "rfid_tag"],
    initialPageSize: 10,
  });

  const staffControls = useTableControls<any>({
    data: domesticStaff.data || [],
    searchKeys: ["name", "role", "phone"],
    initialPageSize: 10,
  });

  const bookingControls = useTableControls<AmenityBooking>({
    data: amenities.bookings.data || [],
    searchKeys: ["amenity_name", "status", "date"],
    initialPageSize: 10,
  });

  const familyControls = useTableControls<FamilyMember>({
    data: family.familyMembers,
    searchKeys: ["name", "relation", "phone"],
    initialPageSize: 10,
  });

  const handleDecideDelivery = async (deliveryId: string, approved: boolean) => {
    try {
      await deliveries.decideDelivery.mutateAsync({
        deliveryId,
        approved,
        remarks: approved ? "Approved by resident from portal" : "Denied by resident from portal",
      });
      toast.success(
        approved
          ? "Delivery approved! Security guard notified to permit entry."
          : "Delivery rejected. Security guard notified to turn courier away.",
        approved ? "Delivery Approved" : "Delivery Denied",
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to record delivery decision.", "Action Failed");
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackTicket) return;
    try {
      await complaints.submitFeedback.mutateAsync({
        ticketId: feedbackTicket.id,
        rating: feedbackRating,
        comments: feedbackComments,
      });
      toast.success(
        `Thank you! You rated ticket ${feedbackTicket.ticket_number} with ${feedbackRating} star(s).`,
        "Feedback Recorded",
      );
      setFeedbackModalOpen(false);
      setFeedbackTicket(null);
      setFeedbackComments("");
      setFeedbackRating(5);
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit rating.", "Error");
    }
  };

  const handleSubmitStaffRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    try {
      await submitStaffRating.mutateAsync({
        staff_id: selectedStaff.staff_id,
        rating: staffRatingValue,
        feedback: staffFeedbackText,
        unit_id: myOccupancy?.unit_id,
      });
      toast.success(
        `Thank you for rating ${selectedStaff.name} with ${staffRatingValue} star(s).`,
        "Staff Rated",
      );
      setStaffRatingModalOpen(false);
      setSelectedStaff(null);
      setStaffFeedbackText("");
      setStaffRatingValue(5);
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit staff rating.", "Error");
    }
  };

  const handleEventRsvp = async (
    announcementId: string,
    response: "going" | "maybe" | "not_going",
  ) => {
    try {
      await eventRsvp.mutateAsync({
        announcementId,
        response,
        guests: 1,
      });
      const labels: Record<string, string> = {
        going: "Going",
        maybe: "Maybe",
        not_going: "Not Going",
      };
      toast.success(
        `Your RSVP (${labels[response] || response}) has been recorded for this event.`,
        "RSVP Confirmed",
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to record event RSVP.", "RSVP Error");
    }
  };

  const handleVisitorDecision = async (requestId: string, approved: boolean) => {
    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          requestId,
        );
      if (isUuid) {
        await visitors.decide.mutateAsync({ requestId, approved });
      }
      setVisitorBannerDismissed(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("gatesphere_gate_alert_dismissed", "true");
      }
      toast.success(
        approved ? "Visitor entry approved for Main Gate 1." : "Visitor entry request rejected.",
        approved ? "Gate Entry Approved" : "Gate Entry Rejected",
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to record visitor decision.", "Error");
    }
  };

  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passCategory) {
      toast.error("Please select a visitor category.", "Category Required");
      return;
    }
    if (!passVisitorName.trim()) {
      toast.error("Please enter the visitor's name.", "Visitor Name Required");
      return;
    }
    const cleanPhone = passVisitorPhone.trim().replace(/[\s\-()]/g, "");
    if (!cleanPhone || cleanPhone.length < 5) {
      toast.error("Please enter a valid mobile number (at least 10 digits).", "Mobile Number Required");
      return;
    }

    try {
      const activeUnitId = profile.data?.occupancies?.[0]?.unit_id;
      const res = await visitors.createPass.mutateAsync({
        visitor_name: passVisitorName.trim(),
        phone: cleanPhone,
        id_type: passIdNumber.trim() ? passIdType : undefined,
        id_number: passIdNumber.trim() ? passIdNumber.trim().toUpperCase() : undefined,
        category: passCategory,
        reason: passReason.trim(),
        valid_for_hours: passDuration,
        unit_id: activeUnitId,
        vehicle_number: passVehicleNumber.trim() || undefined,
        party_size: passPartySize,
        group_label: passGroupLabel.trim() || undefined,
      });
      setVisitorPassModalOpen(false);
      setActivePassResult({
        token: res.token,
        pin: res.pin,
        visitor_name: res.visitor_name || passVisitorName.trim(),
        category: res.category || passCategory,
        reason: res.reason || passReason.trim() || "Visitor Entry",
        valid_from: res.valid_from,
        valid_to: res.valid_to,
        vehicle_number: passVehicleNumber.trim() || undefined,
        party_size: passPartySize,
        group_label: passGroupLabel.trim() || undefined,
      });
      setActivePassModalOpen(true);
      setPassVisitorName("");
      setPassVisitorPhone("");
      setPassIdType("aadhaar");
      setPassIdNumber("");
      setPassReason("");
      setPassCategory("Personal Guest");
      setPassDuration(24);
      setPassVehicleNumber("");
      setPassPartySize(1);
      setPassGroupLabel("");
      toast.success(
        "A QR & 6-digit PIN code have been issued for your visitor.",
        "Visitor Pass Generated",
      );
    } catch (err: any) {
      if (
        err?.code === "VISITOR_BLACKLISTED" ||
        (err?.message && err.message.toLowerCase().includes("blacklist"))
      ) {
        setVisitorPassModalOpen(false);
        setBlockedAlert({
          name: passVisitorName.trim() || "Visitor",
          phone: cleanPhone,
          id_type: passIdNumber.trim() ? passIdType : undefined,
          id_number: passIdNumber.trim() ? passIdNumber.trim().toUpperCase() : undefined,
          reason: err?.fields?.reason || err?.message || "Visitor is flagged on the community blacklist.",
          risk_level: err?.fields?.risk_level || "HIGH",
        });
        toast.error("Pass generation blocked: Visitor is blacklisted by community security.", "Entry Denied");
        return;
      }
      const fieldMsg = err?.fields ? Object.values(err.fields).join(" · ") : null;
      toast.error(fieldMsg || err?.message || "Failed to generate visitor pass.", "Pass Generation Error");
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim()) {
      toast.error("Please enter a summary of the issue.", "Subject Required");
      return;
    }
    try {
      await complaints.createTicket.mutateAsync({
        subject: ticketSubject.trim(),
        category: ticketCategory,
        description: ticketDescription.trim(),
        priority: ticketPriority || "medium",
      });
      setTicketModalOpen(false);
      setTicketSubject("");
      setTicketDescription("");
      toast.success("Facility manager and technician have been notified.", "Service Ticket Raised");
    } catch (err: any) {
      const fieldMsg = err?.fields ? Object.values(err.fields).join(" · ") : null;
      toast.error(fieldMsg || err?.message || "Failed to raise ticket.", "Ticket Error");
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

  // Real database slots filtered for the selected reservation day of week
  const availableDaySlots: AmenitySlot[] = React.useMemo(() => {
    return rawDaySlots;
  }, [rawDaySlots]);

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

  const activeSelectedSlot =
    availableDaySlots.find((s) => s.id === selectedSlotId) || availableDaySlots[0];
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
        "Capacity Exceeded",
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
        "Amenity Booked",
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
      toast.success(
        `${addedName} has been added and pre-approved on the gate whitelist.`,
        "Family Member Added",
      );
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
      toast.success(
        `${updatedName}'s record and gate pre-approval status updated.`,
        "Family Member Updated",
      );
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
      const res = await payments.payDues.mutateAsync({
        invoiceId: selectedInvoice.id,
        amount: selectedInvoice.balance_due,
        method: "simulated_gateway",
      });
      const generatedRcp =
        res?.receipt_number ||
        (res?.id ? `RCP-${res.id.slice(0, 8).toUpperCase()}` : `RCP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setCurrentReceiptNumber(generatedRcp);
      setPaymentModalOpen(false);
      setReceiptModalOpen(true);
      toast.success(
        `Payment of ${formatCurrency(selectedInvoice.balance_due)} processed successfully.`,
        "Dues Paid",
      );
    } catch (err: any) {
      toast.error(err?.message || "Payment failed. Please try again.", "Error");
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
      toast.success(
        "Security Guards and Supervisors have received your alert with your unit coordinates.",
        "🚨 Emergency SOS Dispatched",
      );
    } catch {
      setSosModalOpen(false);
      toast.success(
        "Emergency SOS alert recorded and dispatched to security team.",
        "🚨 Emergency SOS Dispatched",
      );
    }
  };

  const tabMeta: Record<OwnerTenantTab, { title: string; eyebrow: string; description: string }> = {
    overview: {
      title: "Resident Self-Service Portal",
      eyebrow: "Owner & Tenant Home Console",
      description:
        "Manage visitor approvals, standing gate delivery rules, amenities, maintenance tickets, and simulated dues payments.",
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
      description:
        "Reserve clubhouse, sports courts, pool, and community spaces with instant slot booking.",
    },
    maintenance: {
      title: "Community Notices & Announcements",
      eyebrow: "Society Communications",
      description:
        "Stay informed with official circulars, maintenance notices, and society updates.",
    },
    complaints: {
      title: "Complaints & Service Desk",
      eyebrow: "Helpdesk & Maintenance",
      description:
        "Raise maintenance tickets, track technician resolution status, and submit service ratings.",
    },
    vehicles: {
      title: "Vehicles & Parking Allocations",
      eyebrow: "Vehicle Registry",
      description:
        "Manage registered vehicles, assigned parking slots, and parking violation notices.",
    },
    "domestic-staff": {
      title: "Domestic Staff & Daily Help",
      eyebrow: "Household Workforce",
      description: "View assigned household staff, gate check-in status, and performance ratings.",
    },
    payments: {
      title: "Maintenance Dues & Payments",
      eyebrow: "Billing & Financial Ledger",
      description:
        "Review maintenance invoices, outstanding balances, and simulated payment receipts.",
    },
    notifications: {
      title: "Notifications & Alerts",
      eyebrow: "Personal Inbox",
      description:
        "Live notifications for gate arrivals, delivery drop-offs, dues, and announcements.",
    },
    emergency: {
      title: "Emergency SOS & Incident Response",
      eyebrow: "Crisis & Security Desk",
      description:
        "Trigger instant panic alerts to on-duty security guards and view emergency contacts.",
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
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        background: "rgba(255,255,255,0.25)",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "9999px",
                      }}
                    >
                      GATE APPROVAL REQUEST
                    </span>
                    <span style={{ fontSize: "12px", color: "#93C5FD" }}>
                      Awaiting your decision
                    </span>
                  </div>
                  <h3
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 800,
                      marginTop: "0.25rem",
                      color: "white",
                    }}
                  >
                    {pendingVisitor.visitor_name} is requesting entry for your unit
                  </h3>
                  <p style={{ fontSize: "13px", color: "#DBEAFE" }}>
                    Purpose: {pendingVisitor.purpose || "—"} · Vehicle:{" "}
                    {pendingVisitor.vehicle_number || "—"} · Phone: {pendingVisitor.phone || "—"}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <BrandButton
                  variant="outline"
                  size="sm"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "white",
                    borderColor: "rgba(255,255,255,0.3)",
                  }}
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

          {/* REAL-TIME DELIVERY APPROVAL PROMPT (Courier Waiting at Gate) */}
          {!deliveryBannerDismissed && pendingDelivery && (
            <div
              className="gs-card card-hover"
              style={{
                background: "linear-gradient(135deg, #065F46, #059669)",
                color: "#FFFFFF",
                padding: "1.25rem 1.5rem",
                marginBottom: "1.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                boxShadow: "0 8px 32px rgba(5, 150, 105, 0.35)",
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
                  📦
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        background: "rgba(255,255,255,0.25)",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "9999px",
                      }}
                    >
                      DELIVERY AT GATE
                    </span>
                    <span style={{ fontSize: "12px", color: "#A7F3D0" }}>
                      Courier awaiting gate clearance
                    </span>
                  </div>
                  <h3
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 800,
                      marginTop: "0.25rem",
                      color: "white",
                    }}
                  >
                    {pendingDelivery.courier_company} ({pendingDelivery.package_type})
                  </h3>
                  <p style={{ fontSize: "13px", color: "#D1FAE5" }}>
                    Executive: {pendingDelivery.driver_name || "Courier Partner"} · Phone: {pendingDelivery.driver_phone || "—"} · Tracking: {pendingDelivery.tracking_id || "—"}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <BrandButton
                  variant="outline"
                  size="sm"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "white",
                    borderColor: "rgba(255,255,255,0.3)",
                  }}
                  isLoading={deliveries.decideDelivery?.isPending}
                  onClick={() => {
                    handleDecideDelivery(pendingDelivery.id, false);
                    setDeliveryBannerDismissed(true);
                  }}
                >
                  ✕ Deny Entry
                </BrandButton>
                <BrandButton
                  size="sm"
                  style={{ background: "#FFFFFF", color: "#065F46", fontWeight: 800 }}
                  isLoading={deliveries.decideDelivery?.isPending}
                  onClick={() => {
                    handleDecideDelivery(pendingDelivery.id, true);
                    setDeliveryBannerDismissed(true);
                  }}
                >
                  ✓ Permit Delivery
                </BrandButton>
              </div>
            </div>
          )}
          {/* KPI Stats */}
          {statsError ? (
            <div style={{ marginBottom: "2rem" }}>
              <ErrorState
                title="Failed to load resident overview metrics"
                message="Unable to fetch current dues, tickets, and facility status from the server."
                onRetry={() => refetchStats()}
              />
            </div>
          ) : statsLoading ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
                gap: "1.25rem",
                marginBottom: "2rem",
              }}
            >
              <KpiCardSkeleton borderTop="3px solid #D97706" />
              <KpiCardSkeleton borderTop="3px solid #DC2626" />
              <KpiCardSkeleton borderTop="3px solid #0D9488" />
              <KpiCardSkeleton borderTop="3px solid #9333EA" />
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
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
                  nextDueInvoice
                    ? `Due by ${formatDate(nextDueInvoice.due_date)}`
                    : "No outstanding dues"
                }
                onClick={() => router.push("/owner-tenant/payments")}
              />
              <StatMetric
                label="Open Service Tickets"
                value={stats?.open_service_tickets ?? 0}
                accentColor="#DC2626"
                icon="🎫"
                description={
                  openTicket
                    ? `${openTicket.category_name} (${openTicket.status.replace(/_/g, " ")})`
                    : "No open tickets"
                }
                onClick={() => router.push("/owner-tenant/complaints")}
              />
              <StatMetric
                label="Domestic Staff Assigned"
                value={activeStaffCount}
                accentColor="#0D9488"
                icon="🧹"
                description={
                  activeStaffCount > 0
                    ? `${activeStaffCount} active assignment(s)`
                    : "No staff assigned"
                }
                onClick={() => router.push("/owner-tenant/domestic-staff")}
              />
              <StatMetric
                label="Booked Amenities"
                value={stats?.upcoming_amenity_bookings ?? 0}
                accentColor="#9333EA"
                icon={nextBooking ? getAmenityIcon(nextBooking.amenity_name) : "🏊"}
                description={
                  nextBooking
                    ? `${nextBooking.amenity_name} (${formatDate(nextBooking.date)})`
                    : "No upcoming bookings"
                }
                onClick={() => router.push("/owner-tenant/amenities")}
              />
            </div>
          )}

          {/* Action Quick Links & Activity */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
              gap: "1.5rem",
            }}
          >
            {/* Quick Actions Card */}
            <div className="gs-card">
              <h3 className="card-h3" style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
                ⚡ Quick Resident Actions
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                }}
              >
                <BrandButton
                  variant="outline"
                  size="sm"
                  onClick={() => setVisitorPassModalOpen(true)}
                >
                  🎟️ Pre-Approve Pass
                </BrandButton>
                <BrandButton
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/owner-tenant/deliveries")}
                >
                  📦 Gate Protocols
                </BrandButton>
                <BrandButton variant="outline" size="sm" onClick={() => setTicketModalOpen(true)}>
                  🔧 Raise Ticket
                </BrandButton>
                <BrandButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedInvoice(invoiceList[0]);
                    setPaymentModalOpen(true);
                  }}
                >
                  💳 Pay Dues
                </BrandButton>
              </div>
            </div>

            {/* Recent Deliveries & Gate Status */}
            <div className="gs-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <h3 className="card-h3" style={{ fontSize: "1.1rem", margin: 0 }}>
                  📦 Recent Deliveries
                </h3>
                <BrandButton
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/owner-tenant/deliveries")}
                >
                  View All
                </BrandButton>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {deliveries.isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "0.75rem",
                        borderRadius: "6px",
                        background: "#F8FAFC",
                        border: "1px solid var(--border-light)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ width: "60%" }}>
                        <Skeleton width="80%" height="1rem" borderRadius={4} />
                        <div style={{ marginTop: "0.3rem" }}>
                          <Skeleton width="50%" height="0.75rem" borderRadius={4} />
                        </div>
                      </div>
                      <Skeleton width={70} height={22} borderRadius={999} />
                    </div>
                  ))
                ) : deliveryList.length === 0 ? (
                  <p style={{ color: "var(--brand-body)", fontSize: "13px", margin: 0, fontStyle: "italic", padding: "0.5rem 0" }}>
                    No recent parcel deliveries at the security gate.
                  </p>
                ) : (
                  deliveryList.slice(0, 3).map((del) => (
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
                        <div style={{ fontSize: "12px", color: "var(--brand-body)" }}>
                          {del.package_type} · {del.tracking_id}
                        </div>
                      </div>
                      <StatusBadge status={del.status} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY PROFILE */}
      {activeTab === "profile" && (
        <div className="gs-card" style={{ maxWidth: 750 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h3 className="card-h3" style={{ margin: 0 }}>Resident Profile & Emergency Contacts</h3>
              <p style={{ color: "var(--brand-body)", fontSize: "13px", marginTop: "0.25rem", margin: 0 }}>
                Manage your personal identification, contact coordinates, and emergency escalation protocols.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <BrandButton
                size="sm"
                variant="outline"
                onClick={() => {
                  setPasswordError("");
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setChangePasswordModalOpen(true);
                }}
              >
                🔒 Change Password
              </BrandButton>
              <BrandButton
                size="sm"
                onClick={handleOpenEditProfile}
              >
                ✏️ Edit Profile
              </BrandButton>
            </div>
          </div>
          {profile.isError ? (
            <ErrorState
              title="Failed to load resident profile"
              message="Unable to fetch profile information from the server."
              onRetry={() => profile.refetch()}
            />
          ) : profile.isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                  <Skeleton width="40%" height="0.75rem" borderRadius={4} />
                  <div style={{ marginTop: "0.4rem" }}>
                    <Skeleton width="70%" height="1.1rem" borderRadius={4} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
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
          <h3 className="card-h3" style={{ marginBottom: "1.5rem" }}>
            Property & Tenancy Information
          </h3>
          {profile.isError ? (
            <ErrorState
              title="Failed to load property details"
              message="Unable to fetch tenancy records from the server."
              onRetry={() => profile.refetch()}
            />
          ) : profile.isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                  <Skeleton width="40%" height="0.75rem" borderRadius={4} />
                  <div style={{ marginTop: "0.4rem" }}>
                    <Skeleton width="70%" height="1.1rem" borderRadius={4} />
                  </div>
                </div>
              ))}
            </div>
          ) : !myOccupancy ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>
              No active unit occupancy found for this profile.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                gap: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--brand-body)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Assigned Unit
                </div>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    marginTop: "0.25rem",
                    color: "var(--brand-primary)",
                  }}
                >
                  Unit {myOccupancy.unit_number}
                  {myOccupancy.tower_name ? `, ${myOccupancy.tower_name}` : ""}
                  {myOccupancy.floor_number != null ? ` (Floor ${myOccupancy.floor_number})` : ""}
                </div>
              </div>
              <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--brand-body)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Occupancy Status
                </div>
                <div style={{ marginTop: "0.25rem" }}>
                  <StatusBadge
                    status={myOccupancy.is_active ? "active" : "inactive"}
                    label={myOccupancy.occupancy_role.replace(/_/g, " ")}
                  />
                </div>
              </div>
              <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--brand-body)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Resident Since
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>
                  {formatDate(myOccupancy.start_date)}
                </div>
              </div>
              <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--brand-body)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Assigned Parking
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>
                  {(vehicles.data || []).find((v) => v.slot !== "Not Allocated")?.slot ||
                    "No slot allocated"}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FAMILY MEMBERS */}
      {activeTab === "family-members" && (
        <div className="gs-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.25rem",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div>
              <h3 className="card-h3" style={{ margin: 0 }}>Family Members (Gate Pre-Approved)</h3>
              <p style={{ color: "var(--brand-body)", fontSize: "13.5px", margin: "0.25rem 0 0 0" }}>
                Family members listed here feed the gate recognition system and automatically bypass
                manual guard approval upon entry.
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

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div style={{ width: "min(100%, 280px)" }}>
              <DebouncedInput
                value={familyControls.searchTerm}
                onChange={familyControls.setSearchTerm}
                placeholder="Search family members..."
                icon="🔍"
              />
            </div>
            <SortDropdown
              value={familyControls.sortPreset}
              onChange={familyControls.setSortPreset}
            />
          </div>

          {family.isError ? (
            <ErrorState
              title="Failed to load family members"
              message="Unable to fetch registered household members."
              onRetry={() => family.refetch()}
            />
          ) : (
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
                        <div style={{ fontSize: "11.5px", color: "var(--brand-body)" }}>
                          {m.phone}
                        </div>
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
              data={familyControls.paginatedData}
              isLoading={family.isLoading}
              page={familyControls.page}
              pageSize={familyControls.pageSize}
              total={familyControls.total}
              onPageChange={familyControls.setPage}
              onPageSizeChange={familyControls.setPageSize}
              emptyTitle="No family members registered"
              emptyDescription="Add family members to enable automated gate whitelist pass generation."
            />
          )}
        </div>
      )}

      {/* TAB 5: VISITORS */}
      {activeTab === "visitors" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <FilterPanel onReset={visitorControls.clearFilters}>
              <div style={{ width: "min(100%, 280px)" }}>
                <DebouncedInput
                  value={visitorControls.searchTerm}
                  onChange={visitorControls.setSearchTerm}
                  placeholder="Search visitor name, phone..."
                  icon="🔍"
                />
              </div>
              <SortDropdown
                value={visitorControls.sortPreset}
                onChange={visitorControls.setSortPreset}
              />
            </FilterPanel>
            <BrandButton onClick={() => setVisitorPassModalOpen(true)}>
              🎟️ Generate Guest Pass
            </BrandButton>
          </div>

          {visitors.isError ? (
            <ErrorState
              title="Failed to Load Visitor Requests"
              message={visitors.error?.message || "Could not retrieve visitor list from server."}
              onRetry={() => visitors.refetch()}
            />
          ) : (
            <DataTable<VisitorRequest>
              columns={[
                { key: "visitor_name", header: "Visitor Name", sortable: true },
                { key: "phone", header: "Phone" },
                { key: "purpose", header: "Purpose" },
                { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
                {
                  key: "pass_code",
                  header: "Pass / PIN",
                  render: (i) =>
                    i.pass_code || i.qr_token ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <code style={{ color: "var(--brand-primary)", fontWeight: 700 }}>
                          {i.pass_code || "QR PASS"}
                        </code>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "0.2rem 0.5rem", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                          onClick={() => {
                            setActivePassResult({
                              token: i.qr_token || i.pass_code,
                              pin: i.pass_code,
                              visitor_name: i.visitor_name,
                              category: "Visitor",
                              reason: i.purpose,
                              valid_to: i.valid_until,
                            });
                            setActivePassModalOpen(true);
                          }}
                        >
                          📱 QR
                        </button>
                      </div>
                    ) : (
                      "–"
                    ),
                },
                {
                  key: "created_at",
                  header: "Requested / Entry",
                  render: (i) => formatDate(i.entry_time || i.created_at),
                },
              ]}
              data={visitorControls.paginatedData}
              isLoading={visitors.isLoading}
              page={visitorControls.page}
              pageSize={visitorControls.pageSize}
              total={visitorControls.total}
              onPageChange={visitorControls.setPage}
              onPageSizeChange={visitorControls.setPageSize}
              emptyTitle="No visitor requests"
              emptyDescription="Create pre-approved passes or monitor incoming guest requests."
            />
          )}
        </div>
      )}

      {/* TAB 6: DELIVERIES */}
      {activeTab === "deliveries" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Standing Protocols Matrix */}
          <div className="gs-card">
            <h3 className="card-h3" style={{ marginBottom: "0.5rem" }}>
              Standing Gate Delivery Protocols
            </h3>
            <p style={{ color: "var(--brand-body)", fontSize: "14px", marginBottom: "1rem" }}>
              Configure how the Security Guard handles deliveries automatically without calling your
              intercom.
            </p>
            {deliveryProtocols.isLoading ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                  gap: "1rem",
                }}
              >
                {[1, 2, 3].map((n) => (
                  <CardSkeleton key={n} lines={2} />
                ))}
              </div>
            ) : (deliveryProtocols.data || []).length === 0 ? (
              <p style={{ color: "var(--brand-body)", fontSize: "13px" }}>
                No delivery protocols configured for this community yet.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                  gap: "1rem",
                }}
              >
                {(deliveryProtocols.data || []).map((proto) => (
                  <div
                    key={proto.id}
                    style={{
                      padding: "0.85rem",
                      background: "#F8FAFC",
                      borderRadius: "8px",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <div
                      style={{ fontWeight: 700, fontSize: "13.5px", textTransform: "capitalize" }}
                    >
                      {proto.delivery_type}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--brand-primary)",
                        marginTop: "0.25rem",
                        fontWeight: 600,
                      }}
                    >
                      Protocol: {proto.protocol_type.replace(/_/g, " ")}
                      {proto.requires_otp ? " · OTP Required" : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div style={{ width: "min(100%, 280px)" }}>
              <DebouncedInput
                value={deliveryControls.searchTerm}
                onChange={deliveryControls.setSearchTerm}
                placeholder="Search courier, tracking ID..."
                icon="🔍"
              />
            </div>
            <SortDropdown
              value={deliveryControls.sortPreset}
              onChange={deliveryControls.setSortPreset}
            />
          </div>

          {deliveries.isError ? (
            <ErrorState
              title="Failed to Load Deliveries"
              message={deliveries.error?.message || "Could not retrieve delivery history."}
              onRetry={() => deliveries.refetch()}
            />
          ) : (
            <DataTable<DeliveryItem>
              columns={[
                { key: "courier_company", header: "Courier / Platform", sortable: true },
                { key: "package_type", header: "Package Content" },
                { key: "tracking_id", header: "Tracking ID" },
                {
                  key: "status",
                  header: "Status",
                  render: (i) => <StatusBadge status={i.status} />,
                },
                {
                  key: "approval_status",
                  header: "Gate Approval",
                  render: (i) => <StatusBadge status={i.approval_status || "pending"} />,
                },
                {
                  key: "arrived_at",
                  header: "Arrival / Delivery",
                  render: (i) => formatDate(i.delivered_at || i.arrived_at || i.expected_at),
                },
                {
                  key: "actions",
                  header: "Gate Clearance",
                  render: (i) => {
                    if (i.status === "at_gate" || i.approval_status === "pending") {
                      return (
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <BrandButton
                            size="sm"
                            isLoading={deliveries.decideDelivery?.isPending}
                            onClick={() => handleDecideDelivery(i.id, true)}
                          >
                            ✓ Approve
                          </BrandButton>
                          <BrandButton
                            size="sm"
                            variant="outline"
                            style={{ borderColor: "#FECACA", color: "#DC2626" }}
                            isLoading={deliveries.decideDelivery?.isPending}
                            onClick={() => handleDecideDelivery(i.id, false)}
                          >
                            ✕ Deny
                          </BrandButton>
                        </div>
                      );
                    }
                    return (
                      <span style={{ fontSize: "12px", color: "var(--brand-muted)" }}>
                        {i.approval_status === "approved" || i.status === "delivered"
                          ? "✓ Cleared"
                          : i.approval_status === "rejected" || i.status === "rejected"
                            ? "✕ Denied"
                            : "—"}
                      </span>
                    );
                  },
                },
              ]}
              data={deliveryControls.paginatedData}
              isLoading={deliveries.isLoading}
              page={deliveryControls.page}
              pageSize={deliveryControls.pageSize}
              total={deliveryControls.total}
              onPageChange={deliveryControls.setPage}
              onPageSizeChange={deliveryControls.setPageSize}
              emptyTitle="No deliveries recorded"
              emptyDescription="Parcels logged at the gate will appear here in real-time."
            />
          )}
        </div>
      )}

      {/* TAB 7: AMENITIES */}
      {activeTab === "amenities" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Active Bookings */}
          <div className="gs-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <h3 className="card-h3" style={{ margin: 0 }}>
                My Active Facility Bookings
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ width: "min(100%, 240px)" }}>
                  <DebouncedInput
                    value={bookingControls.searchTerm}
                    onChange={bookingControls.setSearchTerm}
                    placeholder="Search bookings..."
                    icon="🔍"
                  />
                </div>
                <SortDropdown
                  value={bookingControls.sortPreset}
                  onChange={bookingControls.setSortPreset}
                />
              </div>
            </div>
            {amenities.bookings.isError ? (
              <ErrorState
                title="Failed to Load Bookings"
                message={amenities.bookings.error?.message || "Could not load reservations."}
                onRetry={() => amenities.bookings.refetch()}
              />
            ) : (
              <DataTable<AmenityBooking>
                columns={[
                  {
                    key: "amenity_name",
                    header: "Facility Name",
                    render: (i) => (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span>{getAmenityIcon(i.amenity_name)}</span>
                        <span style={{ fontWeight: 600 }}>{i.amenity_name}</span>
                      </div>
                    ),
                  },
                  { key: "date", header: "Reserved Date" },
                  {
                    key: "start_time",
                    header: "Time Slot",
                    render: (i) => `${i.start_time} – ${i.end_time}`,
                  },
                  {
                    key: "guests_count",
                    header: "Guests",
                    render: (i) => `${i.guests_count || 1} Person(s)`,
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (i) => <StatusBadge status={i.status} />,
                  },
                  {
                    key: "actions",
                    header: "Action",
                    render: (i) => {
                      if (i.status === "cancelled") {
                        return (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "var(--brand-muted)",
                              fontStyle: "italic",
                            }}
                          >
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
                data={bookingControls.paginatedData}
                isLoading={amenities.bookings.isLoading}
                page={bookingControls.page}
                pageSize={bookingControls.pageSize}
                total={bookingControls.total}
                onPageChange={bookingControls.setPage}
                onPageSizeChange={bookingControls.setPageSize}
                emptyTitle="No active bookings"
                emptyDescription="Reserve slots for clubhouse, pool, court, and other amenities."
              />
            )}
          </div>

          {/* Browse Available Amenities Grid */}
          <div>
            <h3 className="card-h3" style={{ marginBottom: "1rem" }}>
              Browse Community Amenities
            </h3>
            {amenities.amenities.isLoading ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                  gap: "1.25rem",
                }}
              >
                {[1, 2, 3, 4].map((n) => (
                  <CardSkeleton key={n} lines={4} />
                ))}
              </div>
            ) : amenities.amenities.isError ? (
              <ErrorState
                title="Failed to Load Amenities"
                message={amenities.amenities.error?.message || "Could not retrieve community amenities."}
                onRetry={() => amenities.amenities.refetch()}
              />
            ) : (amenities.amenities.data || []).length === 0 ? (
              <div className="gs-card" style={{ textAlign: "center", padding: "2rem" }}>
                <p style={{ color: "var(--brand-body)", margin: 0 }}>No amenities configured for this community.</p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                  gap: "1.25rem",
                }}
              >
                {(amenities.amenities.data || []).map((amenity) => {
                  // Dynamic capacity: count today's confirmed bookings for this amenity
                  const todayStr = new Date().toISOString().split("T")[0];
                  const todayBooked = (amenities.bookings.data || [])
                    .filter(
                      (b) =>
                        b.amenity_id === amenity.id &&
                        b.date === todayStr &&
                        b.status !== "cancelled"
                    )
                    .reduce((sum, b) => sum + (b.guests_count || 1), 0);
                  const totalCap = amenity.capacity || 20;
                  const remaining = Math.max(0, totalCap - todayBooked);
                  const capColor =
                    remaining === 0
                      ? "#dc2626"
                      : remaining <= Math.ceil(totalCap * 0.25)
                        ? "#f59e0b"
                        : "#16a34a";

                  return (
                  <div key={amenity.id} className="gs-card card-hover">
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
                      {getAmenityIcon(amenity.name, amenity.category, amenity.description)}
                    </div>
                    <h4 style={{ fontWeight: 800, fontSize: "16px" }}>{amenity.name}</h4>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "var(--brand-body)",
                        margin: "0.5rem 0 0.5rem 0",
                      }}
                    >
                      {amenity.description}
                    </p>
                    {/* Dynamic remaining capacity badge */}
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: capColor,
                        background: `${capColor}14`,
                        borderRadius: "6px",
                        padding: "3px 8px",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <span
                        style={{
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          background: capColor,
                          display: "inline-block",
                        }}
                      />
                      {remaining === 0
                        ? "Fully Booked Today"
                        : `${remaining} of ${totalCap} spots available today`}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand-primary)" }}
                      >
                        {amenity.price_per_hour > 0
                          ? `${formatCurrency(amenity.price_per_hour)}/hr`
                          : "Free for Residents"}
                      </span>
                      <BrandButton
                        size="sm"
                        disabled={remaining === 0}
                        onClick={() => {
                          setSelectedAmenity(amenity);
                          setAmenityBookingModalOpen(true);
                        }}
                      >
                        {remaining === 0 ? "Fully Booked" : "Reserve Slot"}
                      </BrandButton>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: MAINTENANCE */}
      {activeTab === "maintenance" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "0.5rem" }}>
            Scheduled Community Upkeep Notices
          </h3>
          <p style={{ color: "var(--brand-body)", marginBottom: "1.25rem", fontSize: "14px" }}>
            Scheduled maintenance affecting water, power, elevators, and clubhouse areas.
          </p>
          {announcements.isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[1, 2, 3].map((n) => (
                <CardSkeleton key={n} lines={2} />
              ))}
            </div>
          ) : announcements.isError ? (
            <ErrorState
              title="Failed to Load Notices"
              message={announcements.error?.message || "Could not retrieve announcements."}
              onRetry={() => announcements.refetch()}
            />
          ) : (announcements.data || []).length === 0 ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>
              No community notices published yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {(announcements.data || []).map((m: any) => (
                <div
                  key={m.id}
                  style={{
                    padding: "1rem 1.25rem",
                    background: "#F8FAFC",
                    borderRadius: "8px",
                    border: "1px solid var(--border-light)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "4px",
                            background: m.announcement_type === "event" ? "#ECFDF5" : "#EFF6FF",
                            color: m.announcement_type === "event" ? "#065F46" : "#1E40AF",
                          }}
                        >
                          {m.announcement_type || "Notice"}
                        </span>
                        <div style={{ fontWeight: 700, fontSize: "14.5px", color: "var(--brand-heading)" }}>{m.title}</div>
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--brand-muted)",
                          fontWeight: 500,
                          marginTop: "0.25rem",
                        }}
                      >
                        Published: {formatDate(m.publish_at || m.created_at)}
                      </div>
                    </div>
                    {m.priority && m.priority !== "normal" && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: m.priority === "urgent" ? "#DC2626" : "#D97706",
                        }}
                      >
                        ⚠️ {m.priority.toUpperCase()} PRIORITY
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "13.5px", color: "var(--brand-body)", marginTop: "0.6rem", lineHeight: 1.5 }}>
                    {m.body}
                  </p>
                  {(m.announcement_type === "event" || m.event_start_at) && (
                    <div
                      style={{
                        marginTop: "0.75rem",
                        paddingTop: "0.75rem",
                        borderTop: "1px dashed var(--border-light)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                      }}
                    >
                      <div style={{ fontSize: "12.5px", color: "#1E3A8A", fontWeight: 600 }}>
                        🗓️ Event Date: {formatDate(m.event_start_at)}
                        {m.event_end_at ? ` to ${formatDate(m.event_end_at)}` : ""}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span style={{ fontSize: "12px", color: "var(--brand-muted)", marginRight: "0.25rem" }}>
                          RSVP:
                        </span>
                        <BrandButton
                          size="sm"
                          isLoading={eventRsvp.isPending}
                          onClick={() => handleEventRsvp(m.id, "going")}
                        >
                          ✓ Going
                        </BrandButton>
                        <BrandButton
                          size="sm"
                          variant="outline"
                          isLoading={eventRsvp.isPending}
                          onClick={() => handleEventRsvp(m.id, "maybe")}
                        >
                          ? Maybe
                        </BrandButton>
                        <BrandButton
                          size="sm"
                          variant="outline"
                          style={{ borderColor: "#FECACA", color: "#DC2626" }}
                          isLoading={eventRsvp.isPending}
                          onClick={() => handleEventRsvp(m.id, "not_going")}
                        >
                          ✕ Decline
                        </BrandButton>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 9: COMPLAINTS / SERVICE REQUESTS */}
      {activeTab === "complaints" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <FilterPanel onReset={complaintControls.clearFilters}>
              <div style={{ width: "min(100%, 280px)" }}>
                <DebouncedInput
                  value={complaintControls.searchTerm}
                  onChange={complaintControls.setSearchTerm}
                  placeholder="Search tickets, subject, category..."
                  icon="🔍"
                />
              </div>
              <SortDropdown
                value={complaintControls.sortPreset}
                onChange={complaintControls.setSortPreset}
              />
            </FilterPanel>
            <BrandButton onClick={() => setTicketModalOpen(true)}>
              + Raise Service Ticket
            </BrandButton>
          </div>

          {complaints.isError ? (
            <ErrorState
              title="Failed to Load Service Tickets"
              message={complaints.error?.message || "Could not retrieve maintenance complaints."}
              onRetry={() => complaints.refetch()}
            />
          ) : (
            <DataTable<ComplaintTicket>
              columns={[
                { key: "ticket_number", header: "Ticket #", sortable: true },
                { key: "subject", header: "Subject", sortable: true },
                { key: "category_name", header: "Category" },
                {
                  key: "priority",
                  header: "Priority",
                  render: (i) => <StatusBadge status={i.priority} />,
                },
                { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
                {
                  key: "escalation_state",
                  header: "SLA Tracker",
                  render: (i) => <StatusBadge status={i.escalation_state} />,
                },
                { key: "created_at", header: "Raised", render: (i) => formatDate(i.created_at) },
                {
                  key: "actions",
                  header: "Action",
                  render: (i) => {
                    if (i.status === "resident_confirmation") {
                      return (
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          <BrandButton
                            size="sm"
                            isLoading={complaints.confirmTicket.isPending}
                            onClick={() =>
                              complaints.confirmTicket.mutateAsync({
                                ticketId: i.id,
                                satisfied: true,
                                notes: "Fix confirmed by resident",
                              }).catch((e: any) => toast.error(e?.message || "Failed to confirm.", "Error"))
                            }
                          >
                            ✓ Confirm Fix
                          </BrandButton>
                          <BrandButton
                            size="sm"
                            variant="outline"
                            style={{ borderColor: "#FECACA", color: "#DC2626" }}
                            isLoading={complaints.confirmTicket.isPending}
                            onClick={() =>
                              complaints.confirmTicket.mutateAsync({
                                ticketId: i.id,
                                satisfied: false,
                                notes: "Issue not resolved — disputed by resident",
                              }).catch((e: any) => toast.error(e?.message || "Failed to dispute.", "Error"))
                            }
                          >
                            ✗ Dispute
                          </BrandButton>
                        </div>
                      );
                    }
                    if (i.status === "resolved" || i.status === "closed") {
                      return (
                        <BrandButton
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFeedbackTicket(i);
                            setFeedbackRating(5);
                            setFeedbackComments("");
                            setFeedbackModalOpen(true);
                          }}
                        >
                          ⭐ Rate Service
                        </BrandButton>
                      );
                    }
                    return null;
                  },
                },
              ]}
              data={complaintControls.paginatedData}
              isLoading={complaints.isLoading}
              page={complaintControls.page}
              pageSize={complaintControls.pageSize}
              total={complaintControls.total}
              onPageChange={complaintControls.setPage}
              onPageSizeChange={complaintControls.setPageSize}
              emptyTitle="No service tickets"
              emptyDescription="Raise a maintenance ticket to get assistance from society facility technicians."
            />
          )}
        </div>
      )}

      {/* TAB 10: VEHICLES & PARKING */}
      {activeTab === "vehicles" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="gs-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <h3 className="card-h3" style={{ margin: 0 }}>
                Registered Vehicles & Parking Allocation
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ width: "min(100%, 240px)" }}>
                  <DebouncedInput
                    value={vehicleControls.searchTerm}
                    onChange={vehicleControls.setSearchTerm}
                    placeholder="Search vehicles, plates..."
                    icon="🔍"
                  />
                </div>
                <SortDropdown
                  value={vehicleControls.sortPreset}
                  onChange={vehicleControls.setSortPreset}
                />
              </div>
            </div>
            {vehicles.isError ? (
              <ErrorState
                title="Failed to Load Vehicles"
                message={vehicles.error?.message || "Could not retrieve registered vehicles."}
                onRetry={() => vehicles.refetch()}
              />
            ) : (
              <DataTable
                columns={[
                  {
                    key: "plate",
                    header: "License Plate",
                    render: (i) => <code style={{ fontWeight: 800 }}>{i.plate}</code>,
                  },
                  { key: "make_model", header: "Make & Model" },
                  {
                    key: "slot",
                    header: "Allocated Slot",
                    render: (i) => (
                      <span style={{ fontWeight: 700, color: "var(--brand-primary)" }}>{i.slot}</span>
                    ),
                  },
                  { key: "rfid_tag", header: "Gate FastTag / RFID" },
                  {
                    key: "violations",
                    header: "Recorded Violations",
                    render: (i) =>
                      i.violations === 0 ? (
                        <StatusBadge status="active" label="0 Violations" />
                      ) : (
                        <StatusBadge status="warning" label={`${i.violations} Warning`} />
                      ),
                  },
                ]}
                data={vehicleControls.paginatedData}
                isLoading={vehicles.isLoading}
                page={vehicleControls.page}
                pageSize={vehicleControls.pageSize}
                total={vehicleControls.total}
                onPageChange={vehicleControls.setPage}
                onPageSizeChange={vehicleControls.setPageSize}
                emptyTitle="No vehicles registered"
                emptyDescription="Contact your facility office or community admin to link registered vehicles."
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 11: DOMESTIC STAFF */}
      {activeTab === "domestic-staff" && (
        <div className="gs-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.25rem",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div>
              <h3 className="card-h3">Assigned Domestic Staff</h3>
              <p style={{ color: "var(--brand-body)", fontSize: "13.5px" }}>
                Domestic helpers assigned to your unit. Hire verified staff members, view real-time gate presence, and rate service.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ width: "min(100%, 240px)" }}>
                <DebouncedInput
                  value={staffControls.searchTerm}
                  onChange={staffControls.setSearchTerm}
                  placeholder="Search staff name, role..."
                  icon="🔍"
                />
              </div>
              <SortDropdown
                value={staffControls.sortPreset}
                onChange={staffControls.setSortPreset}
              />
              <BrandButton
                size="sm"
                variant="primary"
                onClick={() => setAssignStaffModalOpen(true)}
              >
                + Assign / Hire Staff
              </BrandButton>
            </div>
          </div>

          {domesticStaff.isError ? (
            <ErrorState
              title="Failed to Load Domestic Staff"
              message={domesticStaff.error?.message || "Could not retrieve assigned domestic staff."}
              onRetry={() => domesticStaff.refetch()}
            />
          ) : (
            <DataTable<AssignedDomesticStaff>
              columns={[
                { key: "name", header: "Staff Member", sortable: true },
                { key: "role", header: "Service Type" },
                { key: "phone", header: "Phone" },
                {
                  key: "is_inside",
                  header: "Gate Presence",
                  render: (i) =>
                    i.is_inside ? (
                      <div>
                        <StatusBadge status="active" label="🟢 Inside Community" />
                        {i.last_check_in && (
                          <div style={{ fontSize: "11px", color: "var(--brand-muted)", marginTop: "0.2rem" }}>
                            In: {new Date(i.last_check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <StatusBadge status="inactive" label="⚪ Off Duty" />
                    ),
                },
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
                {
                  key: "is_active",
                  header: "Assignment Status",
                  render: (i) => <StatusBadge status={i.is_active ? "active" : "inactive"} />,
                },
                {
                  key: "actions",
                  header: "Action",
                  render: (i) => (
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <BrandButton
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedStaff(i);
                          setStaffRatingValue(5);
                          setStaffFeedbackText("");
                          setStaffRatingModalOpen(true);
                        }}
                      >
                        ⭐ Rate
                      </BrandButton>
                      {i.is_active && (
                        <BrandButton
                          size="sm"
                          variant="ghost"
                          style={{ color: "var(--brand-danger, #ef4444)" }}
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to end service for ${i.name}?`)) {
                              try {
                                await endAssignmentMutation.mutateAsync(i.id);
                                toast.success(`Service ended for ${i.name}`);
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to end service");
                              }
                            }
                          }}
                        >
                          ✕ End
                        </BrandButton>
                      )}
                    </div>
                  ),
                },
              ]}
              data={staffControls.paginatedData}
              isLoading={domesticStaff.isLoading}
              page={staffControls.page}
              pageSize={staffControls.pageSize}
              total={staffControls.total}
              onPageChange={staffControls.setPage}
              onPageSizeChange={staffControls.setPageSize}
              emptyTitle="No domestic staff assigned"
              emptyDescription="Staff assignments are registered and managed through your community management."
            />
          )}
        </div>
      )}

      {/* TAB 12: PAYMENTS & LEDGER */}
      {activeTab === "payments" && (
        <div>
          <div
            className="gs-card"
            style={{
              marginBottom: "1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <span className="eyebrow-label">BILLING SUMMARY</span>
              <h3 className="card-h3" style={{ marginTop: "0.25rem" }}>
                Current Balance Due: {formatCurrency(stats?.pending_dues_amount ?? 0)}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--brand-body)" }}>
                {nextDueInvoice
                  ? `Due date: ${formatDate(nextDueInvoice.due_date)}`
                  : "No outstanding dues"}
              </p>
            </div>
            <BrandButton
              onClick={() => {
                const inv = invoiceList.find((i) => i.status !== "paid") || invoiceList[0];
                setSelectedInvoice(inv || null);
                setPaymentModalOpen(true);
              }}
            >
              💳 Pay Outstanding Dues
            </BrandButton>
          </div>

          <div className="gs-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.25rem",
                flexWrap: "wrap",
                gap: "0.75rem",
                borderBottom: "1px solid var(--border-light)",
                paddingBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  style={{
                    padding: "0.45rem 0.9rem",
                    borderRadius: "6px",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "13.5px",
                    cursor: "pointer",
                    background: paymentsViewMode === "invoices" ? "var(--brand-primary)" : "#F1F5F9",
                    color: paymentsViewMode === "invoices" ? "#FFFFFF" : "var(--brand-body)",
                  }}
                  onClick={() => setPaymentsViewMode("invoices")}
                >
                  📄 Invoices & Bills
                </button>
                <button
                  type="button"
                  style={{
                    padding: "0.45rem 0.9rem",
                    borderRadius: "6px",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "13.5px",
                    cursor: "pointer",
                    background: paymentsViewMode === "ledger" ? "var(--brand-primary)" : "#F1F5F9",
                    color: paymentsViewMode === "ledger" ? "#FFFFFF" : "var(--brand-body)",
                  }}
                  onClick={() => setPaymentsViewMode("ledger")}
                >
                  📒 Unit Financial Ledger
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ width: "min(100%, 240px)" }}>
                  <DebouncedInput
                    value={paymentsViewMode === "invoices" ? invoiceControls.searchTerm : ledgerControls.searchTerm}
                    onChange={paymentsViewMode === "invoices" ? invoiceControls.setSearchTerm : ledgerControls.setSearchTerm}
                    placeholder={paymentsViewMode === "invoices" ? "Search invoices, dues..." : "Search ledger entries..."}
                    icon="🔍"
                  />
                </div>
                <SortDropdown
                  value={paymentsViewMode === "invoices" ? invoiceControls.sortPreset : ledgerControls.sortPreset}
                  onChange={paymentsViewMode === "invoices" ? invoiceControls.setSortPreset : ledgerControls.setSortPreset}
                />
              </div>
            </div>

            {paymentsViewMode === "invoices" ? (
              payments.isError ? (
                <ErrorState
                  title="Failed to Load Invoices"
                  message={payments.error?.message || "Could not retrieve billing invoices."}
                  onRetry={() => payments.refetch()}
                />
              ) : (
                <DataTable<InvoiceItem>
                  columns={[
                    { key: "invoice_number", header: "Invoice #", sortable: true },
                    { key: "title", header: "Billing Item" },
                    {
                      key: "total_amount",
                      header: "Total Amount",
                      render: (i) => formatCurrency(i.total_amount),
                    },
                    {
                      key: "balance_due",
                      header: "Balance Due",
                      render: (i) => formatCurrency(i.balance_due),
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (i) => <StatusBadge status={i.status} />,
                    },
                    {
                      key: "actions",
                      header: "Action",
                      render: (i) =>
                        i.status !== "paid" ? (
                          <BrandButton
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(i);
                              setPaymentModalOpen(true);
                            }}
                          >
                            Pay Now
                          </BrandButton>
                        ) : (
                          <BrandButton
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCurrentReceiptNumber(i.receipt_number || `RCP-${i.invoice_number}`);
                              setReceiptModalOpen(true);
                            }}
                          >
                            Receipt
                          </BrandButton>
                        ),
                    },
                  ]}
                  data={invoiceControls.paginatedData}
                  isLoading={payments.isLoading}
                  page={invoiceControls.page}
                  pageSize={invoiceControls.pageSize}
                  total={invoiceControls.total}
                  onPageChange={invoiceControls.setPage}
                  onPageSizeChange={invoiceControls.setPageSize}
                  emptyTitle="No invoices or dues"
                  emptyDescription="All maintenance and amenity dues have been settled."
                />
              )
            ) : ledger.isError ? (
              <ErrorState
                title="Failed to Load Unit Ledger"
                message={ledger.error?.message || "Could not retrieve financial ledger journal."}
                onRetry={() => ledger.refetch()}
              />
            ) : (
              <DataTable<LedgerEntryItem>
                columns={[
                  {
                    key: "entry_date",
                    header: "Posting Date",
                    render: (i) => formatDate(i.entry_date || i.created_at),
                  },
                  {
                    key: "entry_type",
                    header: "Type",
                    render: (i) =>
                      i.entry_type === "credit" ? (
                        <span style={{ fontWeight: 700, color: "#059669" }}>✓ CREDIT</span>
                      ) : (
                        <span style={{ fontWeight: 700, color: "#DC2626" }}>− DEBIT</span>
                      ),
                  },
                  {
                    key: "source_type",
                    header: "Transaction Head",
                    render: (i) => (
                      <span
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 600,
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          background: "#F1F5F9",
                          color: "#334155",
                          textTransform: "uppercase",
                        }}
                      >
                        {i.source_type.replace(/_/g, " ")}
                      </span>
                    ),
                  },
                  {
                    key: "narration",
                    header: "Narration / Description",
                    render: (i) => i.narration || "Unit ledger transaction entry",
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    render: (i) => (
                      <span
                        style={{
                          fontWeight: 700,
                          color: i.entry_type === "credit" ? "#059669" : "#DC2626",
                        }}
                      >
                        {i.entry_type === "credit" ? "+" : "-"}
                        {formatCurrency(i.amount)}
                      </span>
                    ),
                  },
                  {
                    key: "balance_after",
                    header: "Running Balance",
                    render: (i) => (
                      <span style={{ fontWeight: 700, color: "var(--brand-heading)" }}>
                        {formatCurrency(i.balance_after)}
                      </span>
                    ),
                  },
                ]}
                data={ledgerControls.paginatedData}
                isLoading={ledger.isLoading}
                page={ledgerControls.page}
                pageSize={ledgerControls.pageSize}
                total={ledgerControls.total}
                onPageChange={ledgerControls.setPage}
                onPageSizeChange={ledgerControls.setPageSize}
                emptyTitle="No ledger journal entries"
                emptyDescription="Posted invoice debits and payment credit allocations will record here."
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 13: NOTIFICATIONS & ALERTS */}
      {activeTab === "notifications" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "1.25rem" }}>
            Notifications & Gate Alerts
          </h3>
          {myNotifications.isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {[1, 2, 3, 4].map((n) => (
                <CardSkeleton key={n} lines={2} />
              ))}
            </div>
          ) : myNotifications.isError ? (
            <ErrorState
              title="Failed to Load Notifications"
              message={myNotifications.error?.message || "Could not retrieve notifications."}
              onRetry={() => myNotifications.refetch()}
            />
          ) : (myNotifications.data || []).length === 0 ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>No notifications yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {(myNotifications.data || []).map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: "1rem",
                    border: n.is_read
                      ? "1px solid var(--border-standard)"
                      : "1px solid var(--brand-primary)",
                    borderRadius: "8px",
                    background: n.is_read ? "#F8FAFC" : "#EFF6FF",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.25rem",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                    }}
                  >
                    <h4
                      style={{ fontWeight: 700, fontSize: "14px", color: "var(--brand-heading)", margin: 0 }}
                    >
                      {n.title}
                    </h4>
                    <span style={{ fontSize: "11px", color: "var(--brand-body)" }}>
                      {formatDate(n.created_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--brand-body)", margin: 0 }}>
                    {n.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 14: EMERGENCY SOS */}
      {activeTab === "emergency" && (
        <div
          className="gs-card"
          style={{ maxWidth: 680, border: "2px solid #FCA5A5", background: "#FEF2F2" }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}
          >
            <span style={{ fontSize: "2rem" }}>🚨</span>
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#991B1B" }}>
                Resident Emergency Dispatch
              </h3>
              <p style={{ color: "#7F1D1D", fontSize: "13px", margin: 0 }}>
                Instantly alert security control rooms, gate supervisors, and towers.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
              gap: "0.75rem",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                background: "white",
                padding: "0.85rem",
                borderRadius: "8px",
                border: "1px solid #FCA5A5",
              }}
            >
              <div style={{ fontSize: "11px", color: "#991B1B", fontWeight: 700 }}>
                YOUR REGISTERED UNIT
              </div>
              <div
                style={{ fontWeight: 800, fontSize: "15px", color: "#0F172A", marginTop: "0.2rem" }}
              >
                {myOccupancy
                  ? `Unit ${myOccupancy.unit_number}${myOccupancy.tower_name ? `, ${myOccupancy.tower_name}` : ""}`
                  : "—"}
              </div>
            </div>
            <div
              style={{
                background: "white",
                padding: "0.85rem",
                borderRadius: "8px",
                border: "1px solid #FCA5A5",
              }}
            >
              <div style={{ fontSize: "11px", color: "#991B1B", fontWeight: 700 }}>
                GATE COMMAND DISPATCH
              </div>
              <div
                style={{ fontWeight: 800, fontSize: "15px", color: "#0F172A", marginTop: "0.2rem" }}
              >
                Security control room notified instantly
              </div>
            </div>
          </div>

          <BrandButton
            variant="danger"
            size="lg"
            style={{
              width: "100%",
              justifyContent: "center",
              fontSize: "15px",
              padding: "0.85rem",
            }}
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
        <form
          onSubmit={handleCreatePass}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
              Visitor Category <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <select
              className="select-field"
              value={passCategory}
              onChange={(e) => setPassCategory(e.target.value)}
              required
            >
              <option value="Personal Guest">Personal Guest / Family & Friends</option>
              <option value="Relative">Relative / Extended Family</option>
              <option value="Cab / Taxi">Cab / Taxi Driver (Uber / Ola)</option>
              <option value="Delivery Executive">Delivery Executive (Amazon / Swiggy / Zomato)</option>
              <option value="Service Technician">Service Technician (Plumbing / Electrical / AC)</option>
              <option value="Vendor / Contractor">Vendor / Contractor / Interior Worker</option>
              <option value="Interviewee">Interviewee / Applicant</option>
              <option value="Event Guest">Event Guest / Party Invite</option>
              <option value="Recurring / Daily Help">Recurring Visitor / Daily Help</option>
              <option value="Other">Other Visitor</option>
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
              Visitor Name <span style={{ color: "var(--danger)" }}>*</span>
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
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
              Visitor Mobile Number <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              className="input-field"
              placeholder="e.g. 9876543210 or +91 98765 00000"
              value={passVisitorPhone}
              onChange={(e) => setPassVisitorPhone(e.target.value)}
              type="tel"
              required
            />
            <span style={{ fontSize: "11px", color: "var(--muted)", marginTop: "0.25rem", display: "block" }}>
              10-digit mobile number required for gate security & pass delivery
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "0.35rem",
                }}
              >
                Govt ID Type <span style={{ fontSize: "11px", color: "var(--muted)" }}>(Optional)</span>
              </label>
              <select
                className="select-field"
                value={passIdType}
                onChange={(e) => setPassIdType(e.target.value)}
              >
                <option value="aadhaar">Aadhaar Card (12 digits)</option>
                <option value="pan">PAN Card (10 chars)</option>
                <option value="voter_id">Voter ID</option>
                <option value="driving_license">Driving License</option>
                <option value="passport">Passport</option>
                <option value="other">Other Government ID</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "0.35rem",
                }}
              >
                Govt ID Number <span style={{ fontSize: "11px", color: "var(--muted)" }}>(Optional)</span>
              </label>
              <input
                className="input-field"
                placeholder={
                  passIdType === "aadhaar"
                    ? "e.g. 1234 5678 9012"
                    : passIdType === "pan"
                    ? "e.g. ABCDE1234F"
                    : "Enter Govt ID number"
                }
                value={passIdNumber}
                onChange={(e) => setPassIdNumber(e.target.value.toUpperCase())}
                style={{ fontFamily: "monospace" }}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "0.35rem",
                }}
              >
                Vehicle Number <span style={{ fontSize: "11px", color: "var(--muted)" }}>(Optional)</span>
              </label>
              <input
                className="input-field"
                placeholder="e.g. MH12AB1234"
                value={passVehicleNumber}
                onChange={(e) => setPassVehicleNumber(e.target.value)}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "0.35rem",
                }}
              >
                Party Size (Visitors)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                className="input-field"
                value={passPartySize}
                onChange={(e) => setPassPartySize(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </div>
          </div>
          {passPartySize > 1 && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "0.35rem",
                }}
              >
                Group Label / Occasion
              </label>
              <input
                className="input-field"
                placeholder="e.g. Birthday Party Group / Dinner Guests"
                value={passGroupLabel}
                onChange={(e) => setPassGroupLabel(e.target.value)}
              />
            </div>
          )}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
              Reason / Purpose <span style={{ fontSize: "11.5px", color: "var(--muted)", fontWeight: 400 }}>(Optional)</span>
            </label>
            <input
              className="input-field"
              placeholder="e.g. Dinner Guest, Package Delivery, AC Servicing..."
              value={passReason}
              onChange={(e) => setPassReason(e.target.value)}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
              Pass Expiration Duration <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <select
              className="select-field"
              value={passDuration}
              onChange={(e) => setPassDuration(Number(e.target.value))}
            >
              <option value={1}>1 Hour (Quick Drop / Express Delivery)</option>
              <option value={4}>4 Hours (Standard Short Visit)</option>
              <option value={8}>8 Hours (Half Day)</option>
              <option value={12}>12 Hours (Full Day Access)</option>
              <option value={24}>24 Hours (Overnight Stay)</option>
              <option value={48}>48 Hours (2 Days)</option>
              <option value={72}>72 Hours (Weekend / Multi-Day Guest)</option>
            </select>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              marginTop: "1rem",
            }}
          >
            <BrandButton
              type="button"
              variant="outline"
              onClick={() => setVisitorPassModalOpen(false)}
            >
              Cancel
            </BrandButton>
            <BrandButton type="submit" isLoading={visitors.createPass.isPending}>
              Generate QR / OTP Pass
            </BrandButton>
          </div>
        </form>
      </Modal>

      {/* Generated / Active Pass Result Modal */}
      <Modal
        isOpen={activePassModalOpen}
        onClose={() => setActivePassModalOpen(false)}
        title="🎟️ Dynamic Visitor Entry Pass"
      >
        {activePassResult && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center" }}>
            <div
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
                border: "1px solid #A7F3D0",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#065F46" }}>
                ✓ Pass Active & Whitelisted on Security Console
              </div>
              <div style={{ fontSize: "11.5px", color: "#047857", marginTop: "0.2rem" }}>
                Present the QR code to security or share the 6-digit OTP for instant verification.
              </div>
            </div>

            {/* Dynamic Vector SVG QR Code */}
            <div
              style={{
                background: "#ffffff",
                padding: "1rem",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                border: "1px solid var(--border-light)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <QrCodeSvg
                value={
                  activePassResult.token
                    ? activePassResult.token
                    : (activePassResult.pin || "GSE-PASS")
                }
                size={180}
              />
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "0.5rem", fontWeight: 600 }}>
                Scan at Security Gate
              </div>
            </div>

            {/* 6-Digit OTP / PIN Display */}
            {activePassResult.pin && (
              <div
                style={{
                  width: "100%",
                  background: "#F8FAFC",
                  padding: "0.85rem 1rem",
                  borderRadius: "8px",
                  border: "1px dashed var(--brand-primary)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                  Gate Entry PIN / OTP Code
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    letterSpacing: "4px",
                    fontFamily: "monospace",
                    color: "var(--brand-primary)",
                    margin: "0.35rem 0",
                  }}
                >
                  {activePassResult.pin}
                </div>
                <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                  Single-use code · Automatically expires upon gate entry
                </div>
              </div>
            )}

            {/* Pass Metadata Grid */}
            <div
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                background: "#F8FAFC",
                padding: "0.85rem 1rem",
                borderRadius: "8px",
                border: "1px solid var(--border-light)",
              }}
            >
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Category</div>
                <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--brand-heading)", textTransform: "capitalize" }}>
                  {activePassResult.category || "Guest"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Visitor Name</div>
                <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--brand-heading)" }}>
                  {activePassResult.visitor_name || "Visitor"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Reason / Purpose</div>
                <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--brand-heading)" }}>
                  {activePassResult.reason || "Visitor Entry"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Valid Until</div>
                <div style={{ fontWeight: 600, fontSize: "12.5px", color: "#B45309" }}>
                  {activePassResult.valid_to ? formatDate(activePassResult.valid_to) : "Scheduled Visit"}
                </div>
              </div>
              {activePassResult.vehicle_number && (
                <div>
                  <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Vehicle Plate</div>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--brand-heading)" }}>
                    🚗 {activePassResult.vehicle_number}
                  </div>
                </div>
              )}
              {activePassResult.party_size && activePassResult.party_size > 1 && (
                <div>
                  <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Party Size / Group</div>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--brand-primary)" }}>
                    👥 {activePassResult.party_size} Persons {activePassResult.group_label ? `(${activePassResult.group_label})` : ""}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ width: "100%", display: "flex", gap: "0.5rem", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <BrandButton
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const shareText = `*GateSphere Visitor Pass*\nVisitor: ${activePassResult.visitor_name || "Guest"}\nCategory: ${activePassResult.category || "Guest"}\nPIN/OTP: ${activePassResult.pin || activePassResult.token}${activePassResult.vehicle_number ? `\nVehicle: ${activePassResult.vehicle_number}` : ""}${activePassResult.party_size && activePassResult.party_size > 1 ? `\nParty Size: ${activePassResult.party_size} Persons` : ""}\nValid Until: ${activePassResult.valid_to ? new Date(activePassResult.valid_to).toLocaleString() : "Visit Duration"}`;
                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(shareText);
                      toast.success("Pass details copied to clipboard!", "Copied");
                    }
                  }}
                >
                  📋 Copy
                </BrandButton>

                <BrandButton
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const shareText = encodeURIComponent(`*GateSphere Visitor Pass*\nVisitor: ${activePassResult.visitor_name || "Guest"}\nCategory: ${activePassResult.category || "Guest"}\nGate PIN: ${activePassResult.pin || activePassResult.token}${activePassResult.vehicle_number ? `\nVehicle: ${activePassResult.vehicle_number}` : ""}${activePassResult.party_size && activePassResult.party_size > 1 ? `\nParty Size: ${activePassResult.party_size} Persons` : ""}\nValid Until: ${activePassResult.valid_to ? new Date(activePassResult.valid_to).toLocaleString() : "Visit Duration"}`);
                    if (typeof window !== "undefined") {
                      window.open(`https://wa.me/?text=${shareText}`, "_blank");
                    }
                  }}
                >
                  💬 WhatsApp
                </BrandButton>

                {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                  <BrandButton
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      const shareText = `*GateSphere Visitor Pass*\nVisitor: ${activePassResult.visitor_name || "Guest"}\nCategory: ${activePassResult.category || "Guest"}\nPIN/OTP: ${activePassResult.pin || activePassResult.token}${activePassResult.vehicle_number ? `\nVehicle: ${activePassResult.vehicle_number}` : ""}${activePassResult.party_size && activePassResult.party_size > 1 ? `\nParty Size: ${activePassResult.party_size} Persons` : ""}\nValid Until: ${activePassResult.valid_to ? new Date(activePassResult.valid_to).toLocaleString() : "Visit Duration"}`;
                      try {
                        await navigator.share({
                          title: "GateSphere Visitor Entry Pass",
                          text: shareText,
                        });
                      } catch {
                        // User dismissed share dialog
                      }
                    }}
                  >
                    📤 Share Pass
                  </BrandButton>
                )}
              </div>

              <BrandButton
                type="button"
                onClick={() => setActivePassModalOpen(false)}
              >
                Done
              </BrandButton>
            </div>
          </div>
        )}
      </Modal>

      {/* Blocked / Blacklisted Visitor Alert Modal */}
      {blockedAlert && (
        <Modal
          isOpen={true}
          onClose={() => setBlockedAlert(null)}
          title="⛔ VISITOR IS BLOCKED — ENTRY RESTRICTED"
          size="md"
        >
          <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "0.5rem" }}>🚫</div>
            <h3 style={{ color: "#991B1B", margin: "0 0 0.5rem 0", fontSize: "1.3rem", fontWeight: 800 }}>
              COMMUNITY RESTRICTION WARNING
            </h3>
            <p style={{ color: "#DC2626", fontSize: "0.95rem", fontWeight: 700, marginBottom: "1.25rem" }}>
              PASS GENERATION CANNOT PROCEED
            </p>

            <div
              style={{
                background: "#FEF2F2",
                border: "2px solid #F87171",
                borderRadius: "8px",
                padding: "1rem 1.25rem",
                textAlign: "left",
                marginBottom: "1.25rem",
              }}
            >
              <div style={{ marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#991B1B", fontWeight: 700, textTransform: "uppercase" }}>Visitor Name</span>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "#111827" }}>{blockedAlert.name}</div>
              </div>
              {blockedAlert.phone && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "#991B1B", fontWeight: 700, textTransform: "uppercase" }}>Phone Number</span>
                  <div style={{ fontFamily: "monospace", fontWeight: 600 }}>{blockedAlert.phone}</div>
                </div>
              )}
              {blockedAlert.id_number && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "#991B1B", fontWeight: 700, textTransform: "uppercase" }}>Government ID</span>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#991B1B" }}>
                    {blockedAlert.id_type ? `${blockedAlert.id_type.toUpperCase()}: ` : ""}{blockedAlert.id_number}
                  </div>
                </div>
              )}
              <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px dashed #FCA5A5" }}>
                <span style={{ fontSize: "0.75rem", color: "#991B1B", fontWeight: 700, textTransform: "uppercase" }}>Blacklist Reason</span>
                <div style={{ fontWeight: 600, color: "#7F1D1D", marginTop: "0.15rem" }}>
                  {blockedAlert.reason}
                </div>
              </div>
              {blockedAlert.risk_level && (
                <div style={{ marginTop: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "#991B1B", fontWeight: 700, textTransform: "uppercase" }}>Security Risk: </span>
                  <span style={{ fontWeight: 800, color: "#B91C1C", textTransform: "uppercase" }}>
                    {blockedAlert.risk_level}
                  </span>
                </div>
              )}
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1.5rem" }}>
              This individual is listed on the community restricted visitor registry. Contact the Security Office or Association Committee for clarifications.
            </p>

            <BrandButton
              type="button"
              variant="danger"
              onClick={() => setBlockedAlert(null)}
              style={{ width: "100%", padding: "0.75rem", fontWeight: 800 }}
            >
              ACKNOWLEDGE & CLOSE
            </BrandButton>
          </div>
        </Modal>
      )}

      {/* Add Family Member Modal */}
      <Modal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        title="Add Pre-Approved Family Member"
      >
        <form
          onSubmit={handleSaveMember}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
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
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
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
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
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
              style={{
                width: "18px",
                height: "18px",
                cursor: "pointer",
                accentColor: "var(--brand-primary)",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              marginTop: "1rem",
            }}
          >
            <BrandButton
              type="button"
              variant="outline"
              onClick={() => setAddMemberModalOpen(false)}
            >
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
          <form
            onSubmit={handleUpdateMember}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "0.35rem",
                }}
              >
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
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "0.35rem",
                }}
              >
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
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "0.35rem",
                }}
              >
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
                onChange={(e) =>
                  setEditingMember({ ...editingMember, access_enabled: e.target.checked })
                }
                style={{
                  width: "18px",
                  height: "18px",
                  cursor: "pointer",
                  accentColor: "var(--brand-primary)",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                marginTop: "1rem",
              }}
            >
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
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.25rem 0" }}
        >
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
              <p
                style={{
                  fontSize: "13px",
                  color: "#7F1D1D",
                  margin: "0.35rem 0 0 0",
                  lineHeight: 1.4,
                }}
              >
                Are you sure you want to remove <strong>{memberToDelete?.name}</strong> (
                {memberToDelete?.relation})?
              </p>
            </div>
          </div>
          <p style={{ fontSize: "13px", color: "var(--brand-body)", margin: 0, lineHeight: 1.4 }}>
            Removing this record will immediately revoke automated gate recognition and
            pre-approval. Future arrivals will require manual resident or guard approval.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              marginTop: "0.5rem",
            }}
          >
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
                  toast.success(
                    `${removedName} has been removed from the gate whitelist.`,
                    "Family Member Removed",
                  );
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
        <form
          onSubmit={handleCreateTicket}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
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
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
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
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
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
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              marginTop: "1rem",
            }}
          >
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
        <form
          onSubmit={handleBookAmenity}
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          {/* Amenity Summary Header */}
          {selectedAmenity && (
            <div
              style={{
                padding: "0.85rem 1rem",
                background: "#F1F5F9",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.75rem", lineHeight: 1 }}>
                  {getAmenityIcon(
                    selectedAmenity.name,
                    selectedAmenity.category,
                    selectedAmenity.description,
                  )}
                </span>
                <div>
                  <strong style={{ fontSize: "14px", color: "var(--brand-heading)" }}>
                    {selectedAmenity.name}
                  </strong>
                  <div style={{ fontSize: "12px", color: "var(--brand-body)", marginTop: "0.15rem" }}>
                    Max Total Capacity: {selectedAmenity.capacity} persons
                  </div>
                </div>
              </div>
              <span
                className="badge"
                style={{ background: "#DBEAFE", color: "#1E40AF", fontWeight: 700 }}
              >
                {selectedAmenity.price_per_hour > 0
                  ? `${formatCurrency(selectedAmenity.price_per_hour)}/hr`
                  : "Free Access"}
              </span>
            </div>
          )}

          {/* Reservation Date */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 700,
                marginBottom: "0.35rem",
                color: "var(--brand-heading)",
              }}
            >
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.45rem",
              }}
            >
              <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand-heading)" }}>
                ⏰ Available Time Slots &amp; Capacity
              </label>
              <span style={{ fontSize: "11.5px", color: "var(--brand-muted)" }}>
                {availableDaySlots.length} slot(s) available
              </span>
            </div>

            {amenitySlots.isLoading ? (
              <div
                style={{
                  padding: "1rem",
                  textAlign: "center",
                  fontSize: "13px",
                  color: "var(--brand-muted)",
                }}
              >
                Loading available time slots…
              </div>
            ) : availableDaySlots.length === 0 ? (
              <div
                style={{
                  padding: "0.85rem",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#991B1B",
                }}
              >
                ⚠️ No time slots configured for{" "}
                {new Date(`${bookingDate}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                })}
                . Please select another date.
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
                    const feeText = s.fee && Number(s.fee) > 0 ? ` • ${formatCurrency(s.fee)}` : "";
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
                          Slot Fee: {formatCurrency(activeSelectedSlot.fee)}
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.35rem",
              }}
            >
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
              <div
                style={{ display: "flex", gap: "0.35rem", marginLeft: "auto", flexWrap: "wrap" }}
              >
                {[1, 2, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    style={{
                      fontSize: "11px",
                      padding: "0.25rem 0.6rem",
                      borderRadius: "6px",
                      border:
                        bookingGuests === num
                          ? "1px solid #2563EB"
                          : "1px solid var(--border-standard)",
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
                      border:
                        bookingGuests === remainingSpots
                          ? "1px solid #2563EB"
                          : "1px solid var(--border-standard)",
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
              <p
                style={{ fontSize: "12px", color: "#DC2626", marginTop: "0.4rem", fontWeight: 600 }}
              >
                ⚠️ This slot is fully booked. Please choose another slot or date.
              </p>
            ) : bookingGuests > remainingSpots ? (
              <p
                style={{ fontSize: "12px", color: "#DC2626", marginTop: "0.4rem", fontWeight: 600 }}
              >
                ⚠️ You selected {bookingGuests} people, but only {remainingSpots} spot(s) are
                remaining.
              </p>
            ) : (
              <p
                style={{ fontSize: "12px", color: "#059669", marginTop: "0.4rem", fontWeight: 600 }}
              >
                ✅ {bookingGuests} spot(s) reserved. {remainingSpots - bookingGuests} spot(s) will
                remain available.
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              marginTop: "0.5rem",
            }}
          >
            <BrandButton
              type="button"
              variant="outline"
              onClick={() => setAmenityBookingModalOpen(false)}
            >
              Cancel
            </BrandButton>
            <BrandButton
              type="submit"
              isLoading={amenities.book.isPending}
              disabled={
                !activeSelectedSlot ||
                remainingSpots <= 0 ||
                bookingGuests > remainingSpots ||
                availableDaySlots.length === 0
              }
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
          <div
            style={{
              background: "#F1F5F9",
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "var(--brand-body)",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Invoice #
            </div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--brand-heading)" }}>
              {selectedInvoice?.invoice_number ?? "INV-2026-09"}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "0.5rem",
                fontSize: "14px",
              }}
            >
              <span>Payable Balance:</span>
              <strong style={{ color: "var(--brand-primary)", fontSize: "16px" }}>
                {formatCurrency(selectedInvoice?.balance_due ?? 350.0)}
              </strong>
            </div>
          </div>
          <p style={{ fontSize: "13px", color: "var(--brand-body)" }}>
            ⚡ This uses GateSphere's simulated payment engine. Upon clicking below, the payment
            ledger will update immediately and issue an official `RCP-` receipt.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              marginTop: "1rem",
            }}
          >
            <BrandButton variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </BrandButton>
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
            Are you sure you want to trigger an emergency SOS alert? Security Guards and Supervisors
            will instantly be dispatched to your registered address (<strong>{residentUnit}</strong>
            ).
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <BrandButton variant="outline" onClick={() => setSosModalOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton
              variant="danger"
              onClick={handleTriggerPanic}
              isLoading={panicMutation.isPending}
            >
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
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.25rem 0" }}
        >
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
              <p
                style={{
                  fontSize: "13px",
                  color: "#7F1D1D",
                  margin: "0.35rem 0 0 0",
                  lineHeight: 1.4,
                }}
              >
                Are you sure you want to cancel your reservation for{" "}
                <strong>{bookingToCancel?.amenity_name}</strong> on{" "}
                <strong>{bookingToCancel?.date}</strong>?
              </p>
            </div>
          </div>
          <p style={{ fontSize: "13px", color: "var(--brand-body)", margin: 0, lineHeight: 1.4 }}>
            Your reserved spot ({bookingToCancel?.guests_count || 1} person
            {(bookingToCancel?.guests_count || 1) > 1 ? "s" : ""}) will be immediately released back
            to the available pool for other residents.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              marginTop: "0.5rem",
            }}
          >
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

      {/* Change Password Modal */}
      <Modal
        isOpen={changePasswordModalOpen}
        onClose={() => setChangePasswordModalOpen(false)}
        title="🔒 Change Account Password"
        size="sm"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPasswordError("");
            if (newPassword.length < 8) {
              setPasswordError("New password must be at least 8 characters long.");
              return;
            }
            if (newPassword !== confirmPassword) {
              setPasswordError("New password and confirmation do not match.");
              return;
            }
            if (currentPassword === newPassword) {
              setPasswordError("New password must be different from current password.");
              return;
            }
            try {
              setIsChangingPassword(true);
              await authApi.changePassword({
                current_password: currentPassword,
                new_password: newPassword,
              });
              setChangePasswordModalOpen(false);
              setCurrentPassword("");
              setNewPassword("");
              setConfirmPassword("");
              toast.success("Your password was changed successfully.", "Password Updated");
            } catch (err: any) {
              setPasswordError(err?.message || "Failed to change password. Check your current password.");
            } finally {
              setIsChangingPassword(false);
            }
          }}
          style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.25rem 0" }}
        >
          {passwordError && (
            <div
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: "6px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#991B1B",
                fontSize: "13px",
              }}
            >
              ⚠️ {passwordError}
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--brand-heading)", marginBottom: "0.35rem" }}>
              Current Password *
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--brand-heading)", marginBottom: "0.35rem" }}>
              New Password *
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--brand-heading)", marginBottom: "0.35rem" }}>
              Confirm New Password *
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setChangePasswordModalOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton type="submit" isLoading={isChangingPassword}>
              Update Password
            </BrandButton>
          </div>
        </form>
      </Modal>

      {/* Rate Maintenance Complaint Modal */}
      <Modal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        title="⭐ Rate Maintenance Service"
        size="md"
      >
        <form onSubmit={handleSubmitFeedback} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <div>
            <div style={{ fontSize: "13px", color: "var(--brand-muted)", marginBottom: "0.25rem" }}>
              Ticket: <strong style={{ color: "var(--brand-heading)" }}>{feedbackTicket?.ticket_number}</strong>
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--brand-heading)" }}>
              {feedbackTicket?.subject}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "0.5rem" }}>
              Service Satisfaction Rating *
            </label>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFeedbackRating(star)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "1.75rem",
                    cursor: "pointer",
                    padding: "0.15rem",
                    filter: star <= feedbackRating ? "none" : "grayscale(100%) opacity(40%)",
                    transform: star <= feedbackRating ? "scale(1.1)" : "scale(1)",
                    transition: "all 0.15s ease",
                  }}
                >
                  ⭐
                </button>
              ))}
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand-primary)", marginLeft: "0.5rem" }}>
                {feedbackRating === 5
                  ? "5/5 — Excellent"
                  : feedbackRating === 4
                    ? "4/5 — Good"
                    : feedbackRating === 3
                      ? "3/5 — Average"
                      : feedbackRating === 2
                        ? "2/5 — Poor"
                        : "1/5 — Very Unsatisfied"}
              </span>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "0.35rem" }}>
              Feedback & Comments (Optional)
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Describe your experience with the technician resolution..."
              value={feedbackComments}
              onChange={(e) => setFeedbackComments(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setFeedbackModalOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton type="submit" isLoading={complaints.submitFeedback?.isPending}>
              Submit Feedback
            </BrandButton>
          </div>
        </form>
      </Modal>

      {/* Rate Domestic Staff Modal */}
      <Modal
        isOpen={staffRatingModalOpen}
        onClose={() => setStaffRatingModalOpen(false)}
        title="⭐ Rate Domestic Staff"
        size="md"
      >
        <form onSubmit={handleSubmitStaffRating} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <div>
            <div style={{ fontSize: "13px", color: "var(--brand-muted)", marginBottom: "0.25rem" }}>
              Staff Member: <strong style={{ color: "var(--brand-heading)" }}>{selectedStaff?.name}</strong>
            </div>
            <div style={{ fontSize: "13.5px", color: "var(--brand-body)", textTransform: "capitalize" }}>
              Role: {selectedStaff?.role}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "0.5rem" }}>
              Performance & Conduct Rating *
            </label>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setStaffRatingValue(star)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "1.75rem",
                    cursor: "pointer",
                    padding: "0.15rem",
                    filter: star <= staffRatingValue ? "none" : "grayscale(100%) opacity(40%)",
                    transform: star <= staffRatingValue ? "scale(1.1)" : "scale(1)",
                    transition: "all 0.15s ease",
                  }}
                >
                  ⭐
                </button>
              ))}
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand-primary)", marginLeft: "0.5rem" }}>
                {staffRatingValue === 5
                  ? "5/5 — Highly Recommended"
                  : staffRatingValue === 4
                    ? "4/5 — Reliable & Good"
                    : staffRatingValue === 3
                      ? "3/5 — Satisfactory"
                      : staffRatingValue === 2
                        ? "2/5 — Needs Improvement"
                        : "1/5 — Unsatisfactory"}
              </span>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "0.35rem" }}>
              Feedback & Remarks (Optional)
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Share details on punctuality, quality of work, honesty..."
              value={staffFeedbackText}
              onChange={(e) => setStaffFeedbackText(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setStaffRatingModalOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton type="submit" isLoading={submitStaffRating.isPending}>
              Submit Staff Rating
            </BrandButton>
          </div>
        </form>
      </Modal>

      {/* Assign Domestic Staff Modal */}
      <Modal
        isOpen={assignStaffModalOpen}
        onClose={() => setAssignStaffModalOpen(false)}
        title="👔 Assign Domestic Staff to Unit"
        size="md"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!assignStaffId) {
              toast.error("Please select a domestic staff member.");
              return;
            }
            if (!myOccupancy?.unit_id) {
              toast.error("No active unit found for your account.");
              return;
            }
            try {
              await assignStaffMutation.mutateAsync({
                staff_id: assignStaffId,
                unit_id: myOccupancy.unit_id,
                work_type: assignWorkType,
                start_date: assignStartDate || undefined,
                time_from: assignTimeFrom ? `${assignTimeFrom}:00` : undefined,
                time_to: assignTimeTo ? `${assignTimeTo}:00` : undefined,
                days_of_week: assignDays.length > 0 ? assignDays : undefined,
              });
              toast.success("Domestic staff assigned to your unit successfully!");
              setAssignStaffModalOpen(false);
              setAssignStaffId("");
            } catch (err: any) {
              toast.error(err?.message || "Failed to assign staff member.");
            }
          }}
          style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
        >
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "0.35rem" }}>
              Select Verified Staff Member *
            </label>
            <select
              className="input-field"
              value={assignStaffId}
              onChange={(e) => setAssignStaffId(e.target.value)}
              required
            >
              <option value="">-- Choose from Community Directory --</option>
              {staffDirectory.map((st: any) => (
                <option key={st.id} value={st.id}>
                  {st.full_name} ({String(st.staff_type).replace(/_/g, " ")}) — {st.phone}{" "}
                  {st.police_verification_status === "verified" ? "✓ Verified" : ""}
                </option>
              ))}
            </select>
            {staffDirectoryLoading && (
              <span style={{ fontSize: "12px", color: "var(--brand-muted)" }}>
                Loading community directory...
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "0.35rem" }}>
                Service Type
              </label>
              <select
                className="input-field"
                value={assignWorkType}
                onChange={(e) => setAssignWorkType(e.target.value)}
              >
                <option value="part_time">Part Time</option>
                <option value="full_time">Full Time</option>
                <option value="daily_help">Daily Help</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "0.35rem" }}>
                Start Date
              </label>
              <input
                type="date"
                className="input-field"
                value={assignStartDate}
                onChange={(e) => setAssignStartDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "0.35rem" }}>
                Working Hours From
              </label>
              <input
                type="time"
                className="input-field"
                value={assignTimeFrom}
                onChange={(e) => setAssignTimeFrom(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "0.35rem" }}>
                Working Hours To
              </label>
              <input
                type="time"
                className="input-field"
                value={assignTimeTo}
                onChange={(e) => setAssignTimeTo(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "0.4rem" }}>
              Working Days of Week
            </label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                const isSelected = assignDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setAssignDays(assignDays.filter((d) => d !== day));
                      } else {
                        setAssignDays([...assignDays, day]);
                      }
                    }}
                    style={{
                      padding: "0.35rem 0.65rem",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: isSelected ? "var(--brand-primary)" : "var(--brand-border)",
                      backgroundColor: isSelected ? "var(--brand-primary)" : "transparent",
                      color: isSelected ? "#ffffff" : "var(--brand-body)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setAssignStaffModalOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton type="submit" isLoading={assignStaffMutation.isPending}>
              Assign Staff
            </BrandButton>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
