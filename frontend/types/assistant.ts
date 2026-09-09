export interface AssistantAction {
  label: string;
  url: string;
  action_type: "navigate" | "action";
  /** Present when action_type is "action" — re-ask the assistant this instead of navigating. */
  query?: string | null;
}

export interface AssistantQuickChip {
  id: string;
  icon: string;
  label: string;
  query: string;
}

export interface AssistantResponse {
  reply_text: string;
  category: string;
  actions: AssistantAction[];
  related_faqs: string[];
}

export interface AssistantQuickActionsResponse {
  community_id: string;
  greeting: string;
  chips: AssistantQuickChip[];
  suggested_queries: string[];
}
