"use client";

import { useState } from "react";
import { useUiStore } from "@/store/ui";
import {
  useAnnouncements,
  useCreateAnnouncement,
  usePublishAnnouncement,
  useExpireAnnouncement,
  useResidentGroups,
  useCreateResidentGroup,
} from "@/hooks/use-communication";
import { useTowers } from "@/hooks/use-communities";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import type {
  Announcement,
  AnnouncementType,
  ResidentGroup,
  AnnouncementPriority,
  TargetAudienceType,
} from "@/types/communication";
import { formatDateTime } from "@/lib/utils";

export default function CommunityAdminCommunicationPage() {
  const { activeCommunityId } = useUiStore();
  const [activeTab, setActiveTab] = useState<"announcements" | "emergency" | "groups">(
    "announcements",
  );
  const [publishedFilter, setPublishedFilter] = useState<boolean | undefined>(undefined);

  // Queries
  const {
    data: announcements,
    isLoading: announcementsLoading,
    refetch: refetchAnnouncements,
  } = useAnnouncements({
    community_id: activeCommunityId || undefined,
    published_only: publishedFilter,
  });

  const { data: towers } = useTowers(activeCommunityId || undefined);
  const {
    data: groups,
    isLoading: groupsLoading,
    refetch: refetchGroups,
  } = useResidentGroups(activeCommunityId || undefined);

  // Mutations
  const createAnnouncement = useCreateAnnouncement();
  const publishAnnouncement = usePublishAnnouncement();
  const expireAnnouncement = useExpireAnnouncement();
  const createGroup = useCreateResidentGroup();

  // Create Announcement Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  // Local UI state — converted to targets[] before sending to backend
  const [form, setForm] = useState<{
    title: string;
    body: string;
    announcement_type: AnnouncementType;
    priority: AnnouncementPriority;
    target_type: TargetAudienceType; // UI only — not sent to backend
    target_id: string; // UI only — not sent to backend
  }>({
    title: "",
    body: "",
    announcement_type: "notice",
    priority: "normal",
    target_type: "all",
    target_id: "",
  });
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle Create Announcement — build targets[] to match backend AnnouncementCreate schema
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) return;
    try {
      setIsSubmitting(true);

      // Convert UI target_type/target_id → backend TargetIn shape
      let targets;
      if (form.target_type === "all") {
        targets = [{ target_all_community: true }];
      } else if (form.target_type === "tower" && form.target_id) {
        targets = [{ tower_id: form.target_id, target_all_community: false }];
      } else if (form.target_type === "resident_group" && form.target_id) {
        targets = [{ resident_group_id: form.target_id, target_all_community: false }];
      } else {
        targets = [{ target_all_community: true }];
      }

      await createAnnouncement.mutateAsync({
        payload: {
          announcement_type: form.announcement_type,
          title: form.title,
          body: form.body,
          priority: form.priority,
          targets,
        },
        communityId: activeCommunityId,
      });
      setIsCreateOpen(false);
      setForm({
        title: "",
        body: "",
        announcement_type: "notice",
        priority: "normal",
        target_type: "all",
        target_id: "",
      });
      refetchAnnouncements();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Publish
  const handlePublish = async (id: string) => {
    try {
      await publishAnnouncement.mutateAsync(id);
      refetchAnnouncements();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Expire
  const handleExpire = async (id: string) => {
    try {
      await expireAnnouncement.mutateAsync(id);
      refetchAnnouncements();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Create Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) return;
    try {
      setIsSubmitting(true);
      await createGroup.mutateAsync({
        payload: groupForm,
        communityId: activeCommunityId,
      });
      setIsGroupModalOpen(false);
      setGroupForm({ name: "", description: "" });
      refetchGroups();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Announcements Table Columns
  const announcementColumns: Column<Announcement>[] = [
    {
      key: "title",
      header: "Title & Preview",
      render: (a) => (
        <div style={{ maxWidth: 320 }}>
          <strong>{a.title}</strong>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--muted)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {a.body}
          </div>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (a) => {
        const bg =
          a.priority === "emergency"
            ? "badge-danger"
            : a.priority === "urgent"
              ? "badge-warning"
              : "badge-neutral";
        return (
          <span className={`badge ${bg}`} style={{ textTransform: "capitalize" }}>
            {a.priority}
          </span>
        );
      },
    },
    {
      key: "targets",
      header: "Audience",
      render: (a) => {
        const first = a.targets?.[0];
        if (!first || first.target_all_community)
          return <span className="badge badge-primary">🌐 Entire Community</span>;
        if (first.tower_id) return <span className="badge badge-primary">🏢 Tower Specific</span>;
        if (first.resident_group_id)
          return <span className="badge badge-primary">👥 Resident Group</span>;
        if (first.unit_id) return <span className="badge badge-primary">🚪 Unit Specific</span>;
        return <span className="badge badge-neutral">Custom</span>;
      },
    },
    {
      key: "is_published",
      header: "Status",
      render: (a) => (
        <span className={`badge ${a.is_published ? "badge-success" : "badge-warning"}`}>
          {a.is_published ? "Published" : "Draft"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Created / Published",
      render: (a) => formatDateTime(a.published_at || a.created_at),
    },
    {
      key: "actions",
      header: "Action",
      render: (a) => (
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {!a.is_published && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
              onClick={() => handlePublish(a.id)}
            >
              Publish
            </button>
          )}
          {a.is_published && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
              onClick={() => handleExpire(a.id)}
            >
              Expire
            </button>
          )}
        </div>
      ),
    },
  ];

  // Resident Groups Columns
  const groupColumns: Column<ResidentGroup>[] = [
    { key: "name", header: "Group Name", render: (g) => <strong>{g.name}</strong> },
    { key: "description", header: "Description", render: (g) => g.description || "–" },
    {
      key: "member_count",
      header: "Members",
      render: (g) => <span className="badge badge-neutral">{g.member_count || 0} residents</span>,
    },
    {
      key: "is_active",
      header: "Status",
      render: (g) => (
        <span className={`badge ${g.is_active ? "badge-success" : "badge-neutral"}`}>
          {g.is_active ? "Active" : "Archived"}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <PageHeader
        title="Communication &amp; Broadcasts"
        description="Broadcast announcements, dispatch emergency alerts, publish community notices, and manage resident groups."
        action={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
              📢 New Announcement
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: "1.5rem" }}>
        <button
          type="button"
          onClick={() => setActiveTab("announcements")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "announcements" ? 700 : 500,
            color: activeTab === "announcements" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "announcements" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          📢 Announcements &amp; Notices ({announcements?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("emergency")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "emergency" ? 700 : 500,
            color: activeTab === "emergency" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "emergency" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          🚨 Emergency Broadcast System
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("groups")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "groups" ? 700 : 500,
            color: activeTab === "groups" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "groups" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          👥 Resident Groups ({groups?.length || 0})
        </button>
      </div>

      {activeTab === "announcements" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className={`btn ${publishedFilter === undefined ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                onClick={() => setPublishedFilter(undefined)}
              >
                All
              </button>
              <button
                type="button"
                className={`btn ${publishedFilter === true ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                onClick={() => setPublishedFilter(true)}
              >
                Published Only
              </button>
              <button
                type="button"
                className={`btn ${publishedFilter === false ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                onClick={() => setPublishedFilter(false)}
              >
                Drafts
              </button>
            </div>
          </div>

          <DataTable
            columns={announcementColumns}
            data={announcements as (Announcement & Record<string, unknown>)[]}
            isLoading={announcementsLoading}
            emptyTitle="No announcements found"
            emptyDescription="Create a notice to broadcast updates to residents."
          />
        </div>
      )}

      {/* Emergency Broadcast Tab */}
      {activeTab === "emergency" && (
        <div style={{ maxWidth: 700 }}>
          <div className="card" style={{ border: "1px solid #fecaca", background: "#fff5f5" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <span style={{ fontSize: "2rem" }}>🚨</span>
              <div>
                <h3 style={{ color: "#991b1b" }}>High-Priority Emergency Broadcast</h3>
                <p style={{ fontSize: "0.8rem", color: "#b91c1c" }}>
                  Dispatches immediate high-priority alerts to all residents across the community
                  via In-App notifications and security logs.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-danger"
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem" }}
              onClick={() => {
                setForm({
                  title: "URGENT COMMUNITY ALERT: ",
                  body: "",
                  announcement_type: "emergency",
                  priority: "emergency",
                  target_type: "all",
                  target_id: "",
                });
                setIsCreateOpen(true);
              }}
            >
              Compose Emergency Broadcast Alert
            </button>
          </div>
        </div>
      )}

      {/* Groups Tab */}
      {activeTab === "groups" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsGroupModalOpen(true)}
            >
              + Create Resident Group
            </button>
          </div>

          <DataTable
            columns={groupColumns}
            data={groups as (ResidentGroup & Record<string, unknown>)[]}
            isLoading={groupsLoading}
            emptyTitle="No resident groups"
            emptyDescription="Group residents by committees, interest clubs, or specific blocks."
          />
        </div>
      )}

      {/* Create Announcement Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={
          form.announcement_type === "emergency"
            ? "🚨 Compose Emergency Broadcast"
            : "📢 Create Announcement"
        }
      >
        <form
          onSubmit={handleCreateAnnouncement}
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
              Title
            </label>
            <input
              type="text"
              className="input-field"
              required
              placeholder="e.g. Water Tank Maintenance Schedule"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
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
                Priority
              </label>
              <select
                className="select-field"
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value as typeof form.priority })
                }
              >
                <option value="normal">Normal</option>
                <option value="low">Low</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency 🚨</option>
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
                Target Audience
              </label>
              <select
                className="select-field"
                value={form.target_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    target_type: e.target.value as typeof form.target_type,
                    target_id: "",
                  })
                }
              >
                <option value="all">Entire Community</option>
                <option value="tower">Specific Tower</option>
                <option value="resident_group">Resident Group</option>
              </select>
            </div>
          </div>

          {form.target_type === "tower" && (
            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Select Tower
              </label>
              <select
                className="select-field"
                required
                value={form.target_id}
                onChange={(e) => setForm({ ...form, target_id: e.target.value })}
              >
                <option value="">-- Choose Tower --</option>
                {towers?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.target_type === "resident_group" && (
            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Select Resident Group
              </label>
              <select
                className="select-field"
                required
                value={form.target_id}
                onChange={(e) => setForm({ ...form, target_id: e.target.value })}
              >
                <option value="">-- Choose Group --</option>
                {groups?.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Message Content
            </label>
            <textarea
              className="input-field"
              rows={4}
              required
              placeholder="Write the full announcement details..."
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
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
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Announcement"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        title="Create Resident Group"
      >
        <form
          onSubmit={handleCreateGroup}
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
              Group Name
            </label>
            <input
              type="text"
              className="input-field"
              required
              placeholder="e.g. Garden Committee / Tower A Owners"
              value={groupForm.name}
              onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
            />
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
              Description
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Purpose of this group..."
              value={groupForm.description}
              onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
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
              onClick={() => setIsGroupModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Save Group"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
