"use client";

import React, { useState, useEffect, useRef } from "react";
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
import {
  Skeleton,
  KpiCardSkeleton,
  TableSkeleton,
  CardSkeleton,
} from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import {
  FamilyMemberPassModal,
  FamilyMemberPassData,
} from "@/components/common/FamilyMemberPassModal";
import { GATESPHERE_LOGO_BASE64 } from "@/lib/logo-base64";

const QrCodeSvg = dynamic(() => import("@/components/common/QrCodeSvg").then((m) => m.QrCodeSvg), {
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
});
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
  useRegisterVehicle,
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
  ResidentVehicle,
} from "@/hooks/use-owner-tenant-data";
import { useAnnouncements, useEventRsvp } from "@/hooks/use-communication";
import {
  useMyNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/use-notifications";
import { useTableControls } from "@/hooks/use-table-controls";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  getAmenityIcon,
  isValidPersonName,
} from "@/lib/utils";
import { authApi, gateApi } from "@/lib/api";
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
  | "notices"
  | "complaints"
  | "vehicles"
  | "domestic-staff"
  | "payments"
  | "notifications"
  | "emergency";

import { toast } from "@/store/toast";
import { PASSWORD_MIN_LENGTH } from "@/constants/password";
import { DeliveryProtocolSettings } from "@/components/deliveries/DeliveryProtocolSettings";
import { ReportViolationModal } from "@/components/vehicles/ReportViolationModal";
import { useLivePollInterval } from "@/hooks/use-realtime";

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
  const todayDateStr = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();
  const [bookingDate, setBookingDate] = useState(todayDateStr);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [bookingGuests, setBookingGuests] = useState<number>(1);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [currentReceiptNumber, setCurrentReceiptNumber] = useState("");
  const [activeReceiptData, setActiveReceiptData] = useState<{
    receipt_number: string;
    payment_reference: string;
    invoice_number: string;
    title: string;
    amount_paid: number;
    total_amount: number;
    balance_due: number;
    paid_at: string;
    payment_method: string;
    unit_number?: string;
    payer_name?: string;
    line_items?: {
      head: string;
      description?: string;
      quantity?: number;
      unit_rate?: number;
      amount: number;
      taxable?: boolean;
    }[];
  } | null>(null);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null);
  const [selectedFamilyPassMember, setSelectedFamilyPassMember] =
    useState<FamilyMemberPassData | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRelation, setNewMemberRelation] = useState("Spouse");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberAccess, setNewMemberAccess] = useState(true);
  const [addMemberErrors, setAddMemberErrors] = useState<Record<string, string>>({});
  const [editMemberErrors, setEditMemberErrors] = useState<Record<string, string>>({});

  // Resident Profile edit state
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileFullName, setProfileFullName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmergencyName, setProfileEmergencyName] = useState("");
  const [profileEmergencyPhone, setProfileEmergencyPhone] = useState("");
  const [profileEmergencyRel, setProfileEmergencyRel] = useState("Spouse");
  const [profileEmergencyNotes, setProfileEmergencyNotes] = useState("");
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({});

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
  const [passFieldErrors, setPassFieldErrors] = useState<Record<string, string>>({});
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
  const [assignDays, setAssignDays] = useState<string[]>([
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ]);
  const assignStaffMutation = useAssignDomesticStaff();
  const endAssignmentMutation = useEndDomesticStaffAssignment();
  const { data: staffDirectory = [], isLoading: staffDirectoryLoading } =
    useCommunityStaffDirectory();

  // Vehicle self-registration modal state
  const [registerVehicleModalOpen, setRegisterVehicleModalOpen] = useState(false);
  const [reportParkingOpen, setReportParkingOpen] = useState(false);
  const [vehRegNumber, setVehRegNumber] = useState("");
  const [vehType, setVehType] = useState("car");
  const [vehMake, setVehMake] = useState("");
  const [vehModel, setVehModel] = useState("");
  const [vehColor, setVehColor] = useState("");
  const [vehErrors, setVehErrors] = useState<Record<string, string>>({});
  const registerVehicleMutation = useRegisterVehicle();

  // Payments view mode ("invoices" vs "ledger")
  const [paymentsViewMode, setPaymentsViewMode] = useState<"invoices" | "ledger">("invoices");

  // Dismissed state for live visitor approval banner (per-visitor, not per-session)
  const [dismissedVisitorId, setDismissedVisitorId] = useState<string | null>(null);
  const [deliveryBannerDismissed, setDeliveryBannerDismissed] = useState(false);

  // Visitor Photo Lightbox Preview state
  const [previewPhoto, setPreviewPhoto] = useState<{
    url: string;
    title: string;
    subtitle?: string;
  } | null>(null);

  // Emergency SOS state
  const [emergencyType, setEmergencyType] = useState<string>("medical");
  const [emergencyNote, setEmergencyNote] = useState<string>("");
  const [emergencyLocationDetail, setEmergencyLocationDetail] = useState<string>("");

  // Data queries — each module page renders this view with one tab, so a query only runs
  // on the tab(s) that display it (everything else stays idle: no request at all).
  // `profile` is small and feeds the unit id every modal needs, so it is always on.
  const on = (...tabs: OwnerTenantTab[]) => ({ enabled: tabs.includes(activeTab) });
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useResidentOverview(activeCommunityId, on("overview", "payments"));
  const visitors = useResidentVisitors(on("overview", "visitors", "notifications"));
  const deliveries = useResidentDeliveries(on("overview", "deliveries", "notifications"));
  const amenities = useResidentAmenities(on("overview", "amenities"));
  const complaints = useResidentComplaints(on("overview", "complaints"));
  const payments = useResidentPayments(on("overview", "payments"));
  const family = useResidentFamilyMembers(on("family-members"));
  const profile = useResidentProfile();
  const myOccupancy = profile.data?.occupancies?.[0];
  const deliveryProtocols = useResidentDeliveryProtocols(on("deliveries"));
  const vehicles = useResidentVehicles(on("vehicles", "property"));
  const domesticStaff = useResidentDomesticStaff(
    myOccupancy?.unit_id,
    on("overview", "domestic-staff"),
  );
  // Maintenance tab: scheduled-upkeep notices only. Community Notices: everything else
  // (general circulars, events with RSVP, polls). Filtered server-side by `category`.
  const announcements = useAnnouncements({ category: "maintenance" }, on("maintenance"));
  const communityNotices = useAnnouncements({ exclude_category: "maintenance" }, on("notices"));
  const noticeFeed = activeTab === "notices" ? communityNotices : announcements;
  const myNotifications = useMyNotifications({ page_size: 20 }, on("notifications"));
  const queryClient = useQueryClient();
  const markNotificationRead = useMarkNotificationRead();
  const markAllNotificationsRead = useMarkAllNotificationsRead();
  const [actionedNotifications, setActionedNotifications] = useState<
    Record<string, "approved" | "rejected">
  >(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("gs_actioned_notifs");
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {};
  });

  const updateActionedNotification = (id: string, action: "approved" | "rejected") => {
    setActionedNotifications((prev) => {
      const next = { ...prev, [id]: action };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("gs_actioned_notifs", JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };
  const [notifFilter, setNotifFilter] = useState<"all" | "unread">("all");
  const panicMutation = useSendResidentPanic();
  const submitStaffRating = useSubmitStaffRating();
  const eventRsvp = useEventRsvp();
  const [rsvpPendingKey, setRsvpPendingKey] = useState<string | null>(null);

  const visitorList = visitors.data || [];
  const deliveryList = deliveries.data || [];
  const complaintList = complaints.data || [];
  const invoiceList = payments.data || [];

  // SOS status is only shown on the emergency tab. Realtime `gate` hints refresh it; the
  // 5 s poll is the fallback while the socket is down (60 s safety net while it is up).
  const alertsPoll = useLivePollInterval(5_000, 60_000);
  const { data: myAlerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ["resident", "alerts"],
    queryFn: async () => {
      try {
        const res = await gateApi.alerts({ page_size: 20 });
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
    enabled: activeTab === "emergency",
    refetchInterval: alertsPoll,
  });
  const activeResidentAlert = (myAlerts as any[]).find(
    (a: any) => a.status === "active" || a.status === "acknowledged",
  );

  const ledger = useResidentLedger(myOccupancy?.unit_id, on("payments"));
  const ledgerList = ledger.data || [];
  const nextDueInvoice = invoiceList.find((i) => i.balance_due > 0);

  // Dynamic Open Service Tickets from real-time records
  const openTicketsList = complaintList.filter(
    (t) => t.status !== "resolved" && t.status !== "closed" && t.status !== "cancelled",
  );
  const openServiceTicketsCount =
    complaints.data !== undefined ? openTicketsList.length : (stats?.open_service_tickets ?? 0);
  const openTicket =
    openTicketsList.length > 0
      ? [...openTicketsList].sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
        )[0]
      : undefined;

  const activeStaffCount = (domesticStaff.data || []).filter((s) => s.is_active).length;

  // Dynamic Booked Amenities from real-time records
  const activeBookingsList = (amenities.bookings.data || []).filter(
    (b) =>
      b.status === "confirmed" &&
      (!b.date || new Date(`${b.date}T23:59:59`).getTime() >= Date.now() - 86400000),
  );
  const bookedAmenitiesCount =
    amenities.bookings.data !== undefined
      ? activeBookingsList.length
      : (stats?.upcoming_amenity_bookings ?? 0);
  const nextBooking =
    activeBookingsList.length > 0
      ? [...activeBookingsList].sort(
          (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
        )[0]
      : undefined;

  const pendingVisitor = visitorList.find((v) => v.status === "pending");
  const visitorBannerDismissed = Boolean(
    pendingVisitor && dismissedVisitorId === pendingVisitor.id,
  );
  const pendingDelivery = deliveryList.find(
    (d) =>
      d.approval_status === "pending" &&
      !["collected", "delivered", "cancelled", "rejected", "approved"].includes(d.status),
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
    data: vehicles.vehiclesList || [],
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

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      // Only what this tab shows: `.refetch()` would bypass `enabled` and load every tab.
      await queryClient.invalidateQueries({ queryKey: ["resident"], refetchType: "active" });
      toast.success("Resident operational data and alerts refreshed.", "Data Updated");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDecideDelivery = async (deliveryId: string, approved: boolean) => {
    try {
      await deliveries.decideDelivery.mutateAsync({
        deliveryId,
        approved,
        remarks: approved ? "Approved by resident from portal" : "Denied by resident from portal",
      });
      await deliveries.refetch();
      refetchStats?.();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });

      // Synchronize action in notification inbox
      const notifsList = Array.isArray(myNotifications.data) ? (myNotifications.data as any[]) : [];
      for (const n of notifsList) {
        if (n.reference_id === deliveryId) {
          updateActionedNotification(n.id, approved ? "approved" : "rejected");
        }
      }

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
      await complaints.refetch();
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
      await domesticStaff.refetch();
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

  // Which RSVP button is in flight: only that button shows a spinner and only that event's
  // buttons are disabled (a shared `isPending` put every RSVP button on the page into
  // "Loading…"). The ref is the synchronous double-click guard (AGENTS.md §5.4).
  const [rsvpBusy, setRsvpBusy] = useState<{ id: string; response: string } | null>(null);
  const rsvpInFlight = useRef<Set<string>>(new Set());

  const handleEventRsvp = async (
    announcementId: string,
    response: "going" | "maybe" | "not_going",
  ) => {
    if (rsvpInFlight.current.has(announcementId)) return;
    rsvpInFlight.current.add(announcementId);
    setRsvpBusy({ id: announcementId, response });
    try {
      await eventRsvp.mutateAsync({
        announcementId,
        response,
        guests: 1,
      });
      await queryClient.invalidateQueries({ queryKey: ["announcements"], refetchType: "active" });
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
    } finally {
      rsvpInFlight.current.delete(announcementId);
      setRsvpBusy(null);
    }
  };

  const handleRegisterVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const plate = vehRegNumber.trim().toUpperCase();
    if (!plate || plate.length < 4 || !/^[A-Z0-9\s\-]+$/.test(plate)) {
      toast.error(
        "Please enter a valid license plate number (e.g. MH 12 AB 1234).",
        "Plate Required",
      );
      return;
    }
    try {
      await registerVehicleMutation.mutateAsync({
        registration_number: plate,
        vehicle_type: vehType,
        make: vehMake.trim() || undefined,
        model: vehModel.trim() || undefined,
        color: vehColor.trim() || undefined,
      });
      await vehicles.refetch();
      refetchStats?.();
      toast.success(`Vehicle ${plate} registered successfully!`, "Vehicle Registered");
      setRegisterVehicleModalOpen(false);
      setVehRegNumber("");
      setVehMake("");
      setVehModel("");
      setVehColor("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to register vehicle.", "Error");
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
        await visitors.refetch();
        refetchStats?.();
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
      if (pendingVisitor) setDismissedVisitorId(pendingVisitor.id);

      // Synchronize action in notification inbox
      const notifsList = Array.isArray(myNotifications.data) ? (myNotifications.data as any[]) : [];
      for (const n of notifsList) {
        if (
          n.reference_id === requestId ||
          (pendingVisitor &&
            n.title &&
            n.title.toLowerCase().includes(pendingVisitor.visitor_name.toLowerCase())) ||
          (pendingVisitor &&
            (n.body || (n as any).message) &&
            (n.body || (n as any).message)
              .toLowerCase()
              .includes(pendingVisitor.visitor_name.toLowerCase()))
        ) {
          updateActionedNotification(n.id, approved ? "approved" : "rejected");
        }
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
    const errors: Record<string, string> = {};

    if (!passCategory) {
      errors.category = "Please select a visitor category.";
    }

    const trimmedVisitorName = passVisitorName.trim();
    if (!trimmedVisitorName) {
      errors.visitor_name = "Please enter the visitor's full name.";
    } else if (trimmedVisitorName.length < 2) {
      errors.visitor_name = "Visitor name is too short (must be at least 2 characters).";
    } else if (trimmedVisitorName.length > 35) {
      errors.visitor_name = "Visitor name exceeds maximum length (cannot exceed 35 characters).";
    } else if (!isValidPersonName(trimmedVisitorName)) {
      errors.visitor_name = "Visitor name must contain only alphabetic letters and spaces.";
    }

    const rawPhone = passVisitorPhone.trim();
    if (!rawPhone) {
      errors.phone = "Visitor mobile number is required.";
    } else {
      const cleanPhoneRaw = rawPhone.replace(/[\s\-()]/g, "");
      if (!/^\+?[0-9]+$/.test(cleanPhoneRaw)) {
        errors.phone = "Mobile number must contain digits only.";
      } else {
        let digits = cleanPhoneRaw;
        if (digits.startsWith("+91")) {
          digits = digits.slice(3);
        } else if (digits.startsWith("+")) {
          digits = digits.slice(1);
        } else if (digits.startsWith("0") && digits.length === 11) {
          digits = digits.slice(1);
        }

        if (digits.length === 10) {
          if (!/^[6-9]\d{9}$/.test(digits)) {
            errors.phone = "Valid 10-digit mobile number must start with 6, 7, 8, or 9.";
          }
        } else {
          errors.phone =
            "Mobile number must be a valid 10-digit number (e.g. 9876543210 or +91 9876543210).";
        }
      }
    }

    const trimmedId = passIdNumber.trim();
    if (trimmedId) {
      const idTypeNorm = passIdType.toLowerCase();
      const cleanId = trimmedId.replace(/[\s-]/g, "").toUpperCase();
      if (idTypeNorm === "aadhaar") {
        if (!/^\d{12}$/.test(cleanId)) {
          errors.id_number = "Aadhaar number must be exactly 12 numeric digits.";
        } else if (/^(\d)\1{11}$/.test(cleanId)) {
          errors.id_number = "Aadhaar number cannot contain all identical repeating digits.";
        }
      } else if (idTypeNorm === "pan") {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanId)) {
          errors.id_number = "PAN Card must be 10 characters in format ABCDE1234F.";
        }
      } else if (idTypeNorm === "voter_id") {
        if (!/^[A-Z0-9]{8,16}$/.test(cleanId)) {
          errors.id_number = "Voter ID must be 8-16 alphanumeric characters (e.g. ABC1234567).";
        }
      } else if (idTypeNorm === "driving_license") {
        if (!/^[A-Z0-9]{10,20}$/.test(cleanId)) {
          errors.id_number = "Driving license must be 10-20 alphanumeric characters.";
        }
      } else if (idTypeNorm === "passport") {
        if (!/^[A-Z][0-9]{7,8}$/.test(cleanId) && !/^[A-Z0-9]{8,9}$/.test(cleanId)) {
          errors.id_number =
            "Passport number must be 8-9 characters starting with a letter (e.g. A1234567).";
        }
      } else {
        if (cleanId.length < 4 || cleanId.length > 40) {
          errors.id_number = "Govt ID number must be between 4 and 40 characters.";
        }
      }
    }

    const trimmedVeh = passVehicleNumber.trim();
    if (trimmedVeh) {
      const cleanVeh = trimmedVeh.replace(/[\s-]/g, "").toUpperCase();
      if (!/^[A-Z0-9]{4,15}$/.test(cleanVeh)) {
        errors.vehicle_number = "Please enter a valid vehicle plate (e.g. MH12AB1234).";
      }
    }

    if (Object.keys(errors).length > 0) {
      setPassFieldErrors(errors);
      const firstMsg = Object.values(errors)[0];
      toast.error(firstMsg, "Validation Error");
      return;
    }
    setPassFieldErrors({});

    let cleanPhone = rawPhone.replace(/[\s\-()]/g, "");
    if (!cleanPhone.startsWith("+")) {
      if (cleanPhone.length === 10) {
        cleanPhone = `+91${cleanPhone}`;
      } else if (cleanPhone.startsWith("0") && cleanPhone.length === 11) {
        cleanPhone = `+91${cleanPhone.slice(1)}`;
      } else {
        cleanPhone = `+${cleanPhone}`;
      }
    }

    try {
      const activeUnitId = profile.data?.occupancies?.[0]?.unit_id;
      const res = await visitors.createPass.mutateAsync({
        visitor_name: trimmedVisitorName,
        phone: cleanPhone,
        id_type: trimmedId ? passIdType : undefined,
        id_number: trimmedId ? trimmedId.replace(/[\s-]/g, "").toUpperCase() : undefined,
        category: passCategory,
        reason: passReason.trim(),
        valid_for_hours: passDuration,
        unit_id: activeUnitId,
        vehicle_number: passVehicleNumber.trim() || undefined,
        party_size: passPartySize,
        group_label: passGroupLabel.trim() || undefined,
      });
      await visitors.refetch();
      refetchStats?.();
      setVisitorPassModalOpen(false);
      setActivePassResult({
        token: res.token,
        pin: res.pin,
        visitor_name: res.visitor_name || trimmedVisitorName,
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
      setPassFieldErrors({});
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
          name: trimmedVisitorName || "Visitor",
          phone: cleanPhone,
          id_type: trimmedId ? passIdType : undefined,
          id_number: trimmedId ? trimmedId.replace(/[\s-]/g, "").toUpperCase() : undefined,
          reason:
            err?.fields?.reason || err?.message || "Visitor is flagged on the community blacklist.",
          risk_level: err?.fields?.risk_level || "HIGH",
        });
        toast.error(
          "Pass generation blocked: Visitor is blacklisted by community security.",
          "Entry Denied",
        );
        return;
      }
      const fieldMsg = err?.fields ? Object.values(err.fields).join(" · ") : null;
      toast.error(
        fieldMsg || err?.message || "Failed to generate visitor pass.",
        "Pass Generation Error",
      );
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const subject = ticketSubject.trim();
    if (!subject || subject.length < 3) {
      toast.error(
        "Please enter a summary of the issue (at least 3 characters).",
        "Subject Required",
      );
      return;
    }
    const desc = ticketDescription.trim();
    if (!desc || desc.length < 5) {
      toast.error(
        "Please provide a description of the issue (at least 5 characters).",
        "Description Required",
      );
      return;
    }
    try {
      await complaints.createTicket.mutateAsync({
        subject,
        category: ticketCategory,
        description: desc,
        priority: ticketPriority || "medium",
      });
      await complaints.refetch();
      refetchStats?.();
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
    (s) => s.is_active && s.day_of_week === currentDayOfWeek,
  );

  // Helper to determine if a slot has already completed / elapsed on the given date
  const isSlotInPast = (slot: AmenitySlot | undefined, dateStr: string) => {
    if (!slot || !dateStr) return false;
    if (dateStr < todayDateStr) return true;
    if (dateStr === todayDateStr) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMin;
      const [sHour, sMin] = (slot.start_time || "00:00").split(":").map((v) => parseInt(v, 10));
      const slotStartMinutes = (sHour || 0) * 60 + (sMin || 0);
      return slotStartMinutes <= currentTimeMinutes;
    }
    return false;
  };

  // Real database slots filtered for the selected reservation day of week
  const availableDaySlots: AmenitySlot[] = React.useMemo(() => {
    return rawDaySlots;
  }, [rawDaySlots]);

  useEffect(() => {
    if (availableDaySlots.length > 0) {
      setSelectedSlotId((prev) => {
        if (prev && availableDaySlots.some((s) => s.id === prev && !isSlotInPast(s, bookingDate))) {
          return prev;
        }
        const firstUpcoming = availableDaySlots.find((s) => !isSlotInPast(s, bookingDate));
        return firstUpcoming ? firstUpcoming.id : availableDaySlots[0].id;
      });
    } else {
      setSelectedSlotId("");
    }
  }, [bookingDate, selectedAmenity?.id, availableDaySlots]);

  const activeSelectedSlot =
    availableDaySlots.find((s) => s.id === selectedSlotId) || availableDaySlots[0];
  const slotTotalCapacity = activeSelectedSlot?.capacity || selectedAmenity?.capacity || 20;

  const isDateInPast = bookingDate < todayDateStr;
  const isSelectedSlotPast = isSlotInPast(activeSelectedSlot, bookingDate);

  const bookedParticipantCount = (amenities.bookings.data || [])
    .filter(
      (b) =>
        b.amenity_id === selectedAmenity?.id &&
        b.date === bookingDate &&
        b.status !== "cancelled" &&
        (b.slot_id
          ? b.slot_id === activeSelectedSlot?.id
          : b.start_time
            ? b.start_time === activeSelectedSlot?.start_time
            : true),
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

    if (bookingDate < todayDateStr) {
      toast.error(
        "Cannot book a completed or past date. Please select today or a future date.",
        "Invalid Date",
      );
      return;
    }

    if (!activeSelectedSlot) {
      toast.error("Please select an available time slot for this date.", "Slot Required");
      return;
    }

    if (isSlotInPast(activeSelectedSlot, bookingDate)) {
      toast.error(
        "Cannot book a completed or past time slot. Please choose an upcoming time slot.",
        "Time Slot Expired",
      );
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
      await amenities.bookings.refetch();
      await amenities.amenities.refetch();
      refetchStats?.();
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
      await amenities.bookings.refetch();
      await amenities.amenities.refetch();
      refetchStats?.();
      const amenityName = bookingToCancel.amenity_name;
      setBookingToCancel(null);
      toast.success(`Reservation for ${amenityName} has been cancelled.`, "Booking Cancelled");
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel booking.", "Cancellation Error");
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    const trimmedName = newMemberName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.name = "Please enter family member's full name (at least 2 characters).";
    } else if (!isValidPersonName(trimmedName)) {
      errors.name = "Family member name must contain only alphabetic letters and spaces.";
    }
    const cleanPhone = newMemberPhone.trim().replace(/[\s\-()]/g, "");
    if (!cleanPhone || !/^\+?[0-9]{7,15}$/.test(cleanPhone)) {
      errors.phone = "Please enter a valid mobile number (7-15 digits).";
    }
    if (Object.keys(errors).length > 0) {
      setAddMemberErrors(errors);
      const firstMsg = Object.values(errors)[0];
      toast.error(firstMsg, "Validation Error");
      return;
    }
    setAddMemberErrors({});
    try {
      await family.addMember.mutateAsync({
        name: trimmedName,
        relation: newMemberRelation,
        phone: cleanPhone,
        access_enabled: newMemberAccess,
      });
      await family.refetch();
      await profile.refetch();
      refetchStats?.();
      setAddMemberModalOpen(false);
      const addedName = trimmedName;
      setNewMemberName("");
      setNewMemberPhone("");
      setNewMemberRelation("Spouse");
      setNewMemberAccess(true);
      setAddMemberErrors({});
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
    const errors: Record<string, string> = {};
    const trimmedName = (editingMember.name || "").trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.name = "Please enter family member's full name (at least 2 characters).";
    } else if (!isValidPersonName(trimmedName)) {
      errors.name = "Family member name must contain only alphabetic letters and spaces.";
    }
    const cleanPhone = (editingMember.phone || "").trim().replace(/[\s\-()]/g, "");
    if (!cleanPhone || !/^\+?[0-9]{7,15}$/.test(cleanPhone)) {
      errors.phone = "Please enter a valid mobile number (7-15 digits).";
    }
    if (Object.keys(errors).length > 0) {
      setEditMemberErrors(errors);
      const firstMsg = Object.values(errors)[0];
      toast.error(firstMsg, "Validation Error");
      return;
    }
    setEditMemberErrors({});
    try {
      await family.updateMember.mutateAsync({
        id: editingMember.id,
        name: trimmedName,
        relation: editingMember.relation,
        phone: cleanPhone,
        access_enabled: editingMember.access_enabled,
      });
      await family.refetch();
      await profile.refetch();
      refetchStats?.();
      const updatedName = trimmedName;
      setEditingMember(null);
      setEditMemberErrors({});
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
    setProfileFieldErrors({});
    setEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    const trimmedFullName = profileFullName.trim();
    if (trimmedFullName && !isValidPersonName(trimmedFullName)) {
      errors.full_name = "Full name must contain only alphabetic letters and spaces.";
    }

    const trimmedEmergencyName = profileEmergencyName.trim();
    if (trimmedEmergencyName && !isValidPersonName(trimmedEmergencyName)) {
      errors.emergency_name =
        "Emergency contact name must contain only alphabetic letters and spaces.";
    }

    const cleanPhone = profilePhone.trim().replace(/[\s\-()]/g, "");
    if (cleanPhone && !/^\+?[0-9]{7,15}$/.test(cleanPhone)) {
      errors.phone = "Please enter a valid primary phone number (7-15 digits).";
    }

    const cleanEmergencyPhone = profileEmergencyPhone.trim().replace(/[\s\-()]/g, "");
    if (cleanEmergencyPhone && !/^\+?[0-9]{7,15}$/.test(cleanEmergencyPhone)) {
      errors.emergency_phone = "Please enter a valid emergency contact phone number (7-15 digits).";
    }

    if (Object.keys(errors).length > 0) {
      setProfileFieldErrors(errors);
      const firstMsg = Object.values(errors)[0];
      toast.error(firstMsg, "Validation Error");
      return;
    }

    setProfileFieldErrors({});
    try {
      await profile.updateProfile.mutateAsync({
        full_name: trimmedFullName || undefined,
        phone: cleanPhone || undefined,
        emergency_notes: profileEmergencyNotes.trim() || undefined,
        emergency_contact_name: trimmedEmergencyName || undefined,
        emergency_contact_phone: cleanEmergencyPhone || undefined,
        emergency_contact_relationship: profileEmergencyRel.trim() || undefined,
      });
      await profile.refetch();
      refetchStats?.();
      toast.success(
        "Your resident profile and emergency contact details have been updated.",
        "Profile Saved",
      );
      setEditProfileOpen(false);
    } catch (err: any) {
      toast.error(
        err?.message || "Failed to update resident profile. Please check the fields and try again.",
        "Update Failed",
      );
    }
  };

  const handleSimulatedPayment = async () => {
    if (!selectedInvoice) return;
    try {
      const invToPay = selectedInvoice;
      const res = await payments.payDues.mutateAsync({
        invoiceId: invToPay.id,
        amount: invToPay.balance_due,
        method: "simulated_gateway",
      });
      await payments.refetch();
      await ledger.refetch();
      refetchStats?.();
      const generatedRcp =
        res?.receipt_number ||
        invToPay.receipt_number ||
        (res?.id
          ? `RCP-${res.id.slice(0, 8).toUpperCase()}`
          : `RCP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      const generatedRef = res?.payment_reference || `PAY-${Date.now().toString(36).toUpperCase()}`;

      setCurrentReceiptNumber(generatedRcp);
      setActiveReceiptData({
        receipt_number: generatedRcp,
        payment_reference: generatedRef,
        invoice_number: invToPay.invoice_number,
        title: invToPay.title,
        amount_paid: invToPay.balance_due,
        total_amount: invToPay.total_amount,
        balance_due: 0,
        paid_at: new Date().toISOString(),
        payment_method: "Simulated Instant UPI / NetBanking Gateway",
        unit_number: residentUnit,
        payer_name: profile.data?.full_name || "Primary Resident",
        line_items: invToPay.line_items,
      });
      setSelectedInvoice((prev) =>
        prev
          ? {
              ...prev,
              status: "paid",
              balance_due: 0,
              amount_paid: prev.total_amount,
              receipt_number: generatedRcp,
            }
          : null,
      );
      setPaymentModalOpen(false);
      setReceiptModalOpen(true);
      toast.success(
        `Payment of ${formatCurrency(invToPay.balance_due)} processed successfully. Receipt #${generatedRcp} issued.`,
        "Payment Processed & Settled",
      );
    } catch (err: any) {
      toast.error(err?.message || "Payment processing failed. Please try again.", "Payment Error");
    }
  };

  const residentUnit = myOccupancy?.unit_number
    ? `${myOccupancy.unit_number.startsWith("Unit") ? myOccupancy.unit_number : `Unit ${myOccupancy.unit_number}`}${myOccupancy.tower_name ? `, ${myOccupancy.tower_name}` : ""}`
    : "Registered Unit";

  const handleDownloadInvoice = (inv: InvoiceItem | null) => {
    if (!inv) return;
    try {
      const lineItemsHtml =
        inv.line_items && inv.line_items.length > 0
          ? inv.line_items
              .map(
                (item) => `
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">
              <strong>${item.head}</strong>
              ${item.description && item.description !== item.head ? `<br/><span style="color: #64748b; font-size: 12px;">${item.description}</span>` : ""}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
              ${item.taxable ? "GST 18%" : "Exempt"}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.quantity ?? 1}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrency(item.unit_rate ?? item.amount)}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${formatCurrency(item.amount)}</td>
          </tr>
        `,
              )
              .join("")
          : `
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;"><strong>Monthly Society Maintenance Charge</strong></td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">Standard</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">1</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrency(inv.total_amount)}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${formatCurrency(inv.total_amount)}</td>
          </tr>
        `;

      const htmlConten... (334 KB left)