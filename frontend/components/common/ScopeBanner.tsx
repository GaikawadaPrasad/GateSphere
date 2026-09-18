"use client";

import React, { useMemo } from "react";
import { useUiStore } from "@/store/ui";
import { useCommunities } from "@/hooks/use-communities";
import type { Community } from "@/types/communities";

interface ScopeBannerProps {
  entityName?: string;
  onClear?: () => void;
}

export function ScopeBanner({ entityName = "data", onClear }: ScopeBannerProps) {
  const { activeCommunityId, setActiveCommunity } = useUiStore();
  const { data: communities } = useCommunities();

  const activeCommunity = useMemo(
    () => communities?.find((c: Community) => c.id === activeCommunityId),
    [communities, activeCommunityId]
  );

  if (!activeCommunityId || !activeCommunity) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1.25rem",
        borderRadius: "var(--radius)",
        background: "linear-gradient(90deg, #EFF6FF 0%, #DBEAFE 100%)",
        border: "1px solid #BFDBFE",
        color: "#1E40AF",
        marginBottom: "1.5rem",
        gap: "1rem",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span style={{ fontSize: "1.2rem" }}>🏢</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>
            Scope Active: Viewing {entityName} for {activeCommunity.name} ({activeCommunity.code})
          </div>
          <div style={{ fontSize: "0.75rem", opacity: 0.85 }}>
            {activeCommunity.city ? `${activeCommunity.city}, ` : ""}
            {activeCommunity.state || "India"} · Super Admin Scope Filter Applied
          </div>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          setActiveCommunity(null);
          onClear?.();
        }}
        style={{
          fontSize: "0.75rem",
          padding: "0.3rem 0.75rem",
          background: "#FFFFFF",
          border: "1px solid #BFDBFE",
          color: "#1E40AF",
          fontWeight: 600,
        }}
      >
        🌐 Clear Scope (View All Communities)
      </button>
    </div>
  );
}
