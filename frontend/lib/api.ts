/**
 * GateSphere Frontend — Typed API Client
 */

import type { ApiResponse, ListQueryParams, PaginationMeta } from "@/types/api";
import type { CurrentUser } from "@/types/auth";
import type { AuditLog, AuditQueryParams } from "@/types/audit";
import type { MaintenanceInvoice, Payment } from "@/types/billing";
import type { Community, Gate, Tower, Floor, Unit } from "@/types/communities";
import type { ServiceCategory, ServiceTicket } from "@/types/complaints";
import type {
  FinancialStats,
  OverviewStats,
  ResidentStats,
  SecurityStats,
} from "@/types/dashboards";
import type { GateEvent, GuardRoster, PanicAlert } from "@/types/gate";
import type { Permission, Role } from "@/types/rbac";
import type { ResidentProfile } from "@/types/residents";
import type {
  Staff,
  StaffAssignment,
  StaffAttendance,
  StaffCreate,
  CheckInPayload,
} from "@/types/staff";
import type {
  Incident,
  IncidentAction,
  IncidentCreate,
  IncidentHistory,
  IncidentTransition,
} from "@/types/incidents";
import type { AppNotification, NotificationPreference } from "@/types/notifications";
import type { AssistantQuickActionsResponse, AssistantResponse } from "@/types/assistant";

export type { CurrentUser, GateEvent, PanicAlert, GuardRoster, ServiceTicket, ServiceCategory };
export type NotificationItem = AppNotification;
export type VisitorRecord = Record<string, any>;
export type BlacklistEntry = Record<string, any>;
export type VendorTicket = Record<string, any>;
export type Amenity = Record<string, any>;
export type AmenityBooking = Record<string, any>;
export type ServiceRequest = Record<string, any>;
export type Facility = Record<string, any>;
export type MaintenanceRecord = Record<string, any>;
export type Vendor = Record<string, any>;

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string | string[]>;

  constructor(
    status: number,
    message: string,
    code?: string,
    fields?: Record<string, string | string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  get isValidationError(): boolean {
    return this.status === 422;
  }
}

export function getActiveRole(): string | null {
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname;
    if (pathname.startsWith("/super-admin") || pathname.startsWith("/dashboard/super-admin")) return "super_admin";
    if (pathname.startsWith("/owner-tenant") || pathname.startsWith("/resident") || pathname.startsWith("/dashboard/owner-tenant")) return "resident";
    if (pathname.startsWith("/auditor") || pathname.startsWith("/dashboard/auditor")) return "auditor";
    if (pathname.startsWith("/domestic-staff") || pathname.startsWith("/dashboard/domestic-staff")) return "domestic_staff";
    if (pathname.startsWith("/community-admin") || pathname.startsWith("/dashboard/community-admin")) return "community_admin";
    if (pathname.startsWith("/security-guard") || pathname.startsWith("/dashboard/security-guard")) return "security_guard";
    if (pathname.startsWith("/security-supervisor") || pathname.startsWith("/dashboard/security-supervisor")) return "security_supervisor";
    if (pathname.startsWith("/facility-manager") || pathname.startsWith("/dashboard/facility-manager")) return "facility_manager";
    if (pathname.startsWith("/association-committee") || pathname.startsWith("/dashboard/association-committee")) return "association_committee";
    if (pathname.startsWith("/vendor-technician") || pathname.startsWith("/dashboard/vendor-technician")) return "vendor_technician";

    const saved = localStorage.getItem("gatesphere_active_role");
    if (saved) return saved;

    if (document.cookie) {
      const match = document.cookie.match(/gatesphere_([a-z0-9_]+)_session/);
      if (match) {
        const bucket = match[1];
        if (bucket === "superadmin") return "super_admin";
        if (bucket === "security") return "security_guard";
        return bucket;
      }
    }
  }
  return null;
}

export function setActiveRole(role: string | null): void {
  if (typeof window !== "undefined") {
    if (role) {
      localStorage.setItem("gatesphere_active_role", role);
      document.cookie = `gs_active_role=${role}; path=/; SameSite=Lax`;
    } else {
      localStorage.removeItem("gatesphere_active_role");
      document.cookie = `gs_active_role=; path=/; max-age=0; SameSite=Lax`;
    }
  }
}

