"use client";

import React, { useState, useEffect } from "react";
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

interface OwnerTenantDashboardViewProps {
  initialTab?: OwnerTenantTab;
}

export function OwnerTenantDashboardView({ initialTab = "overview" }: OwnerTenantDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<OwnerTenantTab>(initialTab);
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
    await visitors.createPass.mutateAsync({
      visitor_name: passVisitorName,
      phone: passVisitorPhone,
      valid_for_hours: passDuration,
    });
    setVisitorPassModalOpen(false);
    setPassVisitorName("");
    setPassVisitorPhone("");
    alert("Visitor Pass generated! A QR & 4-digit PIN code have been issued for your guest.");
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    await complaints.createTicket.mutateAsync({
      subject: ticketSubject,
      description: ticketDescription,
      priority: ticketPriority,
    });
    setTicketModalOpen(false);
    setTicketSubject("");
    setTicketDescription("");
    alert("Service ticket raised successfully! Facility manager and technician have been notified.");
  };

  const handleBookAmenity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmenity) return;
    await amenities.book.mutateAsync({
      amenity_id: selectedAmenity.id,
      date: bookingDate,
      guests: 2,
    });
    setAmenityBookingModalOpen(false);
    alert(`Booking confirmed for ${selectedAmenity.name} on ${bookingDate}!`);
  };

  const handleSimulatedPayment = async () => {
    if (!selectedInvoice) return;
    await payments.payDues.mutateAsync({
      invoiceId: selectedInvoice.id,
      amount: selectedInvoice.balance_due,
      method: "simulated_gateway",
    });
    const generatedRcp = `RCP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setCurrentReceiptNumber(generatedRcp);
    setPaymentModalOpen(false);
    setReceiptModalOpen(true);
  };

  const handleTriggerPanic = async () => {
    await panicMutation.mutateAsync({
      unit_id: "Unit 402, Emerald Tower",
      note: "Emergency SOS triggered by resident from portal",
    });
    setSosModalOpen(false);
    alert("🚨 Emergency SOS dispatched! Security Guard and Supervisor have received your alert with your unit coordinates.");
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
      {/* 14 Module Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "0.75rem",
          marginBottom: "1.5rem",
          borderBottom: "1px solid var(--border-standard)",
        }}
      >
        {[
          { id: "overview", label: "📊 Overview" },
          { id: "profile", label: "👤 Profile" },
          { id: "property", label: "🏢 Property" },
          { id: "family-members", label: "👨‍👩‍👧 Family" },
          { id: "visitors", label: "🚪 Visitors" },
          { id: "deliveries", label: "📦 Deliveries" },
          { id: "amenities", label: "🏊 Amenities" },
          { id: "maintenance", label: "🔨 Maintenance" },
          { id: "complaints", label: "🎫 Service Tickets" },
          { id: "vehicles", label: "🚗 Vehicles & Parking" },
          { id: "domestic-staff", label: "🧹 Domestic Staff" },
          { id: "payments", label: "💳 Dues & Payments" },
          { id: "notifications", label: "🔔 Notifications" },
          { id: "emergency", label: "🆘 Emergency" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as OwnerTenantTab)}
            style={{
              padding: "0.55rem 1rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid",
              borderColor: activeTab === tab.id ? "var(--brand-primary)" : "transparent",
              background: activeTab === tab.id ? "#EFF6FF" : "transparent",
              color: activeTab === tab.id ? "var(--brand-primary)" : "var(--brand-body)",
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: "13.5px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
              onClick={() => setActiveTab("payments")}
            />
            <StatMetric
              label="Open Service Tickets"
              value={stats?.open_service_tickets ?? 2}
              accentColor="#DC2626"
              icon="🎫"
              description="1 Plumbing (In Progress)"
              onClick={() => setActiveTab("complaints")}
            />
            <StatMetric
              label="Staff On-Site"
              value={stats?.staff_on_duty_count ?? 2}
              accentColor="#0D9488"
              icon="🧹"
              description="Housekeeping (Checked In)"
              onClick={() => setActiveTab("domestic-staff")}
            />
            <StatMetric
              label="Booked Amenities"
              value={stats?.upcoming_amenity_bookings ?? 1}
              accentColor="#9333EA"
              icon="🏊"
              description="Infinity Pool (Sep 4)"
              onClick={() => setActiveTab("amenities")}
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
                <BrandButton variant="outline" size="sm" onClick={() => setActiveTab("deliveries")}>
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
                <BrandButton variant="outline" size="sm" onClick={() => setActiveTab("deliveries")}>View All</BrandButton>
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
            <BrandButton size="sm" onClick={() => alert("Add Family Member: Name, Relation, Phone number, and Photo for gate facial recognition.")}>
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
            <BrandButton size="sm" onClick={() => alert("Browse verified staff roster to assign a cook, driver, or housekeeper.")}>
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
            <BrandButton
              size="md"
              onClick={() => {
                setSelectedInvoice(invoiceList[0]);
                setPaymentModalOpen(true);
              }}
            >
              💳 Pay Maintenance Dues Now
            </BrandButton>
          </div>

          <DataTable<InvoiceItem>
            columns={[
              { key: "invoice_number", header: "Invoice #", sortable: true },
              { key: "title", header: "Description" },
              { key: "total_amount", header: "Total Amount", render: (i) => formatCurrency(i.total_amount) },
              { key: "balance_due", header: "Balance Due", render: (i) => formatCurrency(i.balance_due) },
              { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
              {
                key: "receipt",
                header: "Receipt",
                render: (i) =>
                  i.receipt_number ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentReceiptNumber(i.receipt_number!);
                        setReceiptModalOpen(true);
                      }}
                      style={{ background: "none", border: "none", color: "var(--brand-primary)", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
                    >
                      {i.receipt_number} 🧾
                    </button>
                  ) : (
                    "–"
                  ),
              },
            ]}
            data={invoiceControls.paginatedData}
            isLoading={payments.isLoading}
            page={invoiceControls.page}
            pageSize={invoiceControls.pageSize}
            total={invoiceControls.total}
            onPageChange={invoiceControls.setPage}
          />
        </div>
      )}

      {/* TAB 13: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "1rem" }}>Community Broadcasts & Alerts</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { title: "💳 Maintenance Invoice Generated", desc: "Your September 2026 invoice for $350.00 has been generated.", time: "1 day ago" },
              { title: "🏊 Amenity Booking Confirmed", desc: "Infinity Pool reservation for Sep 4 (07:00 AM) confirmed.", time: "2 days ago" },
              { title: "🔧 Ticket TKT-2026-102 Resolved", desc: "Intercom issue resolved by facility technician.", time: "3 days ago" },
            ].map((notif, idx) => (
              <div key={idx} style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: "14px" }}>{notif.title}</strong>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{notif.time}</span>
                </div>
                <p style={{ fontSize: "13px", color: "var(--brand-body)", marginTop: "0.25rem" }}>{notif.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 14: EMERGENCY SOS */}
      {activeTab === "emergency" && (
        <div className="gs-card" style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", border: "2px solid #DC2626" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "0.5rem" }}>🆘</div>
          <h3 className="card-h3" style={{ color: "#DC2626", marginBottom: "0.5rem" }}>Resident Emergency SOS</h3>
          <p style={{ color: "var(--brand-body)", fontSize: "14px", marginBottom: "1.5rem" }}>
            Clicking below transmits an instant emergency alarm to the Gate Security Station and logs a high-severity security incident with your unit coordinates (<strong>Unit A-402, Emerald Tower</strong>).
          </p>
          <BrandButton
            variant="danger"
            size="lg"
            onClick={() => setSosModalOpen(true)}
            style={{ width: "100%", padding: "1rem", fontSize: "1.1rem" }}
          >
            🚨 TRIGGER EMERGENCY SOS NOW
          </BrandButton>
        </div>
      )}

      {/* Guest Pass Modal */}
      <Modal
        isOpen={visitorPassModalOpen}
        onClose={() => setVisitorPassModalOpen(false)}
        title="Generate Pre-Approved Guest Pass"
      >
        <form onSubmit={handleCreatePass} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>Visitor Full Name</label>
            <input className="input-field" value={passVisitorName} onChange={(e) => setPassVisitorName(e.target.value)} placeholder="e.g. John Smith" required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>Visitor Mobile Phone</label>
            <input className="input-field" value={passVisitorPhone} onChange={(e) => setPassVisitorPhone(e.target.value)} placeholder="+1 (555) 000-0000" required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>Pass Validity Duration</label>
            <select className="select-field" value={passDuration} onChange={(e) => setPassDuration(Number(e.target.value))}>
              <option value={6}>6 Hours</option>
              <option value={12}>12 Hours</option>
              <option value={24}>24 Hours (1 Day)</option>
              <option value={72}>3 Days</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setVisitorPassModalOpen(false)}>Cancel</BrandButton>
            <BrandButton type="submit">Issue QR Pass</BrandButton>
          </div>
        </form>
      </Modal>

      {/* Amenity Booking Modal */}
      <Modal
        isOpen={amenityBookingModalOpen}
        onClose={() => setAmenityBookingModalOpen(false)}
        title={`Book ${selectedAmenity?.name || "Amenity"}`}
      >
        <form onSubmit={handleBookAmenity} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ fontSize: "13.5px", color: "var(--brand-body)" }}>{selectedAmenity?.description}</p>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>Reservation Date</label>
            <input type="date" className="input-field" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>Preferred Time Slot</label>
            <select className="select-field">
              <option value="07:00-08:30">07:00 AM – 08:30 AM</option>
              <option value="09:00-10:30">09:00 AM – 10:30 AM</option>
              <option value="17:00-18:30">05:00 PM – 06:30 PM</option>
              <option value="19:00-20:30">07:00 PM – 08:30 PM</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setAmenityBookingModalOpen(false)}>Cancel</BrandButton>
            <BrandButton type="submit">Confirm Reservation</BrandButton>
          </div>
        </form>
      </Modal>

      {/* Raise Ticket Modal */}
      <Modal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Raise Maintenance / Service Request"
      >
        <form onSubmit={handleCreateTicket} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>Category</label>
            <select className="select-field" value={ticketCategory} onChange={(e) => setTicketCategory(e.target.value)}>
              <option value="Plumbing">Plumbing</option>
              <option value="Electrical">Electrical / Intercom</option>
              <option value="Carpentry">Carpentry & Hardware</option>
              <option value="HVAC">Air Conditioning</option>
              <option value="Pest Control">Pest Control</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>Subject / Brief Summary</label>
            <input className="input-field" value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} placeholder="e.g. Kitchen tap leaking" required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>Detailed Description</label>
            <textarea className="input-field" rows={3} value={ticketDescription} onChange={(e) => setTicketDescription(e.target.value)} placeholder="Provide any details, location within apartment..." required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>Priority</label>
            <select className="select-field" value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)}>
              <option value="low">Low (Routine Upkeep)</option>
              <option value="medium">Medium (Standard 24h SLA)</option>
              <option value="high">High (Urgent Attention)</option>
              <option value="emergency">Emergency (Immediate)</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setTicketModalOpen(false)}>Cancel</BrandButton>
            <BrandButton type="submit">Submit Ticket</BrandButton>
          </div>
        </form>
      </Modal>

      {/* Simulated Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Simulated Maintenance Payment Checkout"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ padding: "1rem", background: "#F8FAFC", borderRadius: "8px" }}>
            <div style={{ fontSize: "12px", color: "var(--brand-body)", textTransform: "uppercase" }}>Invoice Reference</div>
            <div style={{ fontWeight: 700, fontSize: "15px" }}>{selectedInvoice?.invoice_number}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--brand-primary)", marginTop: "0.5rem" }}>
              {formatCurrency(selectedInvoice?.balance_due)}
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

      {/* Official Receipt Modal */}
      <Modal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        title="Official Payment Receipt"
        size="md"
      >
        <div style={{ padding: "1.5rem", border: "1px solid var(--border-standard)", borderRadius: "8px", background: "#FFFFFF" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0F172A", paddingBottom: "1rem", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--brand-heading)" }}>GATESPHERE RESIDENTIAL</h2>
              <p style={{ fontSize: "12px", color: "var(--brand-body)" }}>Maintenance Billing & Finance Ledger</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className="live-badge" style={{ background: "#ECFDF5", color: "#065F46" }}>✓ PAID IN FULL</span>
              <div style={{ fontWeight: 800, fontSize: "14px", marginTop: "0.35rem" }}>{currentReceiptNumber}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", fontSize: "13px", marginBottom: "1rem" }}>
            <div><strong>Billed To:</strong> Priya & Rajesh Mehta</div>
            <div><strong>Date Paid:</strong> {formatDate(new Date().toISOString())}</div>
            <div><strong>Unit:</strong> Unit A-402 (Emerald Tower)</div>
            <div><strong>Payment Method:</strong> Simulated Gateway (Authorized)</div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "1rem" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--border-standard)" }}>
                <th style={{ padding: "0.5rem", textAlign: "left" }}>Charge Item</th>
                <th style={{ padding: "0.5rem", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "0.5rem" }}>Common Area Maintenance & Power</td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>$220.00</td>
              </tr>
              <tr>
                <td style={{ padding: "0.5rem" }}>Security & Gate Operations</td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>$80.00</td>
              </tr>
              <tr>
                <td style={{ padding: "0.5rem" }}>Sinking Fund Reserve</td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>$50.00</td>
              </tr>
              <tr style={{ fontWeight: 800, borderTop: "1px solid var(--border-standard)" }}>
                <td style={{ padding: "0.5rem" }}>Total Paid</td>
                <td style={{ padding: "0.5rem", textAlign: "right", color: "var(--brand-primary)" }}>$350.00</td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <BrandButton size="sm" onClick={() => window.print()}>
              🖨️ Print / Save PDF
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
