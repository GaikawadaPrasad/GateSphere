"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { notificationsApi, type NotificationItem } from "@/lib/api";

export default function FacilityManagerNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const data = await notificationsApi.list();
    setNotifications(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkRead = async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div>
      <PageHeader
        title="Notifications & System Alerts"
        subtitle="Operational notifications for maintenance, vendors, service tickets, and emergency alerts"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Facility Manager" }, { label: "Notifications" }]}
        actions={
          <button className="btn btn-secondary" onClick={handleMarkAllRead}>
            ✓ Mark All as Read
          </button>
        }
      />

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Inbox Notifications</h3>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {isLoading ? (
            <div style={{ padding: "2rem", textAlign: "center" }}>Loading notifications…</div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              No notifications in inbox.
            </div>
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
