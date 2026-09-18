export interface AuditLog {
  id: string;
  community_id: string | null;
  community_name?: string | null;
  community_code?: string | null;
  user_id: string | null;
  user_name?: string | null;
  user_email?: string | null;
  session_id?: string | null;
  role_slug?: string | null;
  module: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  changes?: Record<string, { old: unknown; new: unknown }>;
  created_at: string;
}

export interface AuditQueryParams {
  module?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  community_id?: string;
  since?: string;
  until?: string;
  page?: number;
  page_size?: number;
}
