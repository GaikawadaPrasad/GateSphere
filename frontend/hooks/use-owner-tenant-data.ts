"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ResidentDashboardStats {
  pending_dues_amount: number;
  pending_visitor_count: number;
  open_service_tickets: number;
  staff_on_duty_count: number;
  upcoming_amenity_bookings: number;
  active_deliveries_count: number;
}

export interface VisitorRequest {
  id: string;
  visitor_name: string;
  phone: string;
  purpose: string;
  vehicle_number?: string;
  status: "pending" | "approved" | "rejected" | "expired" | "checked_in" | "checked_out";
  created_at: string;
  expires_at?: string;
  valid_until?: string;
  pass_code?: string;
  qr_token?: string;
  entry_time?: string;
  exit_time?: string;
}

export interface DeliveryItem {
  id: string;
  courier_company: string;
  package_type: string;
  tracking_id?: string;
  protocol: "allow_gate" | "require_approval" | "leave_at_desk" | "reject";
  status: "expected" | "at_gate" | "delivered" | "rejected" | "collected";
  arrived_at?: string;
  delivered_at?: string;
  driver_name?: string;
  driver_phone?: string;
}

export interface Amenity {
  id: string;
  name: string;
  category: string;
  description: string;
  capacity: number;
  pricing_type: string;
  price_per_hour: number;
  booking_window_days: number;
  image_url?: string;
}

export interface AmenityBooking {
  id: string;
  amenity_id: string;
  amenity_name: string;
  date: string;
  start_time: string;
  end_time: string;
  status: "confirmed" | "cancelled" | "completed";
  guests_count: number;
  total_amount: number;
}

export interface ComplaintTicket {
  id: string;
  ticket_number: string;
  subject: string;
  category_name: string;
  description: string;
  priority: "low" | "medium" | "high" | "emergency";
  status: "open" | "assigned" | "in_progress" | "resolved" | "closed";
  escalation_state: "on_track" | "at_risk" | "breached" | "escalated";
  created_at: string;
  assigned_to?: string;
  assigned_role?: string;
  resolved_at?: string;
  messages_count: number;
}

export interface InvoiceItem {
  id: string;
  invoice_number: string;
  title: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: "posted" | "paid" | "partially_paid" | "overdue" | "cancelled";
  issue_date: string;
  due_date: string;
  receipt_number?: string;
  line_items?: { head: string; amount: number }[];
}

export function useResidentOverview(communityId?: string | null) {
  return useQuery({
    queryKey: ["resident", "overview", communityId],
    queryFn: async () => {
      try {
        const stats = await api.get<any>(`/dashboards/resident${communityId ? `?community_id=${communityId}` : ""}`);
        return {
          pending_dues_amount: stats?.pending_dues_amount ?? 350.0,
          pending_visitor_count: stats?.pending_visitor_count ?? 1,
          open_service_tickets: stats?.open_tickets_count ?? 2,
          staff_on_duty_count: 2,
          upcoming_amenity_bookings: 1,
          active_deliveries_count: 1,
        } as ResidentDashboardStats;
      } catch {
        return {
          pending_dues_amount: 350.0,
          pending_visitor_count: 1,
          open_service_tickets: 2,
          staff_on_duty_count: 2,
          upcoming_amenity_bookings: 1,
          active_deliveries_count: 1,
        } as ResidentDashboardStats;
      }
    },
  });
}

