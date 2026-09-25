"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { deriveTicketEscalationState, isValidPersonName } from "@/lib/utils";

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
  photo_url?: string | null;
  visitor_type?: string;
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
  protocol: "allow_gate" | "require_approval" | "leave_at_desk" | "reject" | string;
  status: "expected" | "at_gate" | "delivered" | "rejected" | "collected" | string;
  approval_status?: "pending" | "approved" | "rejected" | "auto_approved" | string;
  arrived_at?: string;
  expected_at?: string;
  delivered_at?: string;
  driver_name?: string;
  driver_phone?: string;
  parcel_count?: number;
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
  slot_id?: string;
  unit_id?: string;
  community_id?: string;
  user_id?: string;
  resident_name?: string;
  resident_phone?: string;
  unit_number?: string;
  tower_name?: string;
  unit_label?: string;
}

export interface ComplaintTicket {
  id: string;
  ticket_number: string;
  subject: string;
  category_name: string;
  description: string;
  priority: "low" | "medium" | "high" | "emergency";
  status:
    | "open"
    | "created"
    | "assigned"
    | "acknowledged"
    | "in_progress"
    | "resolved"
    | "resident_confirmation"
    | "closed"
    | "reopened"
    | "cancelled";
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
  status: "posted" | "paid" | "partially_paid" | "overdue" | "cancelled" | "draft";
  issue_date: string;
  due_date: string;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  subtotal?: number;
  discount?: number;
  late_fee?: number;
  tax?: number;
  receipt_number?: string;
  line_items?: {
    head: string;
    description?: string;
    quantity?: number;
    unit_rate?: number;
    amount: number;
    taxable?: boolean;
  }[];
}

