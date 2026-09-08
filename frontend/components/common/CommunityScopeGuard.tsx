"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-auth";
import { useUiStore } from "@/store/ui";
import { useCommunityDetails } from "@/hooks/use-communities";

interface CommunityScopeGuardProps {
  children: ReactNode;
}

export function CommunityScopeGuard({ children }: CommunityScopeGuardProps) {
  const router = useRouter();
  const { data: user, isLoading: authLoading } = useMe();
  const { activeCommunityId, setActiveCommunity } = useUiStore();

  const assignedCommunityId = user?.community_ids?.[0] || user?.roles?.find((r) => r.role_slug === "community_admin")?.community_id || null;

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // Role check: must have community_admin role or be super_admin.
    // active_role is always returned by the session — use it as the primary signal.
    const isCommAdmin =
      user.is_superadmin ||
      user.active_role === "community_admin" ||
      user.roles?.some((r) => r.role_slug === "community_admin") ||
      // Fallback: permission-based detection when active_role/roles not available
      (!user.is_superadmin &&
        user.community_ids?.length > 0 &&
        user.permissions?.includes("communities:update"));

    if (!isCommAdmin) {
      router.replace("/unauthorized");
      return;
    }

    // Lock UI store to assigned community scope
    if (assignedCommunityId && activeCommunityId !== assignedCommunityId) {
      setActiveCommunity(assignedCommunityId);
    }
  }, [user, authLoading, assignedCommunityId, activeCommunityId, setActiveCommunity, router]);

  const { isLoading: communityLoading } = useCommunityDetails(assignedCommunityId || undefined);

  if (authLoading || (assignedCommunityId && communityLoading)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "60vh", gap: "1rem" }}>
        <div className="skeleton" style={{ width: 220, height: 28, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: 340, height: 16, borderRadius: 6 }} />
      </div>
    );
  }

  if (!user) return null;

  if (!assignedCommunityId && !user.is_superadmin) {
    return (
      <div className="page-body" style={{ maxWidth: 600, marginTop: "4rem" }}>
        <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏢</div>
          <h2>No Assigned Community</h2>
          <p style={{ marginTop: "0.5rem", color: "var(--muted)" }}>
            Your account does not currently have an assigned residential community scope. Please contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