export function getCsrfToken(role?: string): string | null {
  if (typeof document === "undefined") return null;
  const cookieStr = document.cookie;
  if (!cookieStr) return null;

  const cookies: Record<string, string> = {};
  for (const c of cookieStr.split(";")) {
    const trimmed = c.trim();
    const eq = trimmed.indexOf("=");
    if (eq !== -1) {
      cookies[trimmed.slice(0, eq)] = decodeURIComponent(trimmed.slice(eq + 1));
    }
  }

  // 1. If a role is explicitly given or found in context, search for that bucket
  const targetRole = role || getActiveRole();
  if (targetRole) {
    const bucket =
      targetRole === "super_admin"
        ? "superadmin"
        : targetRole.includes("security")
          ? "security"
          : targetRole;
    if (cookies[`gatesphere_${bucket}_csrf`]) return cookies[`gatesphere_${bucket}_csrf`];
    if (cookies[`gatesphere_${targetRole}_csrf`]) return cookies[`gatesphere_${targetRole}_csrf`];
  }

  // 2. Search for any role-bucketed cookie starting with gatesphere_ and ending with _csrf
  for (const [name, val] of Object.entries(cookies)) {
    if (name.startsWith("gatesphere_") && name.endsWith("_csrf") && val) {
      return val;
    }
  }

  // 3. Fallback to legacy or generic CSRF cookies
  if (cookies["gs_csrf"]) return cookies["gs_csrf"];
  for (const [name, val] of Object.entries(cookies)) {
    if (name.endsWith("_csrf") && val) {
      return val;
    }
    if ((name === "csrf_token" || name === "csrf") && val) {
      return val;
    }
  }

  return null;
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const normalizedPath = path.startsWith("/api")
    ? path
    : `/api/v1${path.startsWith("/") ? path : `/${path}`}`;
  if (!params || Object.keys(params).length === 0) return normalizedPath;

  const hasQuery = normalizedPath.includes("?");
  const [basePath, existingQuery] = hasQuery ? normalizedPath.split("?") : [normalizedPath, ""];
  const searchParams = new URLSearchParams(existingQuery);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  if (!res.ok) {
    if (isJson) {
      const errData = await res.json().catch(() => ({}));
      const message = errData.message || errData.error?.message || `HTTP error ${res.status}`;
      const code = errData.error?.code || errData.code;
      const fields = errData.error?.fields || errData.fields;
      throw new ApiError(res.status, message, code, fields);
    }
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || `HTTP error ${res.status}`);
  }

  if (!isJson) {
    return (await res.text()) as unknown as T;
  }

  const json: ApiResponse<T> = await res.json();
  if (json && typeof json === "object" && "success" in json) {
    if (!json.success) {
      throw new ApiError(res.status, json.message || "Request failed");
    }
    return json.data;
  }

  return json as unknown as T;
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, unknown>,
  role?: string,
): Promise<T> {
  const url = buildUrl(path, params);
  const activeRole = role || getActiveRole();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (activeRole) {
    headers["X-Session-Role"] = activeRole;
  }

  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers,
  });
  return handleResponse<T>(res);
}

export async function apiSend<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, unknown>,
  role?: string,
): Promise<T> {
  const url = buildUrl(path, params);
  const activeRole = role || getActiveRole();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (activeRole) {
    headers["X-Session-Role"] = activeRole;
  }

  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
  if (isMutation) {
    const csrf = getCsrfToken(activeRole || undefined);
    if (csrf) {
      headers["X-CSRF-Token"] = csrf;
    }
  }

  let bodyPayload: BodyInit | undefined = undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyPayload = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers,
    body: bodyPayload,
  });

  return handleResponse<T>(res);
}

