"use client";

import { useState, useMemo } from "react";
import {
  useMyNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDispatchNotification,
} from "@/hooks/use-notifications";
import { useMe } from "@/hooks/use-auth";
import { useUiStore } from "@/store/ui";
import { useResidents } from "@/hooks/use-residents";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import { toast } from "@/store/toast";
import type { AppNotification } from "@/types/notifications";
import { formatDateTime } from "@/lib/utils";

export default function CommunityAdminNotificationsPage() {
  const { activeCommunityId } = useUiStore();
  const { data: currentUser } = useMe();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);

  // Dispatch notification modal state
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    recipient_user_id: "",
    notification_type: "announcement",
    title: "",
    message: "",
  });
  const [isSending, setIsSending] = useState(false);

  // Queries
  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useMyNotifications({
    unread_only: unreadOnly,
    page_size: 50,
  });

  const { data: residentsData } = useResidents({
    community_id: activeCommunityId || undefined,
    page_size: 100,
  });

  const residentsList = useMemo(() => {
    if (!residentsData) return [];
    if (Array.isArray(residentsData)) return residentsData;
    if (Array.isArray((residentsData as any)?.data)) return (residentsData as any).data;
    if (Array.isArray((residentsData as any)?.items)) return (residentsData as any).items;
    return [];
  }, [residentsData]);

  // Mutations
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const dispatchMutation = useDispatchNotification();

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
      toast.success("All notifications marked as read.", "Inbox Updated");
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendTestNotification = async () => {
    if (!currentUser?.id) return;
    try {
      await dispatchMutation.mutateAsync({
        recipient_user_id: currentUser.id,
        notification_type: "security_alert",
        title: "🛡️ Gate Activity Alert: Security System Active",
        message: "Automated test alert: Gate checkpoint systems and visitor verification logs are operating normally.",
        community_id: activeCommunityId || undefined,
        channels: ["in_app"],
      });
      toast.success("Test notification dispatched to your inbox!", "Notification Sent");
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch test notification", "Error");
    }
  };

  const handleDispatchNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipientId = dispatchForm.recipient_user_id || currentUser?.id;
    if (!recipientId) {
      toast.error("Please select a recipient.");
      return;
    }
    if (!dispatchForm.title.trim() || !dispatchForm.message.trim()) {
      toast.error("Title and message are required.");
      return;
    }

    try {
      setIsSending(true);
      await dispatchMutation.mutateAsync({
        recipient_user_id: recipientId,
        notification_type: dispatchForm.notification_type,
        title: dispatchForm.title.trim(),
        message: dispatchForm.message.trim(),
        community_id: activeCommunityId || undefined,
        channels: ["in_app"],
      });
      toast.success("Notification delivered successfully!", "Dispatched");
      setIsDispatchModalOpen(false);
      setDispatchForm({
        recipient_user_id: "",
        notification_type: "announcement",
        title: "",
        message: "",
      });
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send notification", "Error");
    } finally {
      setIsSending(false);
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case "emergency":
      case "security_alert":
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
          <span style={{ fontSize: "1.2rem" }}>{getCategoryIcon(n.category || (n as any).notification_type)}</span>
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
                maxWidth: 420,
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
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSendTestNotification}
              disabled={dispatchMutation.isPending}
            >
              ⚡ Send Test Alert
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsDispatchModalOpen(true)}
            >
              🔔 Dispatch Notification
            </button>
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
        emptyDescription="You are completely caught up! Click 'Dispatch Notification' or 'Send Test Alert' above to create in-app notifications."
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

      {/* Dispatch Notification Modal */}
      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title="🔔 Dispatch Alert or Notification"
      >
        <form onSubmit={handleDispatchNotification} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Recipient
            </label>
            <select
              className="select-field"
              value={dispatchForm.recipient_user_id}
              onChange={(e) => setDispatchForm({ ...dispatchForm, recipient_user_id: e.target.value })}
            >
              <option value="">Myself (Admin Alert - {currentUser?.email})</option>
              {residentsList.map((r: any) => {
                const uId = r.user_id || r.id;
                const name = r.full_name || r.user?.full_name || "Resident";
                const unit = r.unit_number ? ` (Unit ${r.unit_number})` : "";
                return (
                  <option key={uId} value={uId}>
                    {name}
                    {unit}
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Notification Category
              </label>
              <select
                className="select-field"
                value={dispatchForm.notification_type}
                onChange={(e) => setDispatchForm({ ...dispatchForm, notification_type: e.target.value })}
              >
                <option value="announcement">📢 Announcement Alert</option>
                <option value="security_alert">🚨 Security Alert</option>
                <option value="visitor">🛡️ Visitor Check-in Update</option>
                <option value="billing">💳 Billing &amp; Payment Notice</option>
                <option value="complaint">🎫 Helpdesk Ticket Update</option>
                <option value="general">🔔 General In-App Notification</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Title
            </label>
            <input
              type="text"
              className="input-field"
              required
              placeholder="e.g. Scheduled Lift Maintenance Tomorrow"
              value={dispatchForm.title}
              onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Message
            </label>
            <textarea
              className="input-field"
              rows={4}
              required
              placeholder="Enter full notification message body..."
              value={dispatchForm.message}
              onChange={(e) => setDispatchForm({ ...dispatchForm, message: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsDispatchModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSending}>
              {isSending ? "Sending…" : "Dispatch Now →"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
