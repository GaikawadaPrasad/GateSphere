import { create } from "zustand";

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

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  activeCommunityId: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveCommunity: (id) => set({ activeCommunityId: id }),
}));