export function useResidentOverview(communityId?: string | null) {
  return useQuery({
    queryKey: ["resident", "overview", communityId],
    staleTime: 5_000,
    queryFn: async () => {
      const stats = await api.get<any>(
        `/dashboards/resident${communityId ? `?community_id=${communityId}` : ""}`,
      );
      return {
        pending_dues_amount: Number(
          stats?.pending_dues_amount ?? stats?.my_outstanding_balance ?? 0,
        ),
        pending_visitor_count: Number(
          stats?.pending_visitor_count ?? stats?.my_pending_visitor_requests ?? 0,
        ),
        open_service_tickets: Number(stats?.open_tickets_count ?? stats?.my_open_tickets ?? 0),
        staff_on_duty_count: Number(stats?.staff_on_duty_count ?? 0),
        upcoming_amenity_bookings: Number(
          stats?.upcoming_amenity_bookings ?? stats?.my_upcoming_bookings ?? 0,
        ),
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
      const res = await api.get<any[]>("/visitors/requests?page_size=100");
      if (!Array.isArray(res)) return [];
      return res.map((r: any) => ({
        id: r.id,
        visitor_name: r.visitor?.full_name || r.visitor_name || r.full_name || "Visitor",
        phone: r.visitor?.phone || r.phone || r.visitor_phone || "",
        purpose: r.purpose || "Guest visit",
        vehicle_number: r.vehicle_number || r.visitor?.vehicle_number || undefined,
        photo_url: r.photo_url || r.visitor?.photo_url || r.entries?.[0]?.entry_photo_url || null,
        visitor_type: r.visitor_type || "guest",
        status: r.status,
        created_at: r.created_at,
        valid_until: r.valid_until,
        pass_code:
          r.passes?.[0]?.pin ||
          (r.passes?.[0]?.token ? `QR-${r.passes[0].token.slice(0, 6)}` : undefined) ||
          r.pass_code,
        qr_token: r.passes?.[0]?.token,
        entry_time: r.entries?.[0]?.entry_at,
        exit_time: r.entries?.[0]?.exit_at,
      }));
    },
    refetchInterval: 10000,
  });

  const decideMutation = useMutation({
    mutationFn: async ({
      requestId,
      approved,
      note,
    }: {
      requestId: string;
      approved: boolean;
      note?: string;
    }) => {
      return await api.post(`/visitors/requests/${requestId}/decision`, {
        decision: approved ? "approved" : "rejected",
        remarks: note || (approved ? "Approved by resident" : "Rejected by resident"),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "visitors"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const createPassMutation = useMutation({
    mutationFn: async (payload: {
      visitor_name?: string;
      phone?: string;
      id_type?: string;
      id_number?: string;
      category?: string;
      reason?: string;
      valid_for_hours: number;
      unit_id?: string;
      vehicle_number?: string;
      party_size?: number;
      group_label?: string;
    }) => {
      const isUuid = (s?: string) =>
        Boolean(
          s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s),
        );

      let unitId = payload.unit_id;
      if (!isUuid(unitId)) {
        try {
          const profile = await api.get<any>("/residents/me");
          unitId = profile?.occupancies?.[0]?.unit_id;
        } catch (e) {
          console.warn("Could not fetch /residents/me for unit_id", e);
        }
      }
      if (!isUuid(unitId)) {
        throw new Error(
          "No active unit occupancy found for resident profile. Please ensure you are assigned to an active unit.",
        );
      }

      const cleanName = (payload.visitor_name || "").trim();
      if (!cleanName) {
        throw new Error("Visitor name is required to generate a gate pass.");
      }
      if (cleanName.length < 2) {
        throw new Error("Visitor name is too short (must be at least 2 characters).");
      }
      if (cleanName.length > 35) {
        throw new Error("Visitor name exceeds maximum length (cannot exceed 35 characters).");
      }
      if (!isValidPersonName(cleanName)) {
        throw new Error("Visitor name must contain only alphabetic letters and spaces.");
      }
      let rawPhone = (payload.phone || "").trim().replace(/[\s\-()]/g, "");
      if (!rawPhone) {
        throw new Error("Visitor mobile number is required to generate a gate pass.");
      }
      if (!rawPhone.startsWith("+") && rawPhone.length === 10) {
        rawPhone = `+91${rawPhone}`;
      } else if (!rawPhone.startsWith("+") && rawPhone.length > 10) {
        rawPhone = `+${rawPhone}`;
      }
      const cleanPhone = rawPhone;

      const mapCategoryToVisitorType = (cat: string): string => {
        const c = (cat || "").toLowerCase().trim();
        if (c.includes("deliver") || c.includes("courier")) return "delivery_exec";
        if (c.includes("cab") || c.includes("taxi")) return "cab_taxi";
        if (c.includes("service") || c.includes("tech") || c.includes("maint"))
          return "service_tech";
        if (c.includes("contract") || c.includes("vendor") || c.includes("work")) return "vendor";
        if (c.includes("interview")) return "interviewee";
        if (
          c.includes("staff") ||
          c.includes("domestic") ||
          c.includes("help") ||
          c.includes("maid") ||
          c.includes("recurr")
        )
          return "recurring";
        if (c.includes("event") || c.includes("party")) return "event_guest";
        if (c.includes("relat") || c.includes("family")) return "relative";
        return "personal_guest";
      };

      const cleanCategory = payload.category || "Guest";
      const visitorType = mapCategoryToVisitorType(cleanCategory);
      const cleanReason = (payload.reason || "").trim() || `${cleanCategory} Entry`;
      const now = new Date();
      const validUntil = new Date(now.getTime() + (payload.valid_for_hours || 24) * 60 * 60 * 1000);

      const cleanIdNum = payload.id_number
        ? payload.id_number
            .trim()
            .toUpperCase()
            .replace(/[\s\-]/g, "")
        : undefined;

      const req = await api.post<any>("/visitors/requests", {
        unit_id: unitId,
        visitor_type: visitorType,
        visitor: {
          full_name: cleanName,
          phone: cleanPhone,
          id_type: cleanIdNum ? payload.id_type : undefined,
          id_number: cleanIdNum || undefined,
          vehicle_number: payload.vehicle_number || undefined,
        },
        purpose: cleanReason,
        expected_at: now.toISOString(),
        valid_until: validUntil.toISOString(),
        vehicle_number: payload.vehicle_number || undefined,
        party_size: payload.party_size || 1,
        group_label: payload.group_label || undefined,
      });

      const passRes = await api.post<any>(`/visitors/requests/${req.id}/passes`, {
        pass_type: "qr",
        max_entries: payload.party_size && payload.party_size > 1 ? payload.party_size : 1,
        with_pin: true,
        valid_from: now.toISOString(),
        valid_to: validUntil.toISOString(),
      });

      return {
        ...passRes,
        request_id: req.id,
        visitor_name: cleanName,
        category: cleanCategory,
        reason: cleanReason,
        valid_from: now.toISOString(),
        valid_to: validUntil.toISOString(),
        token: passRes.token,
        pin: passRes.pin,
      };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "visitors"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "overview"],
        refetchType: "all",
      });
    },
  });

  return { ...query, decide: decideMutation, createPass: createPassMutation };
}

export function useResidentDeliveries() {
  const queryClient = useQueryClient();

  const query = useQuery<DeliveryItem[]>({
    queryKey: ["resident", "deliveries"],
    queryFn: async () => {
      const res = await api.get<any[]>("/deliveries?page_size=100");
      if (!Array.isArray(res)) return [];
      return res.map((d: any) => ({
        id: d.id,
        courier_company:
          d.provider_name || (d.delivery_type ? d.delivery_type.toUpperCase() : "Courier"),
        package_type: d.delivery_type
          ? `${d.delivery_type.toUpperCase()} Package`
          : "General Package",
        tracking_id: d.tracking_reference || d.id.slice(0, 8),
        protocol: d.protocol_id || "allow_gate",
        status: d.status || "expected",
        approval_status: d.approval_status || "pending",
        arrived_at: d.arrived_at,
        expected_at: d.expected_at,
        delivered_at: d.delivered_at,
        driver_name: d.executive_name,
        driver_phone: d.executive_phone,
        parcel_count: d.parcel_count || 1,
      }));
    },
    refetchInterval: 10000,
  });

  const updateProtocol = useMutation({
    mutationFn: async (payload: {
      delivery_type?: string;
      protocol_type?: string;
      category?: string;
      protocol?: string;
      unit_id?: string;
      requires_otp?: boolean;
      allow_direct_entry?: boolean;
      leave_at_gate?: boolean;
      is_active?: boolean;
    }) => {
      const delivery_type = payload.delivery_type || payload.category;
      const protocol_type = payload.protocol_type || payload.protocol;
      const body: Record<string, unknown> = {
        delivery_type,
        protocol_type,
        requires_otp: Boolean(payload.requires_otp),
        allow_direct_entry:
          payload.allow_direct_entry ??
          (protocol_type === "allow_at_gate" || protocol_type === "direct_to_door"),
        leave_at_gate:
          payload.leave_at_gate ??
          (protocol_type === "leave_at_gate_desk" || protocol_type === "leave_at_gate"),
        is_active: payload.is_active !== false,
      };
      if (payload.unit_id) {
        body.unit_id = payload.unit_id;
      }
      return await api.put("/deliveries/protocols", body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "deliveries"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "delivery-protocols"],
        refetchType: "all",
      });
    },
  });

  const decideDelivery = useMutation({
    mutationFn: async ({
      deliveryId,
      approved,
      remarks,
    }: {
      deliveryId: string;
      approved: boolean;
      remarks?: string;
    }) => {
      return await api.post(`/deliveries/${deliveryId}/decision`, {
        decision: approved ? "approved" : "rejected",
        remarks: remarks || (approved ? "Approved by resident" : "Rejected by resident"),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return { ...query, updateProtocol, decideDelivery };
}

export interface AmenitySlot {
  id: string;
  community_id: string;
  amenity_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number | null;
  fee: number | string;
  is_active: boolean;
}

export function useAmenitySlots(amenityId?: string) {
  return useQuery<AmenitySlot[]>({
    queryKey: ["resident", "amenity-slots", amenityId],
    queryFn: async () => {
      if (!amenityId) return [];
      const res = await api.get<any[]>(`/amenities/${amenityId}/slots`);
      if (!Array.isArray(res)) return [];
      return res.map((s: any) => ({
        id: s.id,
        community_id: s.community_id,
        amenity_id: s.amenity_id,
        day_of_week: Number(s.day_of_week),
        start_time: s.start_time,
        end_time: s.end_time,
        capacity: s.capacity,
        fee: s.fee,
        is_active: s.is_active !== false,
      }));
    },
    enabled: Boolean(amenityId),
  });
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
        description: a.description || `Community ${a.name} — open for booking.`,
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
      const [bookingsRes, amenitiesRes] = await Promise.all([
        api.get<any[]>("/amenities/bookings?page_size=100"),
        api.get<any[]>("/amenities").catch(() => []),
      ]);
      if (!Array.isArray(bookingsRes)) return [];
      const amenitiesMap = new Map<string, string>();
      if (Array.isArray(amenitiesRes)) {
        for (const a of amenitiesRes) {
          if (a?.id && a?.name) {
            amenitiesMap.set(a.id, a.name);
          }
        }
      }
      return bookingsRes.map((b: any) => ({
        id: b.id,
        amenity_id: b.amenity_id,
        amenity_name: b.amenity?.name || amenitiesMap.get(b.amenity_id) || "Community Amenity",
        date: b.booking_date || (b.start_at ? b.start_at.split("T")[0] : ""),
        start_time: b.start_at
          ? new Date(b.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "",
        end_time: b.end_at
          ? new Date(b.end_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "",
        status: b.status || "confirmed",
        guests_count: b.participant_count || 1,
        total_amount: Number(b.amount_charged ?? 0),
      }));
    },
  });

  const bookMutation = useMutation({
    mutationFn: async (payload: {
      amenity_id: string;
      slot_id: string;
      date: string;
      guests: number;
    }) => {
      return await api.post("/amenities/bookings", {
        amenity_id: payload.amenity_id,
        slot_id: payload.slot_id,
        booking_date: payload.date,
        participant_count: payload.guests || 1,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "my-bookings"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "overview"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "amenity-slots"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "amenities-list"],
        refetchType: "all",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return await api.post(`/amenities/bookings/${bookingId}/cancel`, {
        reason: "Resident requested cancellation",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "my-bookings"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "overview"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "amenities-list"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "amenity-slots"],
        refetchType: "all",
      });
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
      const [res, categoriesRes] = await Promise.all([
        api.get<any[]>("/complaints/tickets?page_size=100"),
        api.get<any[]>("/complaints/categories").catch(() => []),
      ]);
      if (!Array.isArray(res)) return [];
      const categoryMap = new Map<string, string>();
      if (Array.isArray(categoriesRes)) {
        for (const c of categoriesRes) if (c?.id) categoryMap.set(c.id, c.name);
      }
      return res.map((t: any) => ({
        id: t.id,
        ticket_number: t.ticket_number || `TKT-${t.id.slice(0, 6)}`,
        subject: t.subject,
        category_name: categoryMap.get(t.category_id) || "Uncategorized",
        description: t.description || "",
        priority: t.priority || "medium",
        status: t.status || "created",
        escalation_state: deriveTicketEscalationState(t),
        created_at: t.created_at,
        assigned_to: t.status === "created" ? "Unassigned" : "Assigned",
        assigned_role: undefined,
        resolved_at: t.resolved_at,
        messages_count: 0,
      }));
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (payload: {
      subject: string;
      category_id?: string;
      category?: string;
      description: string;
      priority?: string;
    }) => {
      const isUuid = (s?: string) =>
        Boolean(
          s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s),
        );

      const profile = await api.get<any>("/residents/me");
      const activeOccupancy = profile?.occupancies?.find((o: any) => o.is_active) || profile?.occupancies?.[0];
      const unitId = activeOccupancy?.unit_id || profile?.unit_id;
      if (!unitId) {
        throw new Error("No active unit occupancy found for resident profile");
      }
      const commId = activeOccupancy?.community_id || profile?.community_id;
      let categoryId = payload.category_id;
      const catUrl = commId ? `/complaints/categories?community_id=${commId}` : "/complaints/categories";
      const categories = await api.get<any[]>(catUrl).catch(() => []);
      if (!isUuid(categoryId) && Array.isArray(categories) && categories.length > 0) {
        if (payload.category) {
          const catLower = payload.category.toLowerCase().trim();
          const match = categories.find(
            (c: any) =>
              c.name?.toLowerCase().includes(catLower) ||
              c.code?.toLowerCase() === catLower ||
              catLower.includes(c.name?.toLowerCase()) ||
              catLower.includes(c.code?.toLowerCase()),
          );
          if (match?.id) categoryId = match.id;
        }
        if (!isUuid(categoryId)) categoryId = categories[0]?.id;
      }
      return await api.post("/complaints/tickets", {
        unit_id: unitId,
        category_id: isUuid(categoryId) ? categoryId : undefined,
        subject: (payload.subject || "").trim() || "Maintenance Request",
        description: (payload.description || "").trim() || "Reported by resident",
        priority: payload.priority || "medium",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "complaints"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "overview"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["complaints"],
        refetchType: "all",
      });
    },
  });

  const confirmTicketMutation = useMutation({
    mutationFn: async ({
      ticketId,
      satisfied,
      notes,
    }: {
      ticketId: string;
      satisfied: boolean;
      notes?: string;
    }) => {
      return await api.post(`/complaints/tickets/${ticketId}/confirm`, {
        confirmation_status: satisfied ? "confirmed" : "disputed",
        remarks: notes || (satisfied ? "Confirmed by resident" : "Disputed by resident"),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "complaints"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "overview"],
        refetchType: "all",
      });
    },
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async ({
      ticketId,
      rating,
      comments,
    }: {
      ticketId: string;
      rating: number;
      comments?: string;
    }) => {
      return await api.post(`/complaints/tickets/${ticketId}/feedback`, {
        rating,
        comments: comments?.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "complaints"],
        refetchType: "all",
      });
    },
  });

  return {
    ...query,
    createTicket: createTicketMutation,
    confirmTicket: confirmTicketMutation,
    submitFeedback: submitFeedbackMutation,
  };
}

export interface LedgerEntryItem {
  id: string;
  unit_id?: string;
  entry_type: "debit" | "credit" | string;
  source_type: string;
  source_id?: string;
  amount: number;
  balance_after: number;
  entry_date: string;
  narration?: string;
  created_at: string;
}

export function useResidentLedger(unitId?: string) {
  return useQuery<LedgerEntryItem[]>({
    queryKey: ["resident", "ledger", unitId],
    queryFn: async () => {
      let targetUnitId = unitId;
      if (!targetUnitId) {
        const me = await api.get<any>("/residents/me").catch(() => null);
        targetUnitId = me?.occupancies?.[0]?.unit_id;
      }
      if (!targetUnitId) return [];
      const res = await api.get<any[]>(`/billing/units/${targetUnitId}/ledger?page_size=100`);
      if (!Array.isArray(res)) return [];
      return res.map((l: any) => ({
        id: l.id,
        unit_id: l.unit_id,
        entry_type: l.entry_type,
        source_type: l.source_type,
        source_id: l.source_id,
        amount: Number(l.amount ?? 0),
        balance_after: Number(l.balance_after ?? 0),
        entry_date: l.entry_date || l.created_at,
        narration: l.narration,
        created_at: l.created_at,
      }));
    },
  });
}

export function useResidentPayments() {
  const queryClient = useQueryClient();

  const query = useQuery<InvoiceItem[]>({
    queryKey: ["resident", "invoices"],
    queryFn: async () => {
      const res = await api.get<any[]>("/billing/invoices?page_size=100");
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
        billing_period_start: inv.billing_period_start || null,
        billing_period_end: inv.billing_period_end || null,
        subtotal: Number(inv.subtotal ?? inv.total_amount ?? 0),
        discount: Number(inv.discount ?? 0),
        late_fee: Number(inv.late_fee ?? 0),
        tax: Number(inv.tax ?? 0),
        receipt_number: inv.receipt_number,
        line_items:
          Array.isArray(inv.items) && inv.items.length > 0
            ? inv.items.map((i: any) => ({
                head: i.description || "Maintenance Charge",
                description: i.description || "General maintenance and community services",
                quantity: Number(i.quantity ?? 1),
                unit_rate: Number(i.unit_rate ?? i.amount ?? 0),
                amount: Number(i.amount ?? 0),
                taxable: Boolean(i.taxable),
              }))
            : [
                {
                  head: "Monthly Society Maintenance & Operations",
                  description: "Standard community upkeep, security, and common utilities",
                  quantity: 1,
                  unit_rate: Number(inv.subtotal ?? inv.total_amount ?? 0),
                  amount: Number(inv.subtotal ?? inv.total_amount ?? 0),
                  taxable: Number(inv.tax ?? 0) > 0,
                },
              ],
      }));
    },
  });

  const payDuesMutation = useMutation({
    mutationFn: async ({
      invoiceId,
      amount,
      method,
    }: {
      invoiceId: string;
      amount: number;
      method?: string;
    }) => {
      const res = await api.post<any>("/billing/payments", {
        amount: Number(amount),
        payment_method: "upi",
        allocations: [{ invoice_id: invoiceId, amount: Number(amount) }],
        remarks: `Resident portal simulated payment via ${method || "UPI"}`,
      });
      return res;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "invoices"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "overview"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({ queryKey: ["resident", "ledger"], refetchType: "all" });
    },
  });

  return { ...query, payDues: payDuesMutation };
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  phone: string;
  access_enabled: boolean;
  unit_id?: string;
  unit_number?: string;
  pass_token?: string;
  pin?: string;
  primary_resident_profile_id?: string;
  date_of_birth?: string;
  created_at?: string;
}

