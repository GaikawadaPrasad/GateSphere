"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";

export type OperationalRoleSlug =
  | "facility_manager"
  | "security_supervisor"
  | "security_guard"
  | "auditor";

export interface OperationalStaffGrant {
  id: string;
  role_id?: string;
  role_slug: string;
  role_name?: string;
  community_id?: string | null;
}

export interface OperationalStaffUser {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  is_superadmin?: boolean;
  roles: OperationalStaffGrant[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateOperationalStaffPayload {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  role_slug: OperationalRoleSlug;
  community_id: string;
}

export const OPERATIONAL_ROLES: {
  slug: OperationalRoleSlug;
  name: string;
  icon: string;
  badgeClass: string;
  description: string;
  responsibilities: string[];
}[] = [
  {
    slug: "facility_manager",
    name: "Facility Manager",
    icon: "🏢",
    badgeClass: "badge-purple",
    description: "Oversees community facilities, service tickets, amenities, and vendor operations.",
    responsibilities: [
      "Manage community amenities, schedules, and bookings",
      "Coordinate maintenance tickets and service requests",
      "Supervise facility upkeep and vendor technicians",
      "Review incident reports and facility logs",
    ],
  },
  {
    slug: "security_supervisor",
    name: "Security Supervisor",
    icon: "🛡️",
    badgeClass: "badge-warning",
    description: "Perimeter security lead managing guard shifts, incident escalations, and live gate oversight.",
    responsibilities: [
      "Supervise security guards and gate checkpoint operations",
      "Manage emergency incident response and escalations",
      "Review visitor, cab, and delivery gate logs",
      "Perform daily shift handovers and patrol audits",
    ],
  },
  {
    slug: "security_guard",
    name: "Security Guard",
    icon: "👮",
    badgeClass: "badge-info",
    description: "Frontline gate personnel conducting visitor check-in, pass verification, and delivery logging.",
    responsibilities: [
      "Process visitor entry and exit at community gates",
      "Verify resident pre-approvals and QR/PIN passes",
      "Log package and courier deliveries at gate",
      "Monitor vehicle entry/exit and record taxi arrivals",
    ],
  },
  {
    slug: "auditor",
    name: "Statutory Auditor",
    icon: "📋",
    badgeClass: "badge-neutral",
    description: "Statutory and compliance auditor with read-only access to audit logs, financial records, and gate logs.",
    responsibilities: [
      "Review immutable audit trail across community operations",
      "Inspect financial ledgers, maintenance invoices, and reconciliation records",
      "Audit gate entry/exit logs and visitor verification compliance",
      "Export compliance reports and statutory verification records",
    ],
  },
];

export function getRoleMeta(slug: string) {
  return (
    OPERATIONAL_ROLES.find((r) => r.slug === slug) || {
      slug: slug as OperationalRoleSlug,
      name: slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: "👤",
      badgeClass: "badge-neutral",
      description: "Operational personnel",
      responsibilities: [],
    }
  );
}

export function useOperationalStaff(communityId?: string) {
  return useQuery<OperationalStaffUser[]>({
    queryKey: ["operational-staff", communityId],
    queryFn: async () => {
      if (!communityId) return [];
      const res = await usersApi.list({
        community_id: communityId,
        page_size: 100,
      });

      const rawList: any[] = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.data)
        ? (res as any).data
        : [];

      if (rawList.length === 0) return [];

      const targetSlugs = new Set([
        "facility_manager",
        "security_supervisor",
        "security_guard",
        "auditor",
      ]);

      // Filter users that hold at least one of the operational roles in this community
      const filtered = rawList
        .map((u: any) => ({
          id: String(u.id),
          full_name: String(u.full_name || "Unknown"),
          email: String(u.email || ""),
          phone: u.phone || null,
          is_active: Boolean(u.is_active),
          is_superadmin: Boolean(u.is_superadmin),
          roles: Array.isArray(u.roles) ? u.roles : [],
          created_at: u.created_at,
          updated_at: u.updated_at,
        }))
        .filter((u) => u.roles.some((r: any) => targetSlugs.has(r.role_slug)));

      return filtered;
    },
    enabled: Boolean(communityId),
    staleTime: 30_000,
  });
}

export function useCreateOperationalStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateOperationalStaffPayload) => {
      return await usersApi.create({
        full_name: payload.full_name.trim(),
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        phone: payload.phone?.trim() || undefined,
        role_slug: payload.role_slug,
        community_id: payload.community_id,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["operational-staff", variables.community_id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["dashboards", "overview"] });
    },
  });
}

export function useUpdateOperationalStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      communityId?: string;
      data: { full_name?: string; email?: string; phone?: string; is_active?: boolean };
    }) => {
      return await usersApi.update(userId, data);
    },
    onSuccess: (_, variables) => {
      if (variables.communityId) {
        queryClient.invalidateQueries({ queryKey: ["operational-staff", variables.communityId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["operational-staff"] });
      }
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
