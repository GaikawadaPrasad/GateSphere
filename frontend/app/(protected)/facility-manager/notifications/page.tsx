"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Pagination } from "@/components/tables/Pagination";
import { notificationsApi, type NotificationItem } from "@/lib/api";

export default function FacilityManagerNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    setLoadError(null);
    try {
      const data = await notificationsApi.list({
        ...(unreadOnly ? { unread_only: true } : {}),
        page: 1,
        page_size: 100,
      });
      setNotifications(data || []);
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load notifications.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadData(true);
  }, [unreadOnly]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadData(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [unreadOnly]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (err: any) {
      alert(err?.message || "Failed to mark as read.");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err: any) {
      alert(err?.message || "Failed to mark all as read.");
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n: any) => {
      if (categoryFilter === "all") return true;
      if (n.category === categoryFilter) return true;
      const type = (n.notification_type || "").toLowerCase();
      const ref = (n.reference_type || "").toLowerCase();
      if (categoryFilter === "amenity" && (type.includes("amenity") || ref.includes("amenity"))) return true;
      if (categoryFilter === "incident" && (type.includes("incident") || ref.includes("incident"))) return true;
      if (categoryFilter === "ticket" && (type.includes("ticket") || type.includes("complaint") || ref.includes("ticket"))) return true;
      if (categoryFilter === "billing" && (type.includes("billing") || type.includes("invoice") || ref.includes("billing"))) return true;
      if (categoryFilter === "system" && type.includes("system")) return true;
      return false;
    });
  }, [notifications, categoryFilter]);

  const paginatedNotifications = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredNotifications.slice(start, start + pageSize);
  }, [filteredNotifications, page, pageSize]);

  return (
    <div>
      <PageHeader
        title="Notifications & System Alerts"
        subtitle="Operational notifications for maintenance, vendors, service tickets, and emergency alerts"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Facility Manager" },
          { label: "Notifications" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <select
              className="select-field"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ height: 36, width: "auto" }}
            >
              <option value="all">All Categories</option>
              <option value="ticket">Tickets</option>
              <option value="incident">Incidents</option>
              <option value="amenity">Amenity</option>
              <option value="system">System</option>
              <option value="billing">Billing</option>
            </select>
            <button
              className={`btn ${unreadOnly ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setUnreadOnly((v) => !v)}
            >
              {unreadOnly ? "● Unread Only" : "All Notifications"}
            </button>
            <button className="btn btn-secondary" onClick={handleMarkAllRead}>
              ✓ Mark All as Read
            </button>
          </div>
        }
      />

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="card-title">Inbox Notifications</h3>
          <span style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
            {filteredNotifications.length} total
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {isLoading ? (
            <div style={{ padding: "2rem", textAlign: "center" }}>Loading notifications…</div>
          ) : loadError ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--danger, #dc2626)" }}>
              {loadError}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              No notifications in inbox.
            </div>
          ) : (
            <>
              {paginatedNotifications.map((n: any) => (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    borderRadius: "var(--radius-sm)",
                    background: n.is_read ? "white" : "var(--primary-light)",
                    border: n.is_read ? "1px solid var(--border)" : "1px solid #bfdbfe",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <StatusBadge status={n.category || n.notification_type || "system"} />
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--fg)", fontSize: "0.9rem" }}>
                        {n.title}{" "}
                        {!n.is_read && <span style={{ color: "var(--primary)" }}>●</span>}
                      </div>
                      <div
                        style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.2rem" }}
                      >
                        {n.body || n.message} ·{" "}
                        <span style={{ fontStyle: "italic" }}>
                          {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!n.is_read && (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                      onClick={() => handleMarkRead(n.id)}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))}

              {filteredNotifications.length > 0 && (
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={filteredNotifications.length}
                  onPageChange={setPage}
                  onPageSizeChange={(sz) => {
                    setPageSize(sz);
                    setPage(1);
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

