export type NotificationChannel = "in_app" | "email" | "sms" | "whatsapp" | "push";

export interface AppNotification {
  id: string;
  created_at: string;
  user_id: string;
  community_id?: string | null;
  title: string;
  body: string;
  category: "visitor" | "delivery" | "billing" | "complaint" | "amenity" | "announcement" | "emergency" | "system";
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  metadata_json?: Record<string, unknown> | null;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  event_category: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
}

export interface NotificationTemplate {
  id: string;
  event_key: string;
  channel: NotificationChannel;
  title_template: string;
  body_template: string;
  is_active: boolean;
}