export async function apiList<T>(
  path: string,
  params?: Record<string, unknown>,
  role?: string,
): Promise<{ items: T[]; meta?: PaginationMeta }> {
  const url = buildUrl(path, params);
  const activeRole = role || getActiveRole();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (activeRole) {
    headers["X-Session-Role"] = activeRole;
  }

  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers,
  });

  const json: ApiResponse<T[]> = await res.json();
  if (json && typeof json === "object" && "success" in json) {
    if (!json.success) {
      throw new ApiError(res.status, json.message || "Request failed");
    }
    return {
      items: json.data || [],
      meta: json.meta,
    };
  }

  return { items: (json as unknown as T[]) || [] };
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>, role?: string) =>
    apiGet<T>(path, params, role),
  post: <T>(path: string, body?: unknown, role?: string) =>
    apiSend<T>("POST", path, body, undefined, role),
  put: <T>(path: string, body?: unknown, role?: string) =>
    apiSend<T>("PUT", path, body, undefined, role),
  patch: <T>(path: string, body?: unknown, role?: string) =>
    apiSend<T>("PATCH", path, body, undefined, role),
  delete: <T>(path: string, params?: Record<string, unknown>, role?: string) =>
    apiSend<T>("DELETE", path, undefined, params, role),
};

export const authApi = {
  login: async (email: string, password: string, role?: string) => {
    const user = await apiSend<CurrentUser>(
      "POST",
      "/auth/login",
      { email, password, role },
      undefined,
      role,
    );
    if (user?.active_role || user?.is_superadmin) {
      setActiveRole(user.active_role || (user.is_superadmin ? "super_admin" : null));
    }
    return user;
  },
  logout: async (role?: string) => {
    const activeRole = role || getActiveRole();
    try {
      await apiSend<void>("POST", "/auth/logout", undefined, undefined, activeRole || undefined);
    } finally {
      setActiveRole(null);
    }
  },
  me: (role?: string) => apiGet<CurrentUser>("/auth/me", undefined, role),
};

export const communitiesApi = {
  list: (params?: { active?: boolean }) => apiGet<Community[]>("/communities", params),
  get: (id: string) => apiGet<Community>(`/communities/${id}`),
  create: (data: Partial<Community>) => apiSend<Community>("POST", "/communities", data),
  update: (id: string, data: Partial<Community>) =>
    apiSend<Community>("PUT", `/communities/${id}`, data),
  delete: (id: string) => apiSend<void>("DELETE", `/communities/${id}`),
  towers: (communityId: string) => apiGet<Tower[]>(`/communities/${communityId}/towers`),
  gates: (communityId: string) => apiGet<Gate[]>(`/communities/${communityId}/gates`),
  createTower: (
    communityId: string,
    data: { name: string; code: string; structure_type?: string; total_floors?: number },
  ) => apiSend<Tower>("POST", `/communities/${communityId}/towers`, data),
  createFloor: (data: { tower_id: string; floor_number: number; label?: string }) =>
    apiSend<Floor>("POST", "/communities/floors", data),
  createUnit: (data: {
    floor_id: string;
    unit_number: string;
    unit_type?: string;
    bedrooms?: number;
    area_sqft?: number;
  }) => apiSend<Unit>("POST", "/communities/units", data),
  createGate: (communityId: string, data: { name: string; code: string; gate_type: string }) =>
    apiSend<Gate>("POST", `/communities/${communityId}/gates`, data),
  floors: (towerId: string) => apiGet<Floor[]>(`/communities/towers/${towerId}/floors`),
  units: (floorId: string) => apiGet<Unit[]>(`/communities/floors/${floorId}/units`),
  communityUnits: (communityId: string) => apiGet<Unit[]>(`/communities/${communityId}/units`),
};

export const dashboardsApi = {
  overview: (communityId?: string) =>
    apiGet<OverviewStats>(
      "/dashboards/overview",
      communityId ? { community_id: communityId } : undefined,
    ),
  security: (communityId?: string) =>
    apiGet<SecurityStats>(
      "/dashboards/security",
      communityId ? { community_id: communityId } : undefined,
    ),
  financial: (communityId?: string) =>
    apiGet<FinancialStats>(
      "/dashboards/financial",
      communityId ? { community_id: communityId } : undefined,
    ),
  resident: (communityId?: string) =>
    apiGet<ResidentStats>(
      "/dashboards/resident",
      communityId ? { community_id: communityId } : undefined,
    ),
};

