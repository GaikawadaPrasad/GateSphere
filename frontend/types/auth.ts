export type RoleSlug =
  | "super_admin"
  | "community_admin"
  | "association_committee"
  | "facility_manager"
  | "security_supervisor"
  | "security_guard"
  | "resident"
  | "domestic_staff"
  | "vendor_technician"
  | "auditor";

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  is_superadmin: boolean;
  permissions: string[];
  permission_version: number;
  community_ids: string[];
  roles?: {
    id: string;
    role_slug: RoleSlug;
    community_id: string | null;
  }[];
}

export interface UserSummary {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  is_superadmin: boolean;
  created_at: string;
}