export function useResidentFamilyMembers() {
  const queryClient = useQueryClient();

  const query = useQuery<FamilyMember[]>({
    queryKey: ["resident", "family-members"],
    queryFn: async () => {
      const me = await api.get<any>("/residents/me");
      if (me && Array.isArray(me.family_members)) {
        return me.family_members.map((f: any) => ({
          id: f.id,
          name: f.full_name || f.name,
          relation: f.relationship || f.relationship_type || "Family Member",
          phone: f.phone || "",
          access_enabled: f.access_enabled !== false,
          unit_id: f.unit_id,
          unit_number: f.unit_number,
          pass_token: f.pass_token,
          pin: f.pin,
          primary_resident_profile_id: f.primary_resident_profile_id,
          date_of_birth: f.date_of_birth,
          created_at: f.created_at,
        }));
      }
      return [];
    },
  });

  const relationshipTypeMap: Record<string, string> = {
    Spouse: "spouse",
    "Co-Owner / Spouse": "spouse",
    Son: "child",
    Daughter: "child",
    Child: "child",
    Parent: "parent",
    Sibling: "sibling",
    Relative: "relative",
    "Domestic Help": "domestic_help",
    Other: "other",
  };

  const normalizePhone = (phone?: string): string | undefined => {
    if (!phone) return undefined;
    let clean = phone.trim().replace(/[\s\-()]/g, "");
    if (!clean) return undefined;
    if (!clean.startsWith("+") && clean.length === 10) {
      clean = `+91${clean}`;
    } else if (!clean.startsWith("+") && clean.length > 10) {
      clean = `+${clean}`;
    }
    return clean;
  };

  const addMemberMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      relation: string;
      phone: string;
      access_enabled?: boolean;
    }) => {
      const me = await api.get<any>("/residents/me");
      const unitId = me?.occupancies?.[0]?.unit_id;
      const profileId = me?.id;
      if (!unitId || !profileId) {
        throw new Error(
          "No active unit occupancy found for resident profile. Ensure you have an assigned unit.",
        );
      }
      const relEnum =
        relationshipTypeMap[payload.relation] || payload.relation?.toLowerCase() || "other";
      return await api.post<any>("/residents/family-members", {
        unit_id: unitId,
        primary_resident_profile_id: profileId,
        full_name: payload.name.trim(),
        relationship: relEnum,
        phone: normalizePhone(payload.phone),
        access_enabled: payload.access_enabled !== false,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "family-members"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "me-profile"],
        refetchType: "all",
      });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      name: string;
      relation: string;
      phone: string;
      access_enabled?: boolean;
    }) => {
      const relEnum =
        relationshipTypeMap[payload.relation] || payload.relation?.toLowerCase() || "other";
      return await api.patch(`/residents/family-members/${payload.id}`, {
        full_name: payload.name.trim(),
        relationship: relEnum,
        phone: normalizePhone(payload.phone),
        access_enabled: payload.access_enabled,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "family-members"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "me-profile"],
        refetchType: "all",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/residents/family-members/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "family-members"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "me-profile"],
        refetchType: "all",
      });
    },
  });

  return {
    ...query,
    familyMembers: query.data || [],
    addMember: addMemberMutation,
    updateMember: updateMemberMutation,
    removeMember: removeMemberMutation,
  };
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
    mutationFn: async (data: {
      full_name?: string;
      phone?: string;
      emergency_notes?: string;
      emergency_contact_name?: string;
      emergency_contact_phone?: string;
      emergency_contact_relationship?: string;
    }) => {
      return await api.patch("/residents/me", data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "me-profile"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"], refetchType: "all" });
    },
  });

  const addFamilyMember = useMutation({
    mutationFn: async (data: {
      unit_id: string;
      primary_resident_profile_id: string;
      full_name: string;
      relationship: string;
      phone?: string;
    }) => {
      return await api.post("/residents/family-members", data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "family-members"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "me-profile"],
        refetchType: "all",
      });
    },
  });

  return { ...query, updateProfile, addFamilyMember };
}

