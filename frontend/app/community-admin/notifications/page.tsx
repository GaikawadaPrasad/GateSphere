"use client";

import { useState } from "react";
import {
  useMyNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDispatchNotification,
} from "@/hooks/use-notifications";
import { useUiStore } from "@/store/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import type { AppNotification } from "@/types/notifications";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/store/toast";

export default function CommunityAdminNotificationsPage() {
  const { activeCommunityId } = useUiStore();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);

  // Dispatch alert modal state
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    title: "",
    body: "",
    category: "announcement",
    action_url: "",
  });
  const [isDispatching, setIsDispatching] = useState(false);

  // Queries
  const {
    data: notifications,
    isLoading,
    isError,
    refetch,
  } = useMyNotifications({
    unread_only: unreadOnly,
    page_size: 50,
  });

  // Mutations
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const dispatchNotification = useDispatchNotification();

  const handleMarkRead = async (n: AppNotification) => {
    setSelectedNotification(n);
    if (!n.is_read) {
      try {
        await markRead.mutateAsync(n.id);
        toast.success("Notification marked as read.", "Read");
        refetch();
      } catch (err: unknown) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Failed to mark as read", "Error");
      }
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead.mutateAsync();
      toast.success("All notifications marked as read.", "Caught Up");
      refetch();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to mark all read", "Error");
    }
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) {
      toast.error("No active community selected.", "Error");
      return;
    }
    if (!dispatchForm.title.trim() || !dispatchForm.body.trim()) {
      toast.error("Please fill in both title and message.", "Validation Error");
      return;
    }

    try {
      setIsDispatching(true);
      await dispatchNotification.mutateAsync({
        community_id: activeCommunityId,
        title: dispatchForm.title.trim(),
        body: dispatchForm.body.trim(),
        category: dispatchForm.category,
        action_url: dispatchForm.action_url.trim() || undefined,
      });
      toast.success("Administrative alert dispatched successfully.", "Alert Dispatched");
      setIsDispatchOpen(false);
      setDispatchForm({
        title: "",
        body: "",
        category: "announcement",
        action_url: "",
      });
      refetch();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to dispatch alert", "Error");
    } finally {
      setIsDispatching(false);
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
              {n.body || n.message || "Notification alert"}
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
          {(n.category || (n as any).notification_type || "System")?.replace("_", " ")}
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
              className="btn btn-primary"
              onClick={() => setIsDispatchOpen(true)}
            >
              📢 Dispatch Alert
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleMarkAll}
              disabled={markAllRead.isPending}
            >
              ✓ Mark All Read
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => refetch()}
              title="Refresh Notifications"
            >
              🔄
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
            ? `${getCategoryIcon(selectedNotification.category || (selectedNotification as any).notification_type || "")} ${selectedNotification.title}`
            : "Notification Details"
        }
      >
        {selectedNotification && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.75rem",
                color: "var(--muted)",
              }}
            >
              <span>Received: {formatDateTime(selectedNotification.created_at)}</span>
              <span
                className="badge badge-neutral"
                style={{ textTransform: "capitalize", fontSize: "0.7rem" }}
              >
                {(selectedNotification.category ||
                  (selectedNotification as any).notification_type ||
                  "System")?.replace("_", " ")}
              </span>
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
              {selectedNotification.body ||
                selectedNotification.message ||
                "No additional details provided."}
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

      {/* Dispatch Community Notification Modal */}
      <Modal
        isOpen={isDispatchOpen}
        onClose={() => setIsDispatchOpen(false)}
        title="📢 Dispatch Administrative Alert"
      >
        <form
          onSubmit={handleDispatch}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Alert / Notification Title
            </label>
            <input
              type="text"
              className="input-field"
              required
              placeholder="e.g. Scheduled Water Maintenance / Security Alert"
              value={dispatchForm.title}
              onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value })}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Category
              </label>
              <select
                className="select-field"
                value={dispatchForm.category}
                onChange={(e) => setDispatchForm({ ...dispatchForm, category: e.target.value })}
              >
                <option value="announcement">📢 Announcement</option>
                <option value="emergency">🚨 Emergency</option>
                <option value="visitor">🛡️ Security / Gate</option>
                <option value="billing">💳 Billing &amp; Finance</option>
                <option value="complaint">🎫 Maintenance</option>
                <option value="general">🔔 General Alert</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Action Link (Optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. /community-admin/communication"
                value={dispatchForm.action_url}
                onChange={(e) => setDispatchForm({ ...dispatchForm, action_url: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Notification Message
            </label>
            <textarea
              className="input-field"
              rows={4}
              required
              placeholder="Write the complete notification message..."
              value={dispatchForm.body}
              onChange={(e) => setDispatchForm({ ...dispatchForm, body: e.target.value })}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
              marginTop: "1rem",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsDispatchOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isDispatching}>
              {isDispatching ? "Dispatching…" : "Dispatch Notification"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
