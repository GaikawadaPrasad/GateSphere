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
      const stats = await api.get<any>(`/dashboards/resident${communityId ? `?community_id=${communityId}` : ""}`);
      return {
        pending_dues_amount: Number(stats?.pending_dues_amount ?? 0),
        pending_visitor_count: Number(stats?.pending_visitor_count ?? 0),
        open_service_tickets: Number(stats?.open_tickets_count ?? 0),
        staff_on_duty_count: Number(stats?.staff_on_duty_count ?? 0),
        upcoming_amenity_bookings: Number(stats?.upcoming_amenity_bookings ?? 0),
        active_deliveries_count: Number(stats?.active_deliveries_count ?? 0),
      } as ResidentDashboardStats;
    },
  });
}

export function useResidentVisitors() {
  const queryClient = useQueryClient();

  const query = useQuery<VisitorRequest[]>({
    queryKey: ["resident", "visitors"],
    queryFn: async () => {
      const res = await api.get<any[]>("/visitors/requests");
      if (!Array.isArray(res)) return [];
      return res.map((r: any) => ({
        id: r.id,
        visitor_name: r.visitor?.full_name || r.visitor_name || "Visitor",
        phone: r.visitor?.phone || r.phone || "",
        purpose: r.purpose || "Guest visit",
        vehicle_number: r.vehicle_number,
        status: r.status,
        created_at: r.created_at,
        valid_until: r.valid_until,
        pass_code: r.passes?.[0]?.pin || (r.passes?.[0]?.token ? `QR-${r.passes[0].token.slice(0, 6)}` : undefined),
        qr_token: r.passes?.[0]?.token,
        entry_time: r.entries?.[0]?.entry_at,
        exit_time: r.entries?.[0]?.exit_at,
      }));
    },
    refetchInterval: 10000,
  });

  const decideMutation = useMutation({
    mutationFn: async ({ requestId, approved, note }: { requestId: string; approved: boolean; note?: string }) => {
      return await api.post(`/visitors/requests/${requestId}/decision`, {
        decision: approved ? "approved" : "rejected",
        remarks: note || (approved ? "Approved by resident" : "Rejected by resident"),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "visitors"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "overview"] });
    },
  });

  const createPassMutation = useMutation({
    mutationFn: async (payload: { visitor_name: string; phone: string; valid_for_hours: number }) => {
      const profile = await api.get<any>("/residents/me");
      const unitId = profile?.occupancies?.[0]?.unit_id;
      if (!unitId) {
        throw new Error("No active unit occupancy found for resident profile");
      }
      const req = await api.post<any>("/visitors/requests", {
        unit_id: unitId,
        visitor_type: "guest",
        visitor: {
          full_name: payload.visitor_name,
          phone: payload.phone,
        },
        purpose: "Pre-approved Visitor Pass",
      });
      return await api.post(`/visitors/requests/${req.id}/passes`, {
        pass_type: "qr",
        max_entries: 1,
        with_pin: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "visitors"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "overview"] });
    },
  });

  return { ...query, decide: decideMutation, createPass: createPassMutation };
}

