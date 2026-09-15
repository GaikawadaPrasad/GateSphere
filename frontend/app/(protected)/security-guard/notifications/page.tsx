"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { notificationsApi, type NotificationItem } from "@/lib/api";

export default function SecurityGuardNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await notificationsApi.list();
      setNotifications(data || []);
    } catch {
      setNotifications([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkRead = async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Gate Notifications & Approval Updates"
        subtitle="Real-time alerts, resident approvals, and supervisor broadcasts"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Guard" },
          { label: "Notifications" },
        ]}
      />

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Gate Console Inbox</h3>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.5rem" }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="card"
                  style={{
                    padding: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", gap: "1rem", alignItems: "center", width: "80%" }}>
                    <div className="skeleton" style={{ width: 60, height: 24, borderRadius: "var(--radius-sm)" }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton" style={{ width: "40%", height: 16, marginBottom: "0.4rem" }} />
                      <div className="skeleton" style={{ width: "70%", height: 12 }} />
                    </div>
                  </div>
                  <div className="skeleton" style={{ width: 80, height: 28, borderRadius: "var(--radius-sm)" }} />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              title="No Notifications"
              description="Your gate console inbox has no unread broadcasts or alerts."
              icon="🔔"
            />
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem",
                  borderRadius: "var(--radius-sm)",
                  background: n.read ? "white" : "var(--primary-light)",
                  border: n.read ? "1px solid var(--border)" : "1px solid #bfdbfe",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <StatusBadge status={n.type || "Info"} />
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--fg)", fontSize: "0.9rem" }}>
                      {n.title} {!n.read && <span style={{ color: "var(--primary)" }}>●</span>}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                      {n.message} · <span style={{ fontStyle: "italic" }}>{n.timestamp}</span>
                    </div>
                  </div>
                </div>

                {!n.read && (
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                    onClick={() => handleMarkRead(n.id)}
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
