export type AnnouncementPriority = "low" | "normal" | "urgent" | "emergency";
export type AnnouncementType = "notice" | "event" | "emergency" | "maintenance" | "poll";
export type TargetAudienceType = "all" | "tower" | "resident_group" | "unit";

/** Matches backend TargetIn schema */
export interface AnnouncementTarget {
  tower_id?: string | null;
  unit_id?: string | null;
  role_id?: string | null;
  resident_group_id?: string | null;
  target_all_community?: boolean;
}

export interface Announcement {
  id: string;
  created_at: string;
  updated_at: string;
  community_id: string;
  created_by_user_id?: string | null;
  announcement_type: AnnouncementType;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  publish_at?: string | null;
  expires_at?: string | null;
  event_start_at?: string | null;
  event_end_at?: string | null;
  is_published: boolean;
  published_at?: string | null;
  targets: AnnouncementTarget[];
}

/** Matches backend AnnouncementCreate schema exactly — extra="forbid" */
export interface AnnouncementCreate {
  announcement_type?: AnnouncementType;
  title: string;
  body: string;
  priority?: AnnouncementPriority;
  publish_at?: string | null;
  expires_at?: string | null;
  event_start_at?: string | null;
  event_end_at?: string | null;
  targets?: AnnouncementTarget[];
}

export interface PollOption {
  id: string;
  text: string;
  votes_count?: number;
}

export interface Poll {
  id: string;
  created_at: string;
  community_id: string;
  question: string;
  description?: string | null;
  status: "active" | "closed" | "draft";
  options: PollOption[];
  expires_at?: string | null;
  total_votes?: number;
}

export interface PollResults {
  poll_id: string;
  question: string;
  status: string;
  total_votes: number;
  options: {
    id: string;
    text: string;
    vote_count: number;
    percentage: number;
  }[];
}

export interface ResidentGroup {
  id: string;
  created_at: string;
  community_id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  member_count: number;
}