export function useResidentDeliveries() {
  const queryClient = useQueryClient();

  const query = useQuery<DeliveryItem[]>({
    queryKey: ["resident", "deliveries"],
    queryFn: async () => {
      const res = await api.get<any[]>("/deliveries");
      if (!Array.isArray(res)) return [];
      return res.map((d: any) => ({
        id: d.id,
        courier_company: d.provider_name || (d.delivery_type ? d.delivery_type.toUpperCase() : "Courier"),
        package_type: d.delivery_type ? `${d.delivery_type.toUpperCase()} Package` : "General Package",
        tracking_id: d.tracking_reference || d.id.slice(0, 8),
        protocol: d.protocol_id || "allow_gate",
        status: d.status || "expected",
        arrived_at: d.arrived_at,
        delivered_at: d.delivered_at,
        driver_name: d.executive_name,
        driver_phone: d.executive_phone,
      }));
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
      const res = await api.get<any[]>("/amenities");
      if (!Array.isArray(res)) return [];
      return res.map((a: any) => ({
        id: a.id,
        name: a.name,
        category: a.amenity_type ? a.amenity_type.toUpperCase() : "Facility",
        description: a.description || `Community ${a.name} access. Capacity: ${a.capacity || 20} persons.`,
        capacity: a.capacity || 20,
        pricing_type: a.pricing_type || "free",
        price_per_hour: Number(a.price_per_hour ?? 0),
        booking_window_days: a.booking_window_days || 14,
      }));
    },
  });

  const bookingsQuery = useQuery<AmenityBooking[]>({
    queryKey: ["resident", "my-bookings"],
    queryFn: async () => {
      const res = await api.get<any[]>("/amenities/bookings");
      if (!Array.isArray(res)) return [];
      return res.map((b: any) => ({
        id: b.id,
        amenity_id: b.amenity_id,
        amenity_name: b.amenity?.name || "Community Amenity",
        date: b.booking_date || (b.start_at ? b.start_at.split("T")[0] : ""),
        start_time: b.start_at ? new Date(b.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        end_time: b.end_at ? new Date(b.end_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        status: b.status || "confirmed",
        guests_count: b.participant_count || 1,
        total_amount: Number(b.amount_charged ?? 0),
      }));
    },
  });

  const bookMutation = useMutation({
    mutationFn: async (payload: { amenity_id: string; slot_id?: string; date: string; guests: number }) => {
      const profile = await api.get<any>("/residents/me");
      const unitId = profile?.occupancies?.[0]?.unit_id;
      if (!unitId) {
        throw new Error("No active unit occupancy found for resident");
      }
      const bookingDate = payload.date;
      const startAt = `${bookingDate}T09:00:00Z`;
      const endAt = `${bookingDate}T10:00:00Z`;
      return await api.post("/amenities/bookings", {
        amenity_id: payload.amenity_id,
        unit_id: unitId,
        booking_date: bookingDate,
        start_at: startAt,
        end_at: endAt,
        participant_count: payload.guests || 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "overview"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return await api.post(`/amenities/bookings/${bookingId}/cancel`, { reason: "Resident requested cancellation" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "overview"] });
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
      const res = await api.get<any[]>("/complaints/tickets");
      if (!Array.isArray(res)) return [];
      return res.map((t: any) => ({
        id: t.id,
        ticket_number: t.ticket_number || `TKT-${t.id.slice(0, 6)}`,
        subject: t.subject,
        category_name: t.category?.name || "General Maintenance",
        description: t.description || "",
        priority: t.priority || "medium",
        status: t.status || "created",
        escalation_state: t.escalation_state || "on_track",
        created_at: t.created_at,
        assigned_to: t.assigned_vendor?.name || t.assigned_user?.full_name || "Facility Maintenance Team",
        assigned_role: t.assigned_vendor ? "vendor_technician" : "facility_manager",
        resolved_at: t.resolved_at,
        messages_count: t.messages_count || 1,
      }));
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (payload: { subject: string; category_id?: string; description: string; priority: string }) => {
      const profile = await api.get<any>("/residents/me");
      const unitId = profile?.occupancies?.[0]?.unit_id;
      if (!unitId) {
        throw new Error("No active unit occupancy found for resident");
      }
      let categoryId = payload.category_id;
      if (!categoryId) {
        const categories = await api.get<any[]>("/complaints/categories");
        if (Array.isArray(categories) && categories.length > 0) {
          categoryId = categories[0].id;
        }
      }
      return await api.post("/complaints/tickets", {
        unit_id: unitId,
        category_id: categoryId,
        subject: payload.subject,
        description: payload.description,
        priority: payload.priority || "medium",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "complaints"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "overview"] });
    },
  });

  const confirmTicketMutation = useMutation({
    mutationFn: async ({ ticketId, satisfied, notes }: { ticketId: string; satisfied: boolean; notes?: string }) => {
      return await api.post(`/complaints/tickets/${ticketId}/confirm`, { satisfied, notes: notes || "Confirmed by resident" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "complaints"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "overview"] });
    },
  });

  return { ...query, createTicket: createTicketMutation, confirmTicket: confirmTicketMutation };
}

export function useResidentPayments() {
  const queryClient = useQueryClient();

  const query = useQuery<InvoiceItem[]>({
    queryKey: ["resident", "invoices"],
    queryFn: async () => {
      const res = await api.get<any[]>("/billing/invoices");
      if (!Array.isArray(res)) return [];
      return res.map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        title: `Maintenance & Operations (${inv.invoice_number})`,
        total_amount: Number(inv.total_amount ?? 0),
        amount_paid: Number(inv.amount_paid ?? 0),
        balance_due: Number(inv.balance_due ?? 0),
        status: inv.status,
        issue_date: inv.issue_date || inv.created_at,
        due_date: inv.due_date || inv.created_at,
        receipt_number: inv.receipt_number,
        line_items: Array.isArray(inv.items)
          ? inv.items.map((i: any) => ({ head: i.description || "Maintenance Charge", amount: Number(i.amount ?? 0) }))
          : [],
      }));
    },
  });

  const payDuesMutation = useMutation({
    mutationFn: async ({ invoiceId, amount, method }: { invoiceId: string; amount: number; method?: string }) => {
      return await api.post("/billing/payments", {
        amount: Number(amount),
        payment_method: "upi",
        allocations: [{ invoice_id: invoiceId, amount: Number(amount) }],
        remarks: `Resident portal simulated payment via ${method || "UPI"}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "overview"] });
    },
  });

  return { ...query, payDues: payDuesMutation };
}

export function useResidentProfile() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["resident", "me-profile"],
    queryFn: async () => {
      return await api.get<any>("/residents/me");
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (data: { full_name?: string; phone?: string; emergency_notes?: string }) => {
      return await api.patch("/residents/me", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "me-profile"] });
    },
  });

  const addFamilyMember = useMutation({
    mutationFn: async (data: { unit_id: string; primary_resident_profile_id: string; full_name: string; relationship: string; phone?: string }) => {
      return await api.post("/residents/family-members", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "me-profile"] });
    },
  });

  return { ...query, updateProfile, addFamilyMember };
}

export function useSendResidentPanic() {
  return useMutation({
    mutationFn: async (payload: { unit_id?: string; note?: string }) => {
      return await api.post("/gate/alerts", {
        alert_type: "medical",
        severity: "high",
        message: payload.note || "Resident emergency panic triggered from portal",
      });
    },
  });
}