export const assistantApi = {
  quickActions: (communityId?: string) =>
    apiGet<AssistantQuickActionsResponse>(
      "/assistant/quick-actions",
      communityId ? { community_id: communityId } : undefined,
    ),
  query: (query: string, communityId?: string) =>
    apiSend<AssistantResponse>("POST", "/assistant/query", { query, community_id: communityId }),
};

export const gateApi = {
  events: (params?: ListQueryParams) =>
    apiGet<GateEvent[]>("/gate/events", params as Record<string, unknown>),
  alerts: (params?: ListQueryParams) =>
    apiGet<PanicAlert[]>("/gate/alerts", params as Record<string, unknown>),
  rosters: (params?: ListQueryParams) =>
    apiGet<GuardRoster[]>("/gate/rosters", params as Record<string, unknown>),
  triggerEmergency: (data: {
    alert_type: string;
    severity?: string;
    gate_id?: string;
    message?: string;
  }) => apiSend<any>("POST", "/gate/alerts", data),
  verifyPass: (tokenOrPin: string) =>
    apiSend<any>("POST", "/gate/verify-pass", { token: tokenOrPin }),
  recordEntry: (data: any) =>
    apiSend<any>("POST", "/gate/events", { ...data, event_type: "entry" }),
  recordExit: (data: any) => apiSend<any>("POST", "/gate/events", { ...data, event_type: "exit" }),
  acknowledgeAlert: (alertId: string) =>
    apiSend<any>("POST", `/gate/alerts/${alertId}/acknowledge`),
  resolveAlert: (alertId: string, resolutionSummary?: string) =>
    apiSend<any>("POST", `/gate/alerts/${alertId}/resolve`, {
      resolution_summary: resolutionSummary,
    }),
  assignments: (params?: { gate_id?: string; active_only?: boolean }) =>
    apiGet<any[]>("/gate/assignments", params as Record<string, unknown>),
  createAssignment: (data: {
    guard_user_id: string;
    gate_id: string;
    roster_id?: string;
    assigned_from?: string;
    assigned_to?: string;
  }) => apiSend<any>("POST", "/gate/assignments", data),
  endAssignment: (assignmentId: string) =>
    apiSend<any>("POST", `/gate/assignments/${assignmentId}/end`),
  createRoster: (data: {
    guard_user_id: string;
    shift_date: string;
    shift_start: string;
    shift_end: string;
    notes?: string;
  }) => apiSend<any>("POST", "/gate/rosters", data),
  transitionRoster: (rosterId: string, status: string, reason?: string) =>
    apiSend<any>("POST", `/gate/rosters/${rosterId}/status`, { status, reason }),
};

export const checkpointsApi = {
  list: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>("/gate/assignments", params as Record<string, unknown>),
  override: (data: {
    gate_id: string;
    reason: string;
    reference_type?: string;
    reference_id?: string;
  }) => apiSend<Record<string, unknown>>("POST", "/gate/checkpoint-override", data),
};

export const complaintsApi = {
  tickets: (params?: ListQueryParams) =>
    apiGet<ServiceTicket[]>("/complaints/tickets", params as Record<string, unknown>),
  list: (params?: ListQueryParams) =>
    apiGet<ServiceTicket[]>("/complaints/tickets", params as Record<string, unknown>),
  categories: (communityId?: string) =>
    apiGet<ServiceCategory[]>(
      "/complaints/categories",
      communityId ? { community_id: communityId } : undefined,
    ),
  create: (data: any) => apiSend<any>("POST", "/complaints/tickets", data),
  assignVendor: (id: string, vendorName: string) =>
    apiSend<any>("POST", `/complaints/tickets/${id}/assign`, { vendor_name: vendorName }),
  updateStatus: (id: string, status: string, notes?: string) =>
    apiSend<any>("POST", `/complaints/tickets/${id}/transition`, { status, remarks: notes }),
};

