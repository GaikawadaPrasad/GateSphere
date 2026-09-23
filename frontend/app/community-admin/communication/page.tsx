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
  useGroupMembers,
  useAddGroupMember,
  useRemoveGroupMember,
} from "@/hooks/use-communication";
import { useTowers } from "@/hooks/use-communities";
import { useResidents } from "@/hooks/use-residents";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import type {
  Announcement,
  AnnouncementType,
  ResidentGroup,
  AnnouncementPriority,
  AnnouncementListStatus,
  TargetAudienceType,
} from "@/types/communication";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/store/toast";

export default function CommunityAdminCommunicationPage() {
  const { activeCommunityId } = useUiStore();
  const [activeTab, setActiveTab] = useState<"announcements" | "emergency" | "groups">(
    "announcements",
  );
  const [statusFilter, setStatusFilter] = useState<AnnouncementListStatus>("all");

  // Queries
  const {
    data: announcements,
    isLoading: announcementsLoading,
    refetch: refetchAnnouncements,
  } = useAnnouncements({
    community_id: activeCommunityId || undefined,
    status: statusFilter,
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

  // Group Members Management State
  const [selectedGroup, setSelectedGroup] = useState<ResidentGroup | null>(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [selectedResidentUserId, setSelectedResidentUserId] = useState<string>("");
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Group Members and Resident Queries
  const {
    data: groupMembers,
    isLoading: membersLoading,
    refetch: refetchMembers,
  } = useGroupMembers(selectedGroup?.id);

  const { data: residentsList, isLoading: residentsLoading } = useResidents(
    activeCommunityId ? ({ community_id: activeCommunityId, page_size: 100 } as any) : undefined,
  );

  const addMemberMutation = useAddGroupMember();
  const removeMemberMutation = useRemoveGroupMember();
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
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

  const [commFieldErrors, setCommFieldErrors] = useState<Record<string, string>>({});

  // Handle Create Announcement — build targets[] to match backend AnnouncementCreate schema
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) return;

    const errors: Record<string, string> = {};
    const trimmedTitle = form.title.trim();
    if (!trimmedTitle || trimmedTitle.length < 3) {
      errors.title = "Announcement title is required and must be at least 3 characters long.";
    } else if (trimmedTitle.length > 200) {
      errors.title = "Announcement title cannot exceed 200 characters.";
    } else if (!/[a-zA-Z]{2,}/.test(trimmedTitle)) {
      errors.title = "Announcement title must contain meaningful readable text (at least 2 alphabetic letters).";
    }

    const trimmedBody = form.body.trim();
    if (!trimmedBody || trimmedBody.length < 10) {
      errors.body = "Announcement message content is required and must be at least 10 characters long.";
    } else if (trimmedBody.length > 20000) {
      errors.body = "Announcement message content cannot exceed 20,000 characters.";
    } else if (!/[a-zA-Z]{3,}/.test(trimmedBody)) {
      errors.body = "Announcement message content must contain meaningful text (at least 3 alphabetic letters).";
    }

    if (form.target_type !== "all" && !form.target_id) {
      errors.target_id = `Please select a specific ${form.target_type === "tower" ? "tower" : "resident group"} for this announcement.`;
    }

    if (Object.keys(errors).length > 0) {
      setCommFieldErrors(errors);
      setAnnouncementError("Please fix the highlighted validation errors below.");
      return;
    }

    try {
      setIsSubmitting(true);
      setAnnouncementError(null);

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
          title: form.title.trim(),
          body: form.body.trim(),
          priority: form.priority,
          targets,
        },
        communityId: activeCommunityId,
      });
      toast.success("Announcement draft created successfully.", "Draft Created");
      setIsCreateOpen(false);
      setCommFieldErrors({});
      setForm({
        title: "",
        body: "",
        announcement_type: "notice",
        priority: "normal",
        target_type: "all",
        target_id: "",
      });
      refetchAnnouncements();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to create announcement";
      setAnnouncementError(msg);
      toast.error(msg, "Announcement Creation Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Publish
  const handlePublish = async (id: string) => {
    try {
      await publishAnnouncement.mutateAsync(id);
      toast.success("Announcement published successfully to community.", "Published");
      refetchAnnouncements();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to publish announcement", "Error");
    }
  };

  // Handle Expire
  const handleExpire = async (id: string) => {
    try {
      await expireAnnouncement.mutateAsync(id);
      toast.success("Announcement marked as expired.", "Expired");
      refetchAnnouncements();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to expire announcement", "Error");
    }
  };

  // Handle Create Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) return;

    const trimmedGroupName = groupForm.name.trim();
    if (!trimmedGroupName || trimmedGroupName.length < 2) {
      setCommFieldErrors({ group_name: "Group name must be at least 2 characters long." });
      return;
    }
    if (!/[a-zA-Z]{2,}/.test(trimmedGroupName)) {
      setCommFieldErrors({ group_name: "Group name must contain readable alphabetic characters." });
      return;
    }

    try {
      setIsSubmitting(true);
      await createGroup.mutateAsync({
        payload: {
          name: groupForm.name.trim(),
          description: groupForm.description.trim() || undefined,
        },
        communityId: activeCommunityId,
      });
      toast.success(`Resident group "${groupForm.name.trim()}" created successfully.`, "Group Created");
      setIsGroupModalOpen(false);
      setCommFieldErrors({});
      setGroupForm({ name: "", description: "" });
      refetchGroups();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to create resident group", "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Member to Group
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !selectedResidentUserId) return;
    try {
      setIsAddingMember(true);
      await addMemberMutation.mutateAsync({
        groupId: selectedGroup.id,
        userId: selectedResidentUserId,
      });
      toast.success("Resident added to group successfully.", "Member Added");
      setSelectedResidentUserId("");
      refetchMembers();
      refetchGroups();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to add member to group", "Error");
    } finally {
      setIsAddingMember(false);
    }
  };

  // Handle Remove Member from Group
  const handleRemoveMember = async (memberId: string, residentName?: string) => {
    if (!selectedGroup) return;
    try {
      await removeMemberMutation.mutateAsync({
        groupId: selectedGroup.id,
        memberId,
      });
      toast.success(
        residentName ? `${residentName} removed from group.` : "Member removed from group.",
        "Member Removed",
      );
      refetchMembers();
      refetchGroups();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to remove member", "Error");
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
      render: (a) => {
        const isExpired = Boolean(
          a.is_expired || (a.expires_at && new Date(a.expires_at).getTime() <= Date.now()),
        );
        if (isExpired) {
          return <span className="badge badge-neutral">Expired</span>;
        }
        return (
          <span className={`badge ${a.is_published ? "badge-success" : "badge-warning"}`}>
            {a.is_published ? "Published" : "Draft"}
          </span>
        );
      },
    },
    {
      key: "created_at",
      header: "Created / Published",
      render: (a) => formatDateTime(a.published_at || a.created_at),
    },
    {
      key: "actions",
      header: "Action",
      render: (a) => {
        const isExpired = Boolean(
          a.is_expired || (a.expires_at && new Date(a.expires_at).getTime() <= Date.now()),
        );
        if (isExpired) {
          return (
            <span
              className="badge badge-neutral"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
            >
              Expired
            </span>
          );
        }
        return (
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
        );
      },
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
    {
      key: "actions",
      header: "Action",
      render: (g) => (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedGroup(g);
            setIsMembersModalOpen(true);
          }}
        >
          👥 Manage Members ({g.member_count || 0})
        </button>
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
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setCommFieldErrors({});
                setAnnouncementError(null);
                setIsCreateOpen(true);
              }}
            >
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
                className={`btn ${statusFilter === "all" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                onClick={() => setStatusFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`btn ${statusFilter === "published" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                onClick={() => setStatusFilter("published")}
              >
                Published Only
              </button>
              <button
                type="button"
                className={`btn ${statusFilter === "draft" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                onClick={() => setStatusFilter("draft")}
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
            enableClientPagination={true}
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
                  priority: "urgent",
                  target_type: "all",
                  target_id: "",
                });
                setCommFieldErrors({});
                setAnnouncementError(null);
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
              onClick={() => {
                setCommFieldErrors({});
                setIsGroupModalOpen(true);
              }}
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
            enableClientPagination={true}
          />
        </div>
      )}

      {/* Create Announcement Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setCommFieldErrors({});
          setAnnouncementError(null);
        }}
        title={
          form.announcement_type === "emergency"
            ? "🚨 Compose Emergency Broadcast"
            : "📢 Create Announcement"
        }
      >
        <form
          onSubmit={handleCreateAnnouncement}
          noValidate
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {announcementError && (
            <div
              style={{
                padding: "0.6rem 0.8rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-sm)",
                color: "#b91c1c",
                fontSize: "0.85rem",
              }}
            >
              ⚠️ {announcementError}
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
              Title <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              className="input-field"
              required
              aria-invalid={Boolean(commFieldErrors.title)}
              style={{
                borderColor: commFieldErrors.title ? "#ef4444" : undefined,
              }}
              placeholder="e.g. Water Tank Maintenance Schedule"
              value={form.title}
              onChange={(e) => {
                setForm({ ...form, title: e.target.value });
                if (commFieldErrors.title) {
                  setCommFieldErrors((prev) => {
                    const n = { ...prev };
                    delete n.title;
                    return n;
                  });
                }
              }}
            />
            {commFieldErrors.title && (
              <span
                role="alert"
                style={{
                  fontSize: "0.75rem",
                  color: "#ef4444",
                  marginTop: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <span>⚠️</span> {commFieldErrors.title}
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Type
              </label>
              <select
                className="select-field"
                value={form.announcement_type}
                onChange={(e) => {
                  const newType = e.target.value as AnnouncementType;
                  setForm({
                    ...form,
                    announcement_type: newType,
                    priority: newType === "emergency" ? "urgent" : form.priority,
                  });
                }}
              >
                <option value="notice">📢 Notice</option>
                <option value="emergency">🚨 Emergency</option>
                <option value="event">📅 Event</option>
                <option value="poll">📊 Poll</option>
                <option value="survey">📝 Survey</option>
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
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
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
                onChange={(e) => {
                  setForm({
                    ...form,
                    target_type: e.target.value as typeof form.target_type,
                    target_id: "",
                  });
                  if (commFieldErrors.target_id) {
                    setCommFieldErrors((prev) => {
                      const n = { ...prev };
                      delete n.target_id;
                      return n;
                    });
                  }
                }}
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
                Select Tower <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                className="select-field"
                required
                aria-invalid={Boolean(commFieldErrors.target_id)}
                style={{
                  borderColor: commFieldErrors.target_id ? "#ef4444" : undefined,
                }}
                value={form.target_id}
                onChange={(e) => {
                  setForm({ ...form, target_id: e.target.value });
                  if (commFieldErrors.target_id) {
                    setCommFieldErrors((prev) => {
                      const n = { ...prev };
                      delete n.target_id;
                      return n;
                    });
                  }
                }}
              >
                <option value="">-- Choose Tower --</option>
                {towers?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {commFieldErrors.target_id && (
                <span
                  role="alert"
                  style={{
                    fontSize: "0.75rem",
                    color: "#ef4444",
                    marginTop: "0.25rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  <span>⚠️</span> {commFieldErrors.target_id}
                </span>
              )}
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
                Select Resident Group <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                className="select-field"
                required
                aria-invalid={Boolean(commFieldErrors.target_id)}
                style={{
                  borderColor: commFieldErrors.target_id ? "#ef4444" : undefined,
                }}
                value={form.target_id}
                onChange={(e) => {
                  setForm({ ...form, target_id: e.target.value });
                  if (commFieldErrors.target_id) {
                    setCommFieldErrors((prev) => {
                      const n = { ...prev };
                      delete n.target_id;
                      return n;
                    });
                  }
                }}
              >
                <option value="">-- Choose Group --</option>
                {groups?.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              {commFieldErrors.target_id && (
                <span
                  role="alert"
                  style={{
                    fontSize: "0.75rem",
                    color: "#ef4444",
                    marginTop: "0.25rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  <span>⚠️</span> {commFieldErrors.target_id}
                </span>
              )}
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
              Message Content <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              className="input-field"
              rows={4}
              required
              aria-invalid={Boolean(commFieldErrors.body)}
              style={{
                borderColor: commFieldErrors.body ? "#ef4444" : undefined,
              }}
              placeholder="Write the full announcement details (min 10 characters)..."
              value={form.body}
              onChange={(e) => {
                setForm({ ...form, body: e.target.value });
                if (commFieldErrors.body) {
                  setCommFieldErrors((prev) => {
                    const n = { ...prev };
                    delete n.body;
                    return n;
                  });
                }
              }}
            />
            {commFieldErrors.body && (
              <span
                role="alert"
                style={{
                  fontSize: "0.75rem",
                  color: "#ef4444",
                  marginTop: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <span>⚠️</span> {commFieldErrors.body}
              </span>
            )}
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
        onClose={() => {
          setIsGroupModalOpen(false);
          setCommFieldErrors({});
        }}
        title="Create Resident Group"
      >
        <form
          onSubmit={handleCreateGroup}
          noValidate
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
              Group Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              className="input-field"
              required
              aria-invalid={Boolean(commFieldErrors.group_name)}
              style={{
                borderColor: commFieldErrors.group_name ? "#ef4444" : undefined,
              }}
              placeholder="e.g. Garden Committee / Tower A Owners"
              value={groupForm.name}
              onChange={(e) => {
                setGroupForm({ ...groupForm, name: e.target.value });
                if (commFieldErrors.group_name) {
                  setCommFieldErrors((prev) => {
                    const n = { ...prev };
                    delete n.group_name;
                    return n;
                  });
                }
              }}
            />
            {commFieldErrors.group_name && (
              <span
                role="alert"
                style={{
                  fontSize: "0.75rem",
                  color: "#ef4444",
                  marginTop: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <span>⚠️</span> {commFieldErrors.group_name}
              </span>
            )}
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

      {/* Manage Group Members Modal */}
      <Modal
        isOpen={isMembersModalOpen}
        onClose={() => {
          setIsMembersModalOpen(false);
          setSelectedGroup(null);
          setSelectedResidentUserId("");
          setMemberSearchTerm("");
        }}
        title={`👥 Manage Members — ${selectedGroup?.name || "Group"}`}
      >
        {selectedGroup && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {selectedGroup.description && (
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                  background: "#f8fafc",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}
              >
                {selectedGroup.description}
              </div>
            )}

            {/* Add Resident Section */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "1rem",
                background: "#fafafa",
              }}
            >
              <div style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                + Add Resident to Group
              </div>
              <form
                onSubmit={handleAddMember}
                style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
              >
                <select
                  className="select-field"
                  style={{ flex: 1, minWidth: 220 }}
                  value={selectedResidentUserId}
                  onChange={(e) => setSelectedResidentUserId(e.target.value)}
                  disabled={residentsLoading}
                >
                  <option value="">-- Select Resident to Add --</option>
                  {residentsList
                    ?.filter(
                      (r) =>
                        r.user_id &&
                        !groupMembers?.some((m: any) => m.user_id === r.user_id),
                    )
                    .map((r) => (
                      <option key={r.id} value={r.user_id}>
                        {r.full_name} {r.unit_number ? `(${r.unit_number})` : ""} {r.email ? `• ${r.email}` : ""}
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!selectedResidentUserId || isAddingMember}
                  style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                >
                  {isAddingMember ? "Adding…" : "+ Add to Group"}
                </button>
              </form>
            </div>

            {/* Members List */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                  Current Members ({groupMembers?.length || 0})
                </span>
                <input
                  type="text"
                  placeholder="Filter members..."
                  className="input-field"
                  style={{ maxWidth: 200, padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                />
              </div>

              {membersLoading ? (
                <div
                  style={{
                    padding: "1.5rem",
                    textAlign: "center",
                    color: "var(--muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  Loading group members...
                </div>
              ) : !groupMembers || groupMembers.length === 0 ? (
                <div
                  style={{
                    padding: "1.5rem",
                    textAlign: "center",
                    color: "var(--muted)",
                    background: "#f8fafc",
                    borderRadius: "var(--radius-sm)",
                    border: "1px dashed var(--border)",
                    fontSize: "0.85rem",
                  }}
                >
                  No residents have been added to this group yet. Select a resident above and click &quot;+ Add to Group&quot;.
                </div>
              ) : (
                <div
                  style={{
                    maxHeight: 280,
                    overflowY: "auto",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Resident</th>
                        <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Added</th>
                        <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupMembers
                        .filter((m: any) => {
                          if (!memberSearchTerm) return true;
                          const q = memberSearchTerm.toLowerCase();
                          return (
                            (m.user_name || "").toLowerCase().includes(q) ||
                            (m.user_email || "").toLowerCase().includes(q)
                          );
                        })
                        .map((m: any) => (
                          <tr key={m.id || m.user_id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              <div style={{ fontWeight: 600 }}>{m.user_name || "Resident Member"}</div>
                              {m.user_email && (
                                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{m.user_email}</div>
                              )}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "var(--muted)", fontSize: "0.75rem" }}>
                              {m.added_at ? formatDateTime(m.added_at).split(",")[0] : "Joined"}
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                              <button
                                type="button"
                                className="btn btn-danger"
                                style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                                onClick={() => handleRemoveMember(m.id || m.user_id, m.user_name)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsMembersModalOpen(false);
                  setSelectedGroup(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