export interface DeliveryProtocolItem {
  id: string;
  delivery_type: string;
  protocol_type: string;
  requires_otp: boolean;
  is_active: boolean;
}

export function useResidentDeliveryProtocols() {
  return useQuery<DeliveryProtocolItem[]>({
    queryKey: ["resident", "delivery-protocols"],
    queryFn: async () => {
      const res = await api.get<any[]>("/deliveries/protocols");
      if (!Array.isArray(res)) return [];
      return res.map((p: any) => ({
        id: p.id,
        delivery_type: p.delivery_type,
        protocol_type: p.protocol_type,
        requires_otp: Boolean(p.requires_otp),
        is_active: p.is_active !== false,
      }));
    },
  });
}

export interface ResidentVehicle {
  id: string;
  plate: string;
  make_model: string;
  vehicle_type: string;
  slot: string;
  rfid_tag: string;
  violations: number;
}

export function useResidentVehicles() {
  const queryClient = useQueryClient();

  const query = useQuery<{
    vehicles: ResidentVehicle[];
    allocations: any[];
    violations: any[];
  }>({
    queryKey: ["resident", "vehicles"],
    queryFn: async () => {
      const me = await api.get<any>("/residents/me").catch(() => null);
      const communityId = me?.community_id;
      const params = {
        ...(communityId ? { community_id: communityId } : {}),
        page_size: 100,
      };
      const [vehiclesRes, allocationsRes, slotsRes, violationsRes] = await Promise.all([
        api.get<any[]>("/vehicles", params).catch(() => []),
        api.get<any[]>("/vehicles/parking/allocations", params).catch(() => []),
        api.get<any[]>("/vehicles/parking/slots", params).catch(() => []),
        api.get<any[]>("/vehicles/parking/violations", params).catch(() => []),
      ]);

      const rawVehicles = Array.isArray(vehiclesRes) ? vehiclesRes : [];
      const rawAllocations = Array.isArray(allocationsRes) ? allocationsRes : [];
      const rawSlots = Array.isArray(slotsRes) ? slotsRes : [];
      const rawViolations = Array.isArray(violationsRes) ? violationsRes : [];

      const slotMap = new Map<string, string>();
      for (const s of rawSlots) if (s?.id) slotMap.set(s.id, s.slot_code);

      const allocationByVehicle = new Map<string, any>();
      for (const a of rawAllocations) {
        if (a?.vehicle_id && a?.status === "active") allocationByVehicle.set(a.vehicle_id, a);
      }

      const violationCountByVehicle = new Map<string, number>();
      for (const v of rawViolations) {
        if (v?.vehicle_id) {
          violationCountByVehicle.set(
            v.vehicle_id,
            (violationCountByVehicle.get(v.vehicle_id) || 0) + 1,
          );
        }
      }

      const vehiclesList: ResidentVehicle[] = rawVehicles.map((v: any) => {
        const alloc = allocationByVehicle.get(v.id);
        return {
          id: v.id,
          plate: v.registration_number || v.plate_number || "—",
          make_model: [v.make, v.model].filter(Boolean).join(" ") || v.vehicle_type || "Vehicle",
          vehicle_type: v.vehicle_type || "car",
          slot: alloc ? slotMap.get(alloc.slot_id) || "Allocated" : "Not Allocated",
          rfid_tag: v.sticker_number || "Not Issued",
          violations: violationCountByVehicle.get(v.id) || 0,
        };
      });

      const parsedViolations = rawViolations.map((v: any) => ({
        id: v.id,
        violation_type: v.violation_type || "Parking Violation",
        plate_number: v.plate_number || v.vehicle?.registration_number || "—",
        slot_code: v.slot_id ? slotMap.get(v.slot_id) || "Unassigned Slot" : "General Parking",
        notes: v.notes || v.reason || "Misparked / Flagged by security",
        penalty_amount: Number(v.penalty_amount ?? 0),
        status: v.status || "open",
        created_at: v.created_at || v.reported_at || new Date().toISOString(),
      }));

      const parsedAllocations = rawAllocations.map((a: any) => ({
        id: a.id,
        slot_code: slotMap.get(a.slot_id) || a.slot_code || "Allocated Slot",
        slot_type: a.slot_type || "Reserved Resident Slot",
        status: a.status || "active",
        valid_from: a.valid_from || a.created_at,
      }));

      return {
        vehicles: vehiclesList,
        allocations: parsedAllocations,
        violations: parsedViolations,
      };
    },
  });

  const registerVehicleMutation = useMutation({
    mutationFn: async (payload: {
      registration_number: string;
      vehicle_type?: string;
      make?: string;
      model?: string;
      color?: string;
      sticker_number?: string;
      unit_id?: string;
    }) => {
      return await api.post("/vehicles", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident", "vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["resident", "overview"] });
    },
  });

  return {
    ...query,
    vehiclesList: query.data?.vehicles || [],
    allocationsList: query.data?.allocations || [],
    violationsList: query.data?.violations || [],
    registerVehicle: registerVehicleMutation,
  };
}