export const serviceRequestsApi = complaintsApi;

export const billingApi = {
  invoices: (params?: ListQueryParams) =>
    apiGet<MaintenanceInvoice[]>("/billing/invoices", params as Record<string, unknown>),
  payments: (params?: ListQueryParams) =>
    apiGet<Payment[]>("/billing/payments", params as Record<string, unknown>),
  chargeHeads: (communityId?: string) =>
    apiGet<any[]>("/billing/charge-heads", communityId ? { community_id: communityId } : undefined),
  rules: (communityId?: string) =>
    apiGet<any>("/billing/rules", communityId ? { community_id: communityId } : undefined),
  unitLedger: (unitId: string, params?: ListQueryParams) =>
    apiGet<any[]>(`/billing/units/${unitId}/ledger`, params as Record<string, unknown>),
  exportInvoicesCsv: (params?: string | Record<string, unknown> | { community_id?: string; invoice_status?: string; status?: string }) => {
    let queryParams: Record<string, unknown> = {};
    if (typeof params === "string") {
      queryParams = { community_id: params };
    } else if (params && typeof params === "object") {
      queryParams = { ...params };
      if ("status" in queryParams && !("invoice_status" in queryParams)) {
        queryParams.invoice_status = queryParams.status;
      }
    }
    return apiGet<string>("/billing/invoices.csv", queryParams);
  },
  exportPaymentsCsv: (params?: string | Record<string, unknown> | { community_id?: string }) =>
    apiGet<string>("/billing/payments.csv", typeof params === "string" ? { community_id: params } : (params as Record<string, unknown>)),
};

export const assessmentsApi = {
  list: (params?: { community_id?: string; status?: string; page?: number; page_size?: number }) =>
    apiGet<any[]>("/billing/assessments", params as Record<string, unknown>),
  get: (id: string) => apiGet<any>(`/billing/assessments/${id}`),
  create: (payload: any, communityId?: string) =>
    apiSend<any>(
      "POST",
      "/billing/assessments",
      payload,
      communityId ? { community_id: communityId } : undefined,
    ),
  approve: (id: string, notes?: string) =>
    apiSend<any>("POST", `/billing/assessments/${id}/approve`, { notes }),
  reject: (id: string, reason?: string) =>
    apiSend<any>("POST", `/billing/assessments/${id}/reject`, { reason }),
};

export const communicationApi = {
  announcements: (params?: any) =>
    apiGet<any[]>(
      "/communication/announcements",
      typeof params === "string" ? { community_id: params } : (params as Record<string, unknown>),
    ),
  getAnnouncement: (id: string) => apiGet<any>(`/communication/announcements/${id}`),
  createAnnouncement: (data: any, communityId?: string) =>
    apiSend<any>(
      "POST",
      "/communication/announcements",
      data,
      communityId ? { community_id: communityId } : undefined,
    ),
  publishAnnouncement: (id: string) =>
    apiSend<any>("POST", `/communication/announcements/${id}/publish`),
  expireAnnouncement: (id: string) =>
    apiSend<any>("POST", `/communication/announcements/${id}/expire`),
  polls: (communityId?: string) =>
    apiGet<any[]>("/communication/polls", communityId ? { community_id: communityId } : undefined),
  pollResults: (pollId: string) => apiGet<any>(`/communication/polls/${pollId}/results`),
  createPoll: (data: any) => apiSend<any>("POST", "/communication/polls", data),
  votePoll: (pollId: string, optionId: string) =>
    apiSend<any>("POST", `/communication/polls/${pollId}/vote`, { option_id: optionId }),
  groups: (communityId?: string) =>
    apiGet<any[]>("/communication/groups", communityId ? { community_id: communityId } : undefined),
  createGroup: (data: any, communityId?: string) =>
    apiSend<any>(
      "POST",
      "/communication/groups",
      data,
      communityId ? { community_id: communityId } : undefined,
    ),
};

