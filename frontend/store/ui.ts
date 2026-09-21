import { create } from "zustand";
import { clearQueryCache } from "@/lib/query";

/**
 * Client/UI state only (AGENTS.md §5.3). Never put server data or session
 * secrets here — server data lives in TanStack Query.
 */
interface UiState {
  sidebarOpen: boolean;
  activeCommunityId: string | null;
  toggleSidebar: () => void;
  setActiveCommunity: (id: string | null) => void;
}

const isMobileInitial = typeof window !== "undefined" && window.innerWidth < 768;

export const useUiStore = create<UiState>((set, get) => ({
  sidebarOpen: !isMobileInitial,
  activeCommunityId: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveCommunity: (id) => {
    const current = get().activeCommunityId;
    if (current !== id) {
      // AGENTS.md §5.3: a community switch is an identity-changing mutation.
      // Clear TanStack Query cache so Tenant A data never leaks to Tenant B.
      clearQueryCache();
      set({ activeCommunityId: id });
    }
  },
}));