export interface AssignedDomesticStaff {
  id: string;
  staff_id: string;
  name: string;
  role: string;
  phone: string;
  police_verified: boolean;
  is_active: boolean;
  is_inside?: boolean;
  last_check_in?: string;
}

export function useResidentDomesticStaff(unitId?: string) {
  return useQuery<AssignedDomesticStaff[]>({
    queryKey: ["resident", "domestic-staff", unitId],
    queryFn: async () => {
      let targetUnitId = unitId;
      if (!targetUnitId) {
        const me = await api.get<any>("/residents/me").catch(() => null);
        targetUnitId = me?.occupancies?.[0]?.unit_id;
      }
      if (!targetUnitId) return [];
      const [assignments, openAttendance] = await Promise.all([
        api.get<any[]>("/domestic-staff/assignments", { unit_id: targetUnitId, page_size: 100 }),
        api.get<any[]>("/domestic-staff/attendance?open_only=true&page_size=100").catch(() => []),
      ]);
      if (!Array.isArray(assignments) || assignments.length === 0) return [];
      const staffList = await Promise.all(
        assignments.map((a: any) =>
          api.get<any>(`/domestic-staff/${a.staff_id}`).catch(() => null),
        ),
      );

      const openAttendanceMap = new Map<string, any>();
      if (Array.isArray(openAttendance)) {
        for (const att of openAttendance) {
          if (att?.staff_id && !att.check_out_at) {
            openAttendanceMap.set(att.staff_id, att);
          }
        }
      }

      return assignments.map((a: any, idx: number) => {
        const staff = staffList[idx];
        const activeAtt = openAttendanceMap.get(a.staff_id);
        return {
          id: a.id,
          staff_id: a.staff_id,
          name: staff?.full_name || "Staff Member",
          role: staff?.staff_type ? String(staff.staff_type).replace(/_/g, " ") : a.work_type,
          phone: staff?.phone || "",
          police_verified: staff?.police_verification_status === "verified",
          is_active: Boolean(a.is_active),
          is_inside: Boolean(activeAtt),
          last_check_in: activeAtt?.check_in_at,
        };
      });
    },
    refetchInterval: 15000,
  });
}