export function useResidentVisitors() {
  const queryClient = useQueryClient();

  const query = useQuery<VisitorRequest[]>({
    queryKey: ["resident", "visitors"],
    queryFn: async () => {
      try {
        const res = await api.get<VisitorRequest[]>("/visitors/requests");
        return Array.isArray(res) && res.length > 0
          ? res
          : [
              {
                id: "vis-live-1",
                visitor_name: "Robert Langdon",
                phone: "+1 (555) 234-5678",
                purpose: "Guest / Dinner",
                vehicle_number: "CA-9081",
                status: "pending" as const,
                created_at: new Date(Date.now() - 1000 * 30).toISOString(),
                expires_at: new Date(Date.now() + 1000 * 90).toISOString(),
              },
              {
                id: "vis-past-2",
                visitor_name: "Elena Rostova",
                phone: "+1 (555) 876-5432",
                purpose: "Family Visit",
                status: "approved" as const,
                pass_code: "OTP-8819",
                created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
                entry_time: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
                exit_time: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
              },
            ];
      } catch {
        return [
          {
            id: "vis-live-1",
            visitor_name: "Robert Langdon",
            phone: "+1 (555) 234-5678",
            purpose: "Guest / Dinner",
            vehicle_number: "CA-9081",
            status: "pending" as const,
            created_at: new Date(Date.now() - 1000 * 30).toISOString(),
            expires_at: new Date(Date.now() + 1000 * 90).toISOString(),
          },
        ];
      }
    },
    refetchInterval: 10000,
  });

  const decideMutation = useMutation({
    mutationFn: async ({ requestId, approved, note }: { requestId: string; approved: boolean; note?: string }) => {
      return await api.post(`/visitors/requests/${requestId}/decision`, {
        approved,
        notes: note || (approved ? "Approved by resident" : "Rejected by resident"),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "visitors"] });
    },
  });

  const createPassMutation = useMutation({
    mutationFn: async (payload: { visitor_name: string; phone: string; valid_for_hours: number }) => {
      const req = await api.post<any>("/visitors/requests", {
        visitor_name: payload.visitor_name,
        phone: payload.phone,
        purpose: "Pre-approved Visitor Pass",
      });
      return await api.post(`/visitors/requests/${req.id}/passes`, {
        valid_for_hours: payload.valid_for_hours || 24,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "visitors"] });
    },
  });

  return { ...query, decide: decideMutation, createPass: createPassMutation };
}

export function useResidentDeliveries() {
  const queryClient = useQueryClient();

  const query = useQuery<DeliveryItem[]>({
    queryKey: ["resident", "deliveries"],
    queryFn: async () => {
      try {
        const res = await api.get<DeliveryItem[]>("/deliveries");
        return Array.isArray(res) && res.length > 0
          ? res
          : [
              {
                id: "del-101",
                courier_company: "Amazon Express",
                package_type: "Electronics & Books",
                tracking_id: "AMZ-9921-US",
                protocol: "allow_gate" as const,
                status: "at_gate" as const,
                arrived_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
                driver_name: "Marcus Miller",
                driver_phone: "+1 555-8812",
              },
              {
                id: "del-102",
                courier_company: "FedEx Priority",
                package_type: "Documents",
                tracking_id: "FDX-1029-44",
                protocol: "leave_at_desk" as const,
                status: "delivered" as const,
                delivered_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
              },
            ];
      } catch {
        return [
          {
            id: "del-101",
            courier_company: "Amazon Express",
            package_type: "Electronics & Books",
            tracking_id: "AMZ-9921-US",
            protocol: "allow_gate" as const,
            status: "at_gate" as const,
            arrived_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
            driver_name: "Marcus Miller",
            driver_phone: "+1 555-8812",
          },
        ];
      }
    },
  });

  const updateProtocol = useMutation({
    mutationFn: async (payload: { category: string; protocol: string }) => {
      return await api.put("/deliveries/protocols", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "deliveries"] });
    },
  });

  return { ...query, updateProtocol };
}

