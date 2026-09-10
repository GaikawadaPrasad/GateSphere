"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-auth";
import { useUiStore } from "@/store/ui";

interface AssociationCommitteeScopeGuardProps {
  children: ReactNode;
}

export function AssociationCommitteeScopeGuard({ children }: AssociationCommitteeScopeGuardProps) {
  const router = useRouter();
  const { data: user, isLoading: authLoading } = useMe();
  const { activeCommunityId, setActiveCommunity } = useUiStore();

  const assignedCommunityId =
    user?.community_ids?.[0] ||
    user?.roles?.find((r) => r.role_slug === "association_committee")?.community_id ||
    null;

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // Role check: must have association_committee role or be super_admin
    const isCommittee =
      user.is_superadmin ||
      user.active_role === "association_committee" ||
      user.roles?.some((r) => r.role_slug === "association_committee") ||
      // Fallback permission-based detection
      (!user.is_superadmin &&
        user.community_ids?.length > 0 &&
        user.permissions?.includes("billing:approve") &&
        user.permissions?.includes("incidents:view"));

    if (!isCommittee) {
      router.replace("/unauthorized");
      return;
    }

    // Lock UI store to assigned community scope
    if (assignedCommunityId && activeCommunityId !== assignedCommunityId) {
      setActiveCommunity(assignedCommunityId);
    }
  }, [user, authLoading, assignedCommunityId, activeCommunityId, setActiveCommunity, router]);

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
          gap: "1rem",
        }}
      >
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
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏛️</div>
          <h2>No Assigned Governance Scope</h2>
          <p style={{ marginTop: "0.5rem", color: "var(--muted)" }}>
            Your account is not currently assigned to a residential community committee. Please
            contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
