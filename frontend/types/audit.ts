export interface AuditLog {
  id: string;
  community_id: string | null;
  community_name?: string;
  user_id: string | null;
  user_name?: string;
  user_email?: string;
  module: string;
  action: string;
  entity_type: string;
  entity_id: string;
  ip_address?: string;
  user_agent?: string;
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