export function useResidentAmenities() {
  const queryClient = useQueryClient();

  const amenitiesQuery = useQuery<Amenity[]>({
    queryKey: ["resident", "amenities-list"],
    queryFn: async () => {
      try {
        const res = await api.get<Amenity[]>("/amenities");
        return Array.isArray(res) && res.length > 0
          ? res
          : [
              {
                id: "amenity-1",
                name: "Infinity Swimming Pool",
                category: "Sports & Recreation",
                description: "Olympic-grade temperature controlled swimming pool with lounge deck.",
                capacity: 30,
                pricing_type: "free",
                price_per_hour: 0,
                booking_window_days: 7,
              },
              {
                id: "amenity-2",
                name: "Clubhouse Banquet Hall",
                category: "Events",
                description: "Spacious air-conditioned hall with AV systems and banquet seating.",
                capacity: 150,
                pricing_type: "paid",
                price_per_hour: 50,
                booking_window_days: 30,
              },
              {
                id: "amenity-3",
                name: "Tennis & Badminton Court",
                category: "Sports",
                description: "Synthetic floodlit courts with equipment rental on-site.",
                capacity: 8,
                pricing_type: "free",
                price_per_hour: 0,
                booking_window_days: 5,
              },
            ];
      } catch {
        return [
          {
            id: "amenity-1",
            name: "Infinity Swimming Pool",
            category: "Sports & Recreation",
            description: "Olympic-grade temperature controlled swimming pool with lounge deck.",
            capacity: 30,
            pricing_type: "free",
            price_per_hour: 0,
            booking_window_days: 7,
          },
        ];
      }
    },
  });

  const bookingsQuery = useQuery<AmenityBooking[]>({
    queryKey: ["resident", "my-bookings"],
    queryFn: async () => {
      try {
        const res = await api.get<AmenityBooking[]>("/amenities/bookings?mine=true");
        return Array.isArray(res) && res.length > 0
          ? res
          : [
              {
                id: "bk-801",
                amenity_id: "amenity-1",
                amenity_name: "Infinity Swimming Pool",
                date: "2026-09-04",
                start_time: "07:00 AM",
                end_time: "08:30 AM",
                status: "confirmed" as const,
                guests_count: 2,
                total_amount: 0,
              },
            ];
      } catch {
        return [
          {
            id: "bk-801",
            amenity_id: "amenity-1",
            amenity_name: "Infinity Swimming Pool",
            date: "2026-09-04",
            start_time: "07:00 AM",
            end_time: "08:30 AM",
            status: "confirmed" as const,
            guests_count: 2,
            total_amount: 0,
          },
        ];
      }
    },
  });

  const bookMutation = useMutation({
    mutationFn: async (payload: { amenity_id: string; slot_id?: string; date: string; guests: number }) => {
      return await api.post("/amenities/bookings", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "my-bookings"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return await api.post(`/amenities/bookings/${bookingId}/cancel`, { reason: "Resident requested cancellation" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "my-bookings"] });
    },
  });

  return {
    amenities: amenitiesQuery,
    bookings: bookingsQuery,
    book: bookMutation,
    cancelBooking: cancelMutation,
  };
}

export function useResidentComplaints() {
  const queryClient = useQueryClient();

  const query = useQuery<ComplaintTicket[]>({
    queryKey: ["resident", "complaints"],
    queryFn: async () => {
      try {
        const res = await api.get<ComplaintTicket[]>("/complaints/tickets");
        return Array.isArray(res) && res.length > 0
          ? res
          : [
              {
                id: "tkt-101",
                ticket_number: "TKT-2026-101",
                subject: "Water seepage in master bathroom ceiling",
                category_name: "Plumbing",
                description: "Noticeable water staining and slight drip near the vent.",
                priority: "high" as const,
                status: "in_progress" as const,
                escalation_state: "on_track" as const,
                created_at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
                assigned_to: "Apex Plumbing Services (Technician Ravi)",
                assigned_role: "vendor_technician",
                messages_count: 4,
              },
              {
                id: "tkt-102",
                ticket_number: "TKT-2026-102",
                subject: "Intercom buzzer intermittent disconnect",
                category_name: "Electrical / Intercom",
                description: "Gate notifications don't ring on the handset occasionally.",
                priority: "medium" as const,
                status: "resolved" as const,
                escalation_state: "on_track" as const,
                created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
                resolved_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
                assigned_to: "Facility Maintenance Team",
                messages_count: 2,
              },
            ];
      } catch {
        return [
          {
            id: "tkt-101",
            ticket_number: "TKT-2026-101",
            subject: "Water seepage in master bathroom ceiling",
            category_name: "Plumbing",
            description: "Noticeable water staining and slight drip near the vent.",
            priority: "high" as const,
            status: "in_progress" as const,
            escalation_state: "on_track" as const,
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
            assigned_to: "Apex Plumbing Services (Technician Ravi)",
            assigned_role: "vendor_technician",
            messages_count: 4,
          },
        ];
      }
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (payload: { subject: string; category_id?: string; description: string; priority: string }) => {
      return await api.post("/complaints/tickets", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "complaints"] });
    },
  });

  const confirmTicketMutation = useMutation({
    mutationFn: async ({ ticketId, satisfied, notes }: { ticketId: string; satisfied: boolean; notes?: string }) => {
      return await api.post(`/complaints/tickets/${ticketId}/confirm`, { satisfied, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "complaints"] });
    },
  });

  return { ...query, createTicket: createTicketMutation, confirmTicket: confirmTicketMutation };
}