export function useSubmitStaffRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      staff_id: string;
      rating: number;
      feedback?: string;
      unit_id?: string;
    }) => {
      let unitId = payload.unit_id;
      if (!unitId) {
        const me = await api.get<any>("/residents/me").catch(() => null);
        unitId = me?.occupancies?.[0]?.unit_id;
      }
      return await api.post("/domestic-staff/ratings", {
        staff_id: payload.staff_id,
        unit_id: unitId || undefined,
        rating: payload.rating,
        feedback: payload.feedback?.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "domestic-staff"],
        refetchType: "all",
      });
    },
  });
}

export function useSendResidentPanic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      alert_type?: string;
      severity?: string;
      unit_id?: string;
      note?: string;
      location?: string;
    }) => {
      const locStr = payload.location
        ? payload.location.startsWith("Location:")
          ? payload.location
          : `Location: ${payload.location}`
        : "";
      const fullMessage = [locStr, payload.note || "Resident emergency panic triggered from portal"]
        .filter(Boolean)
        .join(" — ");

      const rawType = (payload.alert_type || "other").toLowerCase().trim();
      const validTypes = ["medical", "fire", "security", "intrusion", "other"];
      const backendType = validTypes.includes(rawType) ? rawType : "other";

      return await api.post("/gate/alerts", {
        alert_type: backendType,
        severity: payload.severity || "critical",
        message: fullMessage,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "overview"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({ queryKey: ["gate", "alerts"], refetchType: "all" });
    },
  });
}

