"use client";

import { useState } from "react";
import {
  useMyNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/use-notifications";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import type { AppNotification } from "@/types/notifications";
import { formatDateTime } from "@/lib/utils";

export default function CommunityAdminNotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);

  // Queries
  const {
    data: notifications,
    isLoading,
    refetch,
  } = useMyNotifications({
    unread_only: unreadOnly,
    page_size: 50,
  });

  // Mutations
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkRead = async (n: AppNotification) => {
    setSelectedNotification(n);
    if (!n.is_read) {
      try {
        await markRead.mutateAsync(n.id);
        refetch();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead.mutateAsync();
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "emergency":
        return "🚨";
      case "announcement":
        return "📢";
      case "visitor":
        return "🛡️";
      case "billing":
        return "💳";
      case "complaint":
        return "🎫";
      default:
        return "🔔";
    }
  };

  // Columns
  const columns: Column<AppNotification>[] = [
    {
      key: "title",
      header: "Notification",
      render: (n) => (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.2rem" }}>{getCategoryIcon(n.category)}</span>
          <div>
            <div style={{ fontWeight: n.is_read ? 500 : 700, color: "var(--fg)" }}>
              {n.title}
              {!n.is_read && (
                <span
                  style={{
                    marginLeft: "0.5rem",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#ef4444",
                    display: "inline-block",
                  }}
                />
              )}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 380,
              }}
            >
              {n.body}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (n) => (
        <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>
          {n.category}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Received",
      render: (n) => formatDateTime(n.created_at),
    },
    {
      key: "actions",
      header: "Action",
      render: (n) => (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
          onClick={(e) => {
            e.stopPropagation();
            handleMarkRead(n);
          }}
        >
          View Details →
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <PageHeader
        title="Notification Center"
        description="Administrative alerts, security notifications, visitor approvals, and maintenance updates."
        action={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleMarkAll}
              disabled={markAllRead.isPending}
            >
              ✓ Mark All Read
            </button>
          </div>
        }
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className={`btn ${!unreadOnly ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
            onClick={() => setUnreadOnly(false)}
          >
            All Notifications
          </button>
          <button
            type="button"
            className={`btn ${unreadOnly ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
            onClick={() => setUnreadOnly(true)}
          >
            Unread Only
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={notifications as (AppNotification & Record<string, unknown>)[]}
        isLoading={isLoading}
        onRowClick={handleMarkRead}
        emptyTitle="No notifications"
        emptyDescription="You are completely caught up! No notifications to display."
      />

      {/* Notification Details Modal */}
      <Modal
        isOpen={Boolean(selectedNotification)}
        onClose={() => setSelectedNotification(null)}
        title={
          selectedNotification
            ? `${getCategoryIcon(selectedNotification.category)} ${selectedNotification.title}`
            : "Notification Details"
        }
      >
        {selectedNotification && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Received: {formatDateTime(selectedNotification.created_at)}
            </div>

            <div
              style={{
                background: "#f8fafc",
                padding: "1rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                fontSize: "0.9rem",
                lineHeight: 1.6,
                color: "var(--fg)",
              }}
            >
              {selectedNotification.body}
            </div>

            {selectedNotification.action_url && (
              <div style={{ marginTop: "0.5rem" }}>
                <a
                  href={selectedNotification.action_url}
                  className="btn btn-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Go to Action Link →
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
