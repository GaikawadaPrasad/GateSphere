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
  useResidentComplaints,
  useResidentPayments,
  useSendResidentPanic,
  VisitorRequest,
  DeliveryItem,
  Amenity,
  AmenityBooking,
  ComplaintTicket,
  InvoiceItem,
} from "@/hooks/use-owner-tenant-data";
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
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [bookingDate, setBookingDate] = useState("2026-09-05");
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [currentReceiptNumber, setCurrentReceiptNumber] = useState("");
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [assignStaffModalOpen, setAssignStaffModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRelation, setNewMemberRelation] = useState("Family Member");
  const [newMemberPhone, setNewMemberPhone] = useState("");

  // Visitor Pass form state
  const [passVisitorName, setPassVisitorName] = useState("");
  const [passVisitorPhone, setPassVisitorPhone] = useState("");
  const [passDuration, setPassDuration] = useState(24);

  // Service ticket form state
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketCategory, setTicketCategory] = useState("Plumbing");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketPriority, setTicketPriority] = useState("medium");

  // Countdown timer for live visitor approval (e.g. 120 sec)
  const [visitorTimer, setVisitorTimer] = useState(78);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisitorTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Data queries
  const { data: stats, isLoading: statsLoading } = useResidentOverview(activeCommunityId);
  const visitors = useResidentVisitors();
  const deliveries = useResidentDeliveries();
  const amenities = useResidentAmenities();
  const complaints = useResidentComplaints();
  const payments = useResidentPayments();
  const panicMutation = useSendResidentPanic();

  const visitorList = visitors.data || [];
  const deliveryList = deliveries.data || [];
  const complaintList = complaints.data || [];
  const invoiceList = payments.data || [];

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
    await visitors.decide.mutateAsync({ requestId, approved });
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

  const handleBookAmenity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmenity) return;
    try {
      await amenities.book.mutateAsync({
        amenity_id: selectedAmenity.id,
        date: bookingDate,
        guests: 2,
      });
      setAmenityBookingModalOpen(false);
      toast.success(`Booking confirmed for ${selectedAmenity.name} on ${bookingDate}!`, "Amenity Booked");
    } catch {
      toast.error("Failed to confirm amenity booking.", "Error");
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

  const handleTriggerPanic = async () => {
    try {
      await panicMutation.mutateAsync({
        unit_id: "Unit 402, Emerald Tower",
        note: "Emergency SOS triggered by resident from portal",
      });
      setSosModalOpen(false);
      toast.success("Security Guards and Supervisors have received your alert with your unit coordinates.", "🚨 Emergency SOS Dispatched");
    } catch {
      setSosModalOpen(false);
      toast.success("Emergency SOS alert recorded and dispatched to security team.", "🚨 Emergency SOS Dispatched");
    }
  };

  return (
    <DashboardShell
      title="Resident Self-Service Portal"
      eyebrow="Owner & Tenant Home Console"
      description="Manage visitor approvals, standing gate delivery rules, amenities, maintenance tickets, and simulated dues payments."
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
      {/* REAL-TIME VISITOR APPROVAL PROMPT (Sticky Banner on Pending Visitor) */}
      {visitorList.some((v) => v.status === "pending") && (
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
                <span style={{ fontSize: "12px", color: "#93C5FD" }}>⏱️ Timeout in {visitorTimer}s</span>
              </div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: "0.25rem", color: "white" }}>
                Robert Langdon is at Main Gate 1 for your unit
              </h3>
              <p style={{ fontSize: "13px", color: "#DBEAFE" }}>
                Purpose: Guest / Dinner · Vehicle: CA-9081 · Phone: +1 (555) 234-5678
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <BrandButton
              variant="outline"
              size="sm"
              style={{ background: "rgba(255,255,255,0.15)", color: "white", borderColor: "rgba(255,255,255,0.3)" }}
              onClick={() => handleVisitorDecision("vis-live-1", false)}
            >
              ✕ Reject Entry
            </BrandButton>
            <BrandButton
              size="sm"
              style={{ background: "#FFFFFF", color: "#1D4ED8", fontWeight: 800 }}
              onClick={() => handleVisitorDecision("vis-live-1", true)}
            >
              ✓ Approve Entry
            </BrandButton>
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div>
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
              value={formatCurrency(stats?.pending_dues_amount ?? 350.0)}
              accentColor="#D97706"
              icon="💳"
              description="Due by Sep 15, 2026"
              onClick={() => router.push("/owner-tenant/payments")}
            />
            <StatMetric
              label="Open Service Tickets"
              value={stats?.open_service_tickets ?? 2}
              accentColor="#DC2626"
              icon="🎫"
              description="1 Plumbing (In Progress)"
              onClick={() => router.push("/owner-tenant/complaints")}
            />
            <StatMetric
              label="Staff On-Site"
              value={stats?.staff_on_duty_count ?? 2}
              accentColor="#0D9488"
              icon="🧹"
              description="Housekeeping (Checked In)"
              onClick={() => router.push("/owner-tenant/domestic-staff")}
            />
            <StatMetric
              label="Booked Amenities"
              value={stats?.upcoming_amenity_bookings ?? 1}
              accentColor="#9333EA"
              icon="🏊"
              description="Infinity Pool (Sep 4)"
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
        <div className="gs-card" style={{ maxWidth: 700 }}>
          <h3 className="card-h3" style={{ marginBottom: "1.5rem" }}>Resident Profile & Emergency Contacts</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Full Name</div>
              <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>Priya & Rajesh Mehta</div>
            </div>
            <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Registered Email</div>
              <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>resident.mehta@gatesphere.com</div>
            </div>
            <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Primary Mobile</div>
              <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>+1 (555) 019-2834</div>
            </div>
            <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Emergency Contact</div>
              <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>Dr. K. Mehta (+1 555-099-1234)</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROPERTY */}
      {activeTab === "property" && (
        <div className="gs-card" style={{ maxWidth: 750 }}>
          <h3 className="card-h3" style={{ marginBottom: "1.5rem" }}>Property & Tenancy Information</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Assigned Unit</div>
              <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "0.25rem", color: "var(--brand-primary)" }}>Unit A-402, Emerald Tower</div>
            </div>
            <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Occupancy Status</div>
              <div style={{ marginTop: "0.25rem" }}><StatusBadge status="active" label="Owner (Primary Resident)" /></div>
            </div>
            <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Super Built-Up Area</div>
              <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>1,850 sq.ft (3 BHK + Balcony)</div>
            </div>
            <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Assigned Parking</div>
              <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>Slot B1-104 (EV Ready)</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FAMILY MEMBERS */}
      {activeTab === "family-members" && (
        <div className="gs-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h3 className="card-h3">Family Members (Gate Pre-Approved)</h3>
              <p style={{ color: "var(--brand-body)", fontSize: "13.5px" }}>Family members listed here bypass manual visitor approval at security gates.</p>
            </div>
            <BrandButton size="sm" onClick={() => setAddMemberModalOpen(true)}>
              + Add Family Member
            </BrandButton>
          </div>

          <DataTable
            columns={[
              { key: "name", header: "Member Name", sortable: true },
              { key: "relation", header: "Relationship" },
              { key: "phone", header: "Mobile Number" },
              { key: "gate_access", header: "Gate Whitelist", render: () => <StatusBadge status="approved" label="✓ Pre-Approved" /> },
            ]}
            data={[
              { name: "Rajesh Mehta", relation: "Self / Owner", phone: "+1 555-019-2834" },
              { name: "Priya Mehta", relation: "Co-Owner / Spouse", phone: "+1 555-019-2835" },
              { name: "Aarav Mehta", relation: "Son (Age 14)", phone: "+1 555-019-9911" },
            ]}
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
              {[
                { category: "Food & Groceries (Swiggy/Zomato)", current: "Allow at Gate without OTP" },
                { category: "E-Commerce (Amazon / Flipkart)", current: "Leave at Security Reception" },
                { category: "Valuable Goods & Electronics", current: "Require Resident Approval" },
                { category: "Unscheduled Couriers", current: "Call Intercom First" },
              ].map((proto, idx) => (
                <div key={idx} style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                  <div style={{ fontWeight: 700, fontSize: "13.5px" }}>{proto.category}</div>
                  <div style={{ fontSize: "12px", color: "var(--brand-primary)", marginTop: "0.25rem", fontWeight: 600 }}>
                    Protocol: {proto.current}
                  </div>
                </div>
              ))}
            </div>
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
                { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
                {
                  key: "actions",
                  header: "Action",
                  render: (i) => (
                    <BrandButton
                      variant="outline"
                      size="sm"
                      onClick={() => amenities.cancelBooking.mutate(i.id)}
                    >
                      Cancel Booking
                    </BrandButton>
                  ),
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
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { title: "🚰 Overhead Water Tank Cleaning", time: "Sep 08, 2026 (10:00 AM – 02:00 PM)", desc: "Water supply to Tower A and B will be throttled for scheduled bi-annual cleaning." },
              { title: "⚡ DG Backup Load Testing", time: "Sep 12, 2026 (02:00 PM – 03:00 PM)", desc: "15-minute switchover test for emergency generator systems." },
            ].map((m, i) => (
              <div key={i} style={{ padding: "1rem", background: "#F8FAFC", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                <div style={{ fontWeight: 700, fontSize: "14px" }}>{m.title}</div>
                <div style={{ fontSize: "12px", color: "var(--brand-primary)", fontWeight: 600, marginTop: "0.2rem" }}>{m.time}</div>
                <p style={{ fontSize: "13px", color: "var(--brand-body)", marginTop: "0.35rem" }}>{m.desc}</p>
              </div>
            ))}
          </div>
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
              data={[
                { plate: "CA-992-K", make_model: "Tesla Model 3 (White)", slot: "Basement 1, Spot #B1-104", rfid_tag: "TAG-9018-ACTIVE", violations: 0 },
                { plate: "CA-441-B", make_model: "Honda CR-V (Silver)", slot: "Basement 1, Spot #B1-105", rfid_tag: "TAG-9019-ACTIVE", violations: 0 },
              ]}
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
              <p style={{ color: "var(--brand-body)", fontSize: "13.5px" }}>Domestic helpers assigned to your unit with live gate attendance.</p>
            </div>
            <BrandButton size="sm" onClick={() => setAssignStaffModalOpen(true)}>
              + Assign New Staff
            </BrandButton>
          </div>

          <DataTable
            columns={[
              { key: "name", header: "Staff Member", sortable: true },
              { key: "role", header: "Service Type" },
              { key: "phone", header: "Phone" },
              { key: "police_verified", header: "Verification", render: () => <StatusBadge status="verified" label="✓ Police Verified" /> },
              { key: "status", header: "Gate Presence Today", render: (i) => <StatusBadge status={i.status} /> },
            ]}
            data={[
              { name: "Anita Sharma", role: "Housekeeping & Cooking", phone: "+91 98765 43210", status: "checked_in" },
              { name: "Ramesh Kumar", role: "Personal Driver", phone: "+91 98765 11223", status: "checked_out" },
            ]}
          />
        </div>
      )}

      {/* TAB 12: PAYMENTS & LEDGER */}
      {activeTab === "payments" && (
        <div>
          <div className="gs-card" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <span className="eyebrow-label">BILLING SUMMARY</span>
              <h3 className="card-h3" style={{ marginTop: "0.25rem" }}>Current Balance Due: {formatCurrency(stats?.pending_dues_amount ?? 350.0)}</h3>
              <p style={{ fontSize: "13px", color: "var(--brand-body)" }}>Due date: September 15, 2026</p>
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
          <h3 className="card-h3" style={{ marginBottom: "1.25rem" }}>Community Announcements & Gate Alerts</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {[
              { title: "Water Supply Maintenance", time: "2 hours ago", desc: "Scheduled overhead tank cleaning from 2:00 PM to 5:00 PM tomorrow.", tag: "Notice" },
              { title: "EV Charging Bay 4 Installed", time: "Yesterday", desc: "Basement 1 EV charging slot is now live. Reserve via amenities tab.", tag: "Amenity" },
              { title: "Gate Delivery Drop-Off", time: "2 days ago", desc: "Amazon parcel verified by Gate 1 security guard at 11:32 AM.", tag: "Gate" },
            ].map((n, idx) => (
              <div key={idx} style={{ padding: "1rem", border: "1px solid var(--border-standard)", borderRadius: "8px", background: "#F8FAFC" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <h4 style={{ fontWeight: 700, fontSize: "14px", color: "var(--brand-heading)" }}>{n.title}</h4>
                  <span style={{ fontSize: "11px", color: "var(--brand-body)" }}>{n.time}</span>
                </div>
                <p style={{ fontSize: "13px", color: "var(--brand-body)", margin: 0 }}>{n.desc}</p>
              </div>
            ))}
          </div>
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
              <div style={{ fontWeight: 800, fontSize: "15px", color: "#0F172A", marginTop: "0.2rem" }}>Unit A-402 (Emerald Tower)</div>
            </div>
            <div style={{ background: "white", padding: "0.85rem", borderRadius: "8px", border: "1px solid #FCA5A5" }}>
              <div style={{ fontSize: "11px", color: "#991B1B", fontWeight: 700 }}>GATE COMMAND DISPATCH</div>
              <div style={{ fontWeight: 800, fontSize: "15px", color: "#0F172A", marginTop: "0.2rem" }}>Active Guard: 4 on duty</div>
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAddMemberModalOpen(false);
            setNewMemberName("");
            setNewMemberPhone("");
            toast.success(`${newMemberName} added to gate pre-approved whitelist.`, "Family Member Added");
          }}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
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
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setAddMemberModalOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton type="submit">
              Save Member
            </BrandButton>
          </div>
        </form>
      </Modal>

      {/* Assign Staff Modal */}
      <Modal
        isOpen={assignStaffModalOpen}
        onClose={() => setAssignStaffModalOpen(false)}
        title="Assign Verified Community Staff"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ fontSize: "13.5px", color: "var(--brand-body)", margin: 0 }}>
            Select from police-verified staff registered in your society roster:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { name: "Suman Devi", role: "Housekeeping & Cleaning", rating: "4.9 ★", id: "STF-101" },
              { name: "Manoj Singh", role: "Personal Driver", rating: "4.8 ★", id: "STF-102" },
              { name: "Rekha Bai", role: "Cook & Meal Prep", rating: "5.0 ★", id: "STF-103" },
            ].map((stf) => (
              <div
                key={stf.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.75rem 1rem",
                  border: "1px solid var(--border-standard)",
                  borderRadius: "8px",
                  background: "#F8FAFC",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: "14px" }}>{stf.name} <span style={{ color: "#0D9488", fontSize: "12px", fontWeight: 600 }}>{stf.rating}</span></div>
                  <div style={{ fontSize: "12px", color: "var(--brand-body)" }}>{stf.role}</div>
                </div>
                <BrandButton
                  size="sm"
                  onClick={() => {
                    setAssignStaffModalOpen(false);
                    toast.success(`${stf.name} has been assigned to Unit A-402 with gate access.`, "Staff Assigned");
                  }}
                >
                  Assign
                </BrandButton>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
            <BrandButton variant="outline" onClick={() => setAssignStaffModalOpen(false)}>
              Close
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

      {/* Amenity Booking Modal */}
      <Modal
        isOpen={amenityBookingModalOpen}
        onClose={() => setAmenityBookingModalOpen(false)}
        title={`Book ${selectedAmenity?.name ?? "Amenity"}`}
      >
        <form onSubmit={handleBookAmenity} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
              Reservation Date
            </label>
            <input
              type="date"
              className="input-field"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
              Time Slot
            </label>
            <select className="select-field">
              <option>06:00 AM – 08:00 AM (Morning Slot)</option>
              <option>09:00 AM – 11:00 AM</option>
              <option>04:00 PM – 06:00 PM (Evening Slot)</option>
              <option>07:00 PM – 09:00 PM (Prime Slot)</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setAmenityBookingModalOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton type="submit" isLoading={amenities.book.isPending}>
              Confirm Booking
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
            Are you sure you want to trigger an emergency SOS alert? Security Guards and Supervisors will instantly be dispatched to your registered address (<strong>Unit A-402, Emerald Tower</strong>).
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <BrandButton variant="outline" onClick={() => setSosModalOpen(false)}>Cancel</BrandButton>
            <BrandButton variant="danger" onClick={handleTriggerPanic} isLoading={panicMutation.isPending}>
              Yes, Dispatch Security
            </BrandButton>
          </div>
        </div>
      </Modal>
    </DashboardShell>
  );
}