export function useCommunityStaffDirectory() {
  return useQuery({
    queryKey: ["community", "staff-directory"],
    queryFn: async () => {
      const res = await api.get<any[]>("/domestic-staff?page_size=100");
      return Array.isArray(res) ? res : [];
    },
    staleTime: 60000,
  });
}

export function useAssignDomesticStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      staff_id: string;
      unit_id: string;
      work_type?: string;
      start_date?: string;
      end_date?: string;
      time_from?: string;
      time_to?: string;
      days_of_week?: string[];
    }) => {
      return await api.post("/domestic-staff/assignments", payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "domestic-staff"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "overview"],
        refetchType: "all",
      });
    },
  });
}

export function useEndDomesticStaffAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      return await api.post(`/domestic-staff/assignments/${assignmentId}/end`, {});
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "domestic-staff"],
        refetchType: "all",
      });
      await queryClient.invalidateQueries({
        queryKey: ["resident", "overview"],
        refetchType: "all",
      });
    },
  });
}

export function useRegisterVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      registration_number: string;
      vehicle_type: string;
      make?: string;
      model?: string;
      color?: string;
      sticker_number?: string;
    }) => {
      return await api.post("/vehicles", payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["resident", "vehicles"],
        refetchType: "all",
      });
    },
  });
}