export const auditApi = {
  logs: (params?: AuditQueryParams) =>
    apiGet<AuditLog[]>("/audit/logs", params as Record<string, unknown>),
  exportCsv: (params?: AuditQueryParams) =>
    apiGet<string>("/audit/logs.csv", params as Record<string, unknown>),
};

export const rbacApi = {
  roles: () => apiGet<Role[]>("/rbac/roles"),
  permissions: () => apiGet<Permission[]>("/rbac/permissions"),
};

export const residentsApi = {
  list: (params?: ListQueryParams) =>
    apiGet<ResidentProfile[]>("/residents", params as Record<string, unknown>),
  get: (id: string) => apiGet<ResidentProfile>(`/residents/${id}`),
  me: () => apiGet<Record<string, unknown>>("/residents/me"),
  updateMe: (data: Record<string, unknown>) =>
    apiSend<Record<string, unknown>>("PATCH", "/residents/me", data),
  occupancies: (unitId: string) => apiGet<any[]>(`/communities/units/${unitId}/occupancies`),
  family: (unitId: string) => apiGet<any[]>("/residents/family-members", { unit_id: unitId }),
  contacts: (profileId: string) => apiGet<any[]>(`/residents/${profileId}/emergency-contacts`),
  moveRecords: (params?: {
    community_id?: string;
    move_status?: string;
    page?: number;
    page_size?: number;
  }) => apiGet<any[]>("/residents/moves", params as Record<string, unknown>),
  transitionMove: (
    moveId: string,
    data: { status: string; clearance_notes?: string; scheduled_at?: string },
  ) => apiSend<any>("PATCH", `/residents/moves/${moveId}`, data),
  create: (data: Partial<ResidentProfile>, communityId?: string) =>
    apiSend<ResidentProfile>(
      "POST",
      "/residents",
      data,
      communityId ? { community_id: communityId } : undefined,
    ),
};

export const domesticStaffApi = {
  me: () => apiGet<Record<string, unknown>>("/domestic-staff/me"),
  updateMe: (data: Record<string, unknown>) =>
    apiSend<Record<string, unknown>>("PATCH", "/domestic-staff/me", data),
  myAssignments: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>(
      "/domestic-staff/me/assignments",
      params as Record<string, unknown>,
    ),
  myAttendance: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>(
      "/domestic-staff/me/attendance",
      params as Record<string, unknown>,
    ),
  myVisits: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>(
      "/domestic-staff/me/visits",
      params as Record<string, unknown>,
    ),
  list: (params?: { community_id?: string; q?: string; page?: number; page_size?: number }) =>
    apiGet<Staff[]>("/domestic-staff", params as Record<string, unknown>),
  get: (id: string) => apiGet<Staff>(`/domestic-staff/${id}`),
  assignments: (params?: { staff_id?: string; unit_id?: string; active_only?: boolean }) =>
    apiGet<StaffAssignment[]>("/domestic-staff/assignments", params as Record<string, unknown>),
  attendance: (params?: {
    community_id?: string;
    staff_id?: string;
    open_only?: boolean;
    page?: number;
    page_size?: number;
  }) => apiGet<StaffAttendance[]>("/domestic-staff/attendance", params as Record<string, unknown>),
  create: (data: StaffCreate, communityId?: string) =>
    apiSend<Staff>(
      "POST",
      "/domestic-staff",
      data,
      communityId ? { community_id: communityId } : undefined,
    ),
  checkIn: (data: CheckInPayload | string) => {
    const payload = typeof data === "string" ? { staff_id: data } : data;
    return apiSend<any>(
      "POST",
      "/domestic-staff/attendance/check-in",
      payload as unknown as Record<string, unknown>,
    );
  },
  checkOut: (attendanceId: string) =>
    apiSend<any>("PATCH", `/domestic-staff/attendance/${attendanceId}/check-out`),
};

export const staffApi = domesticStaffApi;

export const blacklistApi = {
  list: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>("/visitors/blacklist", params as Record<string, unknown>),
  add: (data: Record<string, unknown>) =>
    apiSend<Record<string, unknown>>("POST", "/visitors/blacklist", data),
  remove: (id: string) => apiSend<void>("DELETE", `/visitors/blacklist/${id}`),
  check: (identifier: string) => apiGet<any>("/visitors/blacklist", { q: identifier }),
};