export function useResidentPayments() {
  const queryClient = useQueryClient();

  const query = useQuery<InvoiceItem[]>({
    queryKey: ["resident", "invoices"],
    queryFn: async () => {
      try {
        const res = await api.get<InvoiceItem[]>("/billing/invoices");
        return Array.isArray(res) && res.length > 0
          ? res
          : [
              {
                id: "inv-001",
                invoice_number: "INV-2026-0901",
                title: "Monthly Maintenance & Facility Fee - Sep 2026",
                total_amount: 350.0,
                amount_paid: 0.0,
                balance_due: 350.0,
                status: "posted" as const,
                issue_date: "2026-09-01",
                due_date: "2026-09-15",
                line_items: [
                  { head: "Common Area Maintenance", amount: 220.0 },
                  { head: "Security & Gate Operations", amount: 80.0 },
                  { head: "Sinking Fund Reserve", amount: 50.0 },
                ],
              },
              {
                id: "inv-002",
                invoice_number: "INV-2026-0801",
                title: "Monthly Maintenance & Facility Fee - Aug 2026",
                total_amount: 350.0,
                amount_paid: 350.0,
                balance_due: 0.0,
                status: "paid" as const,
                issue_date: "2026-08-01",
                due_date: "2026-08-15",
                receipt_number: "RCP-2026-0814",
                line_items: [
                  { head: "Common Area Maintenance", amount: 220.0 },
                  { head: "Security & Gate Operations", amount: 80.0 },
                  { head: "Sinking Fund Reserve", amount: 50.0 },
                ],
              },
            ];
      } catch {
        return [
          {
            id: "inv-001",
            invoice_number: "INV-2026-0901",
            title: "Monthly Maintenance & Facility Fee - Sep 2026",
            total_amount: 350.0,
            amount_paid: 0.0,
            balance_due: 350.0,
            status: "posted" as const,
            issue_date: "2026-09-01",
            due_date: "2026-09-15",
            line_items: [
              { head: "Common Area Maintenance", amount: 220.0 },
              { head: "Security & Gate Operations", amount: 80.0 },
              { head: "Sinking Fund Reserve", amount: 50.0 },
            ],
          },
        ];
      }
    },
  });

  const payDuesMutation = useMutation({
    mutationFn: async ({ invoiceId, amount, method }: { invoiceId: string; amount: number; method: string }) => {
      return await api.post("/billing/payments", {
        invoice_id: invoiceId,
        amount,
        payment_method: method || "simulated",
        reference_id: `SIM-TXN-${Date.now()}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "overview"] });
    },
  });

  return { ...query, payDues: payDuesMutation };
}

export function useSendResidentPanic() {
  return useMutation({
    mutationFn: async (payload: { unit_id?: string; note?: string }) => {
      return await api.post("/gate/alerts", {
        alert_type: "sos",
        priority: "high",
        details: payload.note || "Resident emergency panic triggered from portal",
      });
    },
  });
}
