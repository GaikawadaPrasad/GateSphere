"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Skeleton } from "@/components/common/LoadingSkeleton";
import { formatDate } from "@/lib/utils";
import { communitiesApi } from "@/lib/api";
import type { Tower, Gate } from "@/types/communities";
import type { CommunityWithMetrics } from "@/components/tables/CommunityTable";

interface ViewCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  community: CommunityWithMetrics | null;
}

export function ViewCommunityModal({
  isOpen,
  onClose,
  community,
}: ViewCommunityModalProps) {
  const [communityTowers, setCommunityTowers] = useState<Tower[]>([]);
  const [communityGates, setCommunityGates] = useState<Gate[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (isOpen && community) {
      setIsLoadingDetails(true);
      setCommunityTowers([]);
      setCommunityGates([]);

      Promise.allSettled([
        communitiesApi.towers(community.id),
        communitiesApi.gates(community.id),
      ])
        .then(([towersRes, gatesRes]) => {
          if (towersRes.status === "fulfilled") setCommunityTowers(towersRes.value || []);
          if (gatesRes.status === "fulfilled") setCommunityGates(gatesRes.value || []);
        })
        .catch((err) => {
          console.error("Failed to load community details", err);
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    }
  }, [isOpen, community]);

  if (!community) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Community Details: ${community.name}`}
      maxWidth={620}
      footer={
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
        >
          Close
        </button>
      }
    >
      <div>
        {/* Quick Stats Summary Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "0.85rem",
            padding: "1rem",
            background: "#f8fafc",
            borderRadius: "var(--radius)",
            marginBottom: "1.25rem",
            border: "1px solid var(--border)",
          }}
        >
          <div>
            <span style={{ fontSize: "0.725rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Code</span>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--fg)" }}>{community.code}</div>
          </div>
          <div>
            <span style={{ fontSize: "0.725rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Location</span>
            <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--fg)" }}>
              {[community.city, community.state].filter(Boolean).join(", ") || "–"}
            </div>
          </div>
          <div>
            <span style={{ fontSize: "0.725rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Status</span>
            <div style={{ marginTop: "0.15rem" }}>
              <StatusBadge status={community.is_active} />
            </div>
          </div>
          <div>
            <span style={{ fontSize: "0.725rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Created</span>
            <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--fg)" }}>
              {formatDate(community.created_at)}
            </div>
          </div>
        </div>

        {/* Structure Breakdown: Towers & Gates with Skeleton fallback */}
        {isLoadingDetails ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "1rem" }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0.85rem" }}>
              <Skeleton width="45%" height="1.1rem" borderRadius={4} style={{ marginBottom: "0.75rem" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <Skeleton height="1.8rem" borderRadius={4} />
                <Skeleton height="1.8rem" borderRadius={4} />
              </div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0.85rem" }}>
              <Skeleton width="45%" height="1.1rem" borderRadius={4} style={{ marginBottom: "0.75rem" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <Skeleton height="1.8rem" borderRadius={4} />
                <Skeleton height="1.8rem" borderRadius={4} />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "1rem" }}>
            {/* Towers List */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "0.85rem",
                background: "#ffffff",
              }}
            >
              <h4
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "0.6rem",
                  color: "var(--fg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>🏢 Towers ({communityTowers.length})</span>
              </h4>
              {communityTowers.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 220, overflowY: "auto" }}>
                  {communityTowers.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.8rem",
                        padding: "0.35rem 0.55rem",
                        background: "#f1f5f9",
                        borderRadius: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{t.name}</span>
                      <span style={{ color: "var(--muted)" }}>{t.total_floors} Floors</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>
                  No towers added yet
                </p>
              )}
            </div>

            {/* Gates List */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "0.85rem",
                background: "#ffffff",
              }}
            >
              <h4
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "0.6rem",
                  color: "var(--fg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>🛡️ Gates ({communityGates.length})</span>
              </h4>
              {communityGates.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 220, overflowY: "auto" }}>
                  {communityGates.map((g) => (
                    <div
                      key={g.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.8rem",
                        padding: "0.35rem 0.55rem",
                        background: "#f1f5f9",
                        borderRadius: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{g.name}</span>
                      <span style={{ color: "var(--muted)", textTransform: "capitalize" }}>
                        {g.gate_type}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>
                  No gates configured
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