export const vendorTicketsApi = {
  list: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>("/complaints/tickets", params as Record<string, unknown>),
  get: (id: string) => apiGet<Record<string, unknown>>(`/complaints/tickets/${id}`),
  updateStatus: (id: string, status: string, notes?: string) =>
    apiSend<Record<string, unknown>>("POST", `/complaints/tickets/${id}/transition`, {
      status,
      remarks: notes,
    }),
  submitCompletion: (id: string, notes?: string) =>
    apiSend<Record<string, unknown>>("POST", `/complaints/tickets/${id}/transition`, {
      status: "resolved",
      remarks: notes,
    }),
  getEntryPass: (id: string) =>
    apiGet<Record<string, unknown>>(`/complaints/tickets/${id}/entry-pass`),
};

export const amenitiesApi = {
  list: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>("/amenities", params as Record<string, unknown>),
  bookings: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>("/amenities/bookings", params as Record<string, unknown>),
  book: (data: Record<string, unknown>) =>
    apiSend<Record<string, unknown>>("POST", "/amenities/bookings", data),
  cancelBooking: (id: string, reason?: string) =>
    apiSend<Record<string, unknown>>("POST", `/amenities/bookings/${id}/cancel`, {
      reason: reason || "User cancelled",
    }),
  blockSlot: (amenityIdOrData: any, reason?: string) =>
    typeof amenityIdOrData === "string"
      ? apiSend<any>("POST", `/amenities/${amenityIdOrData}/blocks`, { reason })
      : apiSend<any>("POST", "/amenities/blocks", amenityIdOrData),
  unblockSlot: (id: string) => apiSend<void>("DELETE", `/amenities/blocks/${id}`),
};

export const facilitiesApi = {
  list: (params?: ListQueryParams) =>
    apiGet<any[]>("/amenities", params as Record<string, unknown>),
  get: (id: string) => apiGet<any>(`/amenities/${id}`),
  create: (data: any) => apiSend<any>("POST", "/amenities", data),
  updateStatus: (id: string, status: string) =>
    apiSend<any>("PATCH", `/amenities/${id}`, { status }),
};

export const maintenanceApi = {
  list: (params?: ListQueryParams) =>
    apiGet<any[]>("/complaints/tickets", params as Record<string, unknown>),
  get: (id: string) => apiGet<any>(`/complaints/tickets/${id}`),
  assignVendor: (id: string, vendorName: string) =>
    apiSend<any>("POST", `/complaints/tickets/${id}/assign`, { vendor_name: vendorName }),
  updateStatus: (id: string, status: string, notes?: string) =>
    apiSend<any>("POST", `/complaints/tickets/${id}/transition`, { status, remarks: notes }),
};

export const vendorsApi = {
  list: (params?: ListQueryParams) =>
    apiGet<any[]>("/users", { role: "vendor_technician", ...(params as any) }),
  get: (id: string) => apiGet<any>(`/users/${id}`),
  reviewCompletion: (id: string, review: any) =>
    apiSend<any>("POST", `/users/${id}/review`, review),
};

