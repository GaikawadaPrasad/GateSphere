"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { notificationsApi, type NotificationItem } from "@/lib/api";

export default function SecuritySupervisorNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await notificationsApi.list(unreadOnly ? { unread_only: true } : undefined);
      setNotifications(data || []);
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load notifications.");
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [unreadOnly]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read: true } : n)),
      );
    } catch (err: any) {
      alert(err?.message || "Failed to mark as read.");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read: true })));
    } catch (err: any) {
      alert(err?.message || "Failed to mark all as read.");
    }
  };

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Security Supervisor Alerts & Notifications"
        subtitle="Gate incidents, guard roster alerts, blacklisted visitor detections, and broadcasts"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Notifications" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              className={`btn ${unreadOnly ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setUnreadOnly((v) => !v)}
            >
              {unreadOnly ? "● Unread Only" : "All Notifications"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleMarkAllRead}
              disabled={isLoading || notifications.length === 0}
            >
              ✓ Mark All Read
            </button>
            <button className="btn btn-secondary" onClick={loadData} disabled={isLoading}>
              🔄 {isLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        }
      />

      {loadError && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-sm)",
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fecaca",
            fontSize: "0.875rem",
          }}
        >
          {loadError}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Supervisor Inbox</h3>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {isLoading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                padding: "0.5rem",
              }}
            >
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
                    <div
                      className="skeleton"
                      style={{ width: 60, height: 24, borderRadius: "var(--radius-sm)" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        className="skeleton"
                        style={{ width: "40%", height: 16, marginBottom: "0.4rem" }}
                      />
                      <div className="skeleton" style={{ width: "70%", height: 12 }} />
                    </div>
                  </div>
                  <div
                    className="skeleton"
                    style={{ width: 80, height: 28, borderRadius: "var(--radius-sm)" }}
                  />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              title="No Notifications"
              description="Your supervisor console inbox has no unread broadcasts or alerts."
              icon="🔔"
            />
          ) : (
            notifications.map((n: any) => {
              const isRead = Boolean(n.is_read || n.read);
              const title = n.title || "Notification";
              const message = n.body || n.message || "";
              const timestamp = n.created_at
                ? new Date(n.created_at).toLocaleString()
                : n.timestamp || "";

              return (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    borderRadius: "var(--radius-sm)",
                    background: isRead ? "white" : "var(--primary-light)",
                    border: isRead ? "1px solid var(--border)" : "1px solid #bfdbfe",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <StatusBadge status={n.category || n.notification_type || n.type || "Info"} />
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--fg)", fontSize: "0.9rem" }}>
                        {title} {!isRead && <span style={{ color: "var(--primary)" }}>●</span>}
                      </div>
                      <div
                        style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.2rem" }}
                      >
                        {message}{" "}
                        {timestamp && (
                          <>
                            · <span style={{ fontStyle: "italic" }}>{timestamp}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isRead && (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                      onClick={() => handleMarkRead(n.id)}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