export const visitorsApi = {
  list: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>("/visitors/entries", params as Record<string, unknown>),
  requests: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>("/visitors/requests", params as Record<string, unknown>),
  getRequest: (requestId: string) =>
    apiGet<Record<string, unknown>>(`/visitors/requests/${requestId}`),
  createRequest: (data: Record<string, unknown>) =>
    apiSend<Record<string, unknown>>("POST", "/visitors/requests", data),
  decideRequest: (requestId: string, decision: string, remarks?: string) =>
    apiSend<Record<string, unknown>>("POST", `/visitors/requests/${requestId}/decision`, {
      decision,
      remarks,
    }),
  approve: (requestId: string, remarks?: string) =>
    visitorsApi.decideRequest(requestId, "approved", remarks),
  reject: (requestId: string, remarks?: string) =>
    visitorsApi.decideRequest(requestId, "rejected", remarks),
  createPass: (requestId: string, data?: Record<string, unknown>) =>
    apiSend<Record<string, unknown>>("POST", `/visitors/requests/${requestId}/passes`, data || {}),
  entries: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>("/visitors/entries", params as Record<string, unknown>),
  // Recording an entry (by pass_token, pin, request_id, or visitor_id) IS the pass-verification step —
  // there is no separate /gate/verify-pass endpoint in the backend.
  recordEntry: (data: {
    pass_token?: string;
    pin?: string;
    request_id?: string;
    visitor_id?: string;
    gate_id?: string;
    vehicle_number?: string;
  }) => apiSend<Record<string, unknown>>("POST", "/visitors/entries", data),
  recordExit: (entryId: string) =>
    apiSend<Record<string, unknown>>("PATCH", `/visitors/entries/${entryId}/exit`),
  directory: (params?: { community_id?: string; q?: string; page_size?: number }) =>
    apiGet<Record<string, unknown>[]>("/visitors", params as Record<string, unknown>),
};

export const deliveriesApi = {
  list: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>("/deliveries", params as Record<string, unknown>),
  create: (data: Record<string, unknown>) =>
    apiSend<Record<string, unknown>>("POST", "/deliveries", data),
  protocols: () => apiGet<Record<string, unknown>[]>("/deliveries/protocols"),
  updateProtocol: (data: Record<string, unknown>) =>
    apiSend<Record<string, unknown>>("PUT", "/deliveries/protocols", data),
  recordArrival: (
    id: string,
    data?: { gate_id?: string; executive_name?: string; executive_phone?: string },
  ) => apiSend<Record<string, unknown>>("POST", `/deliveries/${id}/arrival`, data || {}),
  markDelivered: (id: string) =>
    apiSend<Record<string, unknown>>("POST", `/deliveries/${id}/delivered`),
  cancel: (id: string) => apiSend<Record<string, unknown>>("POST", `/deliveries/${id}/cancel`),
};

export const vehiclesApi = {
  list: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>("/vehicles", params as Record<string, unknown>),
  allocations: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>(
      "/vehicles/parking/allocations",
      params as Record<string, unknown>,
    ),
  violations: (params?: ListQueryParams) =>
    apiGet<Record<string, unknown>[]>(
      "/vehicles/parking/violations",
      params as Record<string, unknown>,
    ),
};

export const incidentsApi = {
  list: (params?: {
    community_id?: string;
    incident_status?: string;
    severity?: string;
    q?: string;
    page?: number;
    page_size?: number;
  }) => apiGet<Incident[]>("/incidents", params as Record<string, unknown>),
  get: (id: string) => apiGet<Incident>(`/incidents/${id}`),
  history: (id: string) => apiGet<IncidentHistory[]>(`/incidents/${id}/history`),
  actions: (id: string) => apiGet<IncidentAction[]>(`/incidents/${id}/actions`),
  create: (data: IncidentCreate) => apiSend<Incident>("POST", "/incidents", data),
  transition: (id: string, payload: IncidentTransition) =>
    apiSend<Incident>("POST", `/incidents/${id}/transition`, payload),
  addAction: (id: string, payload: { action_type: string; details?: string }) =>
    apiSend<IncidentAction>("POST", `/incidents/${id}/actions`, payload),
  resolve: (id: string, data: Record<string, unknown>) =>
    apiSend<Incident>("PATCH", `/incidents/${id}/resolve`, data),
};

export const notificationsApi = {
  list: (params?: { unread_only?: boolean; page?: number; page_size?: number }) =>
    apiGet<AppNotification[]>("/notifications", params as Record<string, unknown>),
  markRead: (id: string) => apiSend<void>("PATCH", `/notifications/${id}/read`),
  markAllRead: () => apiSend<void>("POST", "/notifications/mark-all-read"),
  preferences: () => apiGet<NotificationPreference[]>("/notifications/preferences"),
  setPreference: (data: Partial<NotificationPreference>) =>
    apiSend<NotificationPreference>("PUT", "/notifications/preferences", data),
};
