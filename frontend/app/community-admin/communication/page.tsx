"use client";

import { useState, useMemo } from "react";
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
import { communicationApi } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import { toast } from "@/store/toast";
import { GroupMembersModal } from "@/components/community-admin/GroupMembersModal";
import type {
  Announcement,
  AnnouncementType,
  ResidentGroup,
  ResidentGroupMember,
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

  // Group Members Modal State
  const [selectedGroup, setSelectedGroup] = useState<ResidentGroup | null>(null);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);

  // Create Group Resident Selection State
  const [createGroupResidentIds, setCreateGroupResidentIds] = useState<string[]>([]);
  const [createGroupSearch, setCreateGroupSearch] = useState<string>("");
  const [createGroupTowerFilter, setCreateGroupTowerFilter] = useState<string>("");

  // Queries
  const {
    data: announcements,
    isLoading: announcementsLoading,
    refetch: refetchAnnouncements,
  } = useAnnouncements({
    community_id: activeCommunityId || undefined,
    published_only: publishedFilter,
  });

  const { data: towers = [] } = useTowers(activeCommunityId || undefined);
  const {
    data: groups,
    isLoading: groupsLoading,
    refetch: refetchGroups,
  } = useResidentGroups(activeCommunityId || undefined);

  const { data: residentsData } = useResidents({
    community_id: activeCommunityId || undefined,
    page_size: 200,
  });

  const availableCommunityResidents = useMemo(() => {
    if (!residentsData) return [];
    const list = Array.isArray(residentsData)
      ? residentsData
      : Array.isArray((residentsData as any)?.data)
      ? (residentsData as any).data
      : Array.isArray((residentsData as any)?.items)
      ? (residentsData as any).items
      : [];

    return list.map((r: any) => {
      const uId = String(r.user_id || r.id);
      const name = String(r.full_name || r.user?.full_name || "Resident");
      const email = String(r.email || r.user?.email || "");
      const phone = String(r.phone || r.user?.phone || "");
      const unitNumber = r.unit_number ? String(r.unit_number) : "";
      const towerName = r.tower_name ? String(r.tower_name) : "";
      const towerId = r.tower_id ? String(r.tower_id) : "";
      const unitDisplay = unitNumber ? `${towerName ? towerName + " · " : ""}Unit ${unitNumber}` : "";
      const residentType = r.resident_type
        ? r.resident_type.charAt(0).toUpperCase() + r.resident_type.slice(1)
        : "";

      return {
        id: uId,
        name,
        email,
        phone,
        unitNumber,
        towerName,
        towerId,
        unitDisplay,
        residentType,
      };
    });
  }, [residentsData]);

  const filteredCreateGroupResidents = useMemo(() => {
    return availableCommunityResidents.filter((r: { id: string; name: string; email: string; phone: string; towerId?: string; towerName?: string; unitDisplay: string; residentType: string }) => {
      if (createGroupTowerFilter && r.towerId !== createGroupTowerFilter && r.towerName !== createGroupTowerFilter) {
        return false;
      }
      if (createGroupSearch.trim()) {
        const q = createGroupSearch.toLowerCase();
        const nameMatch = r.name.toLowerCase().includes(q);
        const emailMatch = r.email.toLowerCase().includes(q);
        const phoneMatch = r.phone.toLowerCase().includes(q);
        const unitMatch = r.unitDisplay.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !phoneMatch && !unitMatch) return false;
      }
      return true;
    });
  }, [availableCommunityResidents, createGroupTowerFilter, createGroupSearch]);

  // Mutations
  const createAnnouncement = useCreateAnnouncement();
  const publishAnnouncement = usePublishAnnouncement();
  const expireAnnouncement = useExpireAnnouncement();
  const createGroup = useCreateResidentGroup();

  // Create Announcement Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [autoPublish, setAutoPublish] = useState(true);

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

  const [commFieldErrors, setCommFieldErrors] = useState<Record<string, string>>({});

  // Handle Create Announcement — build targets[] to match backend AnnouncementCreate schema
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) return;

    const errors: Record<string, string> = {};
    if (!form.title.trim() || form.title.trim().length < 3) {
      errors.title = "Announcement title must be at least 3 characters long.";
    }
    if (!form.body.trim() || form.body.trim().length < 5) {
      errors.body = "Announcement body must be at least 5 characters long.";
    }
    if (form.target_type !== "all" && !form.target_id) {
      errors.target_id = "Please select a target for this announcement.";
    }

    if (Object.keys(errors).length > 0) {
      setCommFieldErrors(errors);
      return;
    }

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

      const newAnn: any = await createAnnouncement.mutateAsync({
        payload: {
          announcement_type: form.announcement_type,
          title: form.title.trim(),
          body: form.body.trim(),
          priority: form.priority,
          targets,
        },
        communityId: activeCommunityId,
      });

      if (autoPublish && newAnn?.id) {
        try {
          await publishAnnouncement.mutateAsync(newAnn.id);
        } catch {
          // If auto-publish fails, the draft still exists
        }
      }

      toast.success(
        autoPublish
          ? "Announcement created and broadcasted successfully!"
          : "Announcement draft created.",
        "Announcement Saved"
      );

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
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to create announcement", "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Publish
  const handlePublish = async (id: string) => {
    try {
      await publishAnnouncement.mutateAsync(id);
      toast.success("Announcement published to target audience.", "Published");
      refetchAnnouncements();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to publish announcement", "Error");
    }
  };

  // Handle Expire
  const handleExpire = async (id: string) => {
    try {
      await expireAnnouncement.mutateAsync(id);
      toast.success("Announcement has been marked as expired.", "Expired");
      refetchAnnouncements();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to expire announcement", "Error");
    }
  };

  // Handle Create Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) return;

    if (!groupForm.name.trim() || groupForm.name.trim().length < 2) {
      setCommFieldErrors({ group_name: "Group name must be at least 2 characters long." });
      return;
    }

    try {
      setIsSubmitting(true);
      const newGroup: any = await createGroup.mutateAsync({
        payload: {
          name: groupForm.name.trim(),
          description: groupForm.description.trim() || undefined,
        },
        communityId: activeCommunityId,
      });

      let addedCount = 0;
      if (createGroupResidentIds.length > 0 && newGroup?.id) {
        for (const uId of createGroupResidentIds) {
          try {
            await communicationApi.addGroupMember(newGroup.id, { user_id: uId });
            addedCount++;
          } catch (err) {
            console.warn("Failed to add member to new group", err);
          }
        }
      }

      toast.success(
        addedCount > 0
          ? `Resident group "${groupForm.name.trim()}" created with ${addedCount} resident${addedCount > 1 ? "s" : ""}!`
          : `Resident group "${groupForm.name.trim()}" created!`,
        "Group Created"
      );

      setIsGroupModalOpen(false);
      setCommFieldErrors({});
      setGroupForm({ name: "", description: "" });
      setCreateGroupResidentIds([]);
      setCreateGroupSearch("");
      setCreateGroupTowerFilter("");
      refetchGroups();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to create group", "Error");
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
      key: "announcement_type",
      header: "Category",
      render: (a) => (
        <span className="badge badge-primary" style={{ textTransform: "capitalize" }}>
          {a.announcement_type}
        </span>
      ),
    },
    {
      key: "target",
      header: "Audience Target",
      render: (a) => {
        if (!a.targets || a.targets.length === 0 || a.targets[0]?.target_all_community) {
          return <span className="badge badge-neutral">🌐 Entire Community</span>;
        }
        const t = a.targets[0];
        if (t.tower_id) {
          const tower = towers.find((tw) => tw.id === t.tower_id);
          return (
            <span className="badge badge-info">
              🏢 Tower: {tower ? tower.name : "Specific Tower"}
            </span>
          );
        }
        if (t.resident_group_id) {
          const grp = groups?.find((g) => g.id === t.resident_group_id);
          return (
            <span className="badge badge-purple">
              👥 Group: {grp ? grp.name : "Resident Group"}
            </span>
          );
        }
        return <span className="badge badge-neutral">Targeted</span>;
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
    {
      key: "name",
      header: "Group Name",
      render: (g) => (
        <div>
          <strong style={{ fontSize: "0.95rem" }}>{g.name}</strong>
          {g.description && (
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
              {g.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "member_count",
      header: "Members",
      render: (g) => (
        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedGroup(g);
            setIsManageMembersOpen(true);
          }}
          title="Click to view and manage members"
        >
          <span
            className="badge badge-primary"
            style={{ cursor: "pointer", fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
          >
            👥 {g.member_count || 0} residents
          </span>
        </button>
      ),
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
      align: "right",
      render: (g) => (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              fontSize: "0.75rem",
              padding: "0.3rem 0.65rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              color: "var(--primary)",
              borderColor: "rgba(37, 99, 235, 0.3)",
              background: "rgba(37, 99, 235, 0.04)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedGroup(g);
              setIsManageMembersOpen(true);
            }}
          >
            ➕ Add Residents
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              fontSize: "0.75rem",
              padding: "0.3rem 0.65rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedGroup(g);
              setIsManageMembersOpen(true);
            }}
          >
            👥 Manage ({g.member_count || 0})
          </button>
        </div>
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
            enableClientPagination={true}
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
                Announcement Category
              </label>
              <select
                className="select-field"
                value={form.announcement_type}
                onChange={(e) =>
                  setForm({ ...form, announcement_type: e.target.value as typeof form.announcement_type })
                }
              >
                <option value="notice">📢 General Notice</option>
                <option value="maintenance">🔧 Maintenance Update</option>
                <option value="event">🎉 Community Event</option>
                <option value="emergency">🚨 Emergency Broadcast</option>
                <option value="poll">📊 Resident Poll</option>
                <option value="survey">📋 Feedback Survey</option>
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
                Priority Level
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
                <option value="emergency">Emergency 🚨</option>
              </select>
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
              <option value="all">🌐 Entire Community (All Residents &amp; Owners)</option>
              <option value="tower">🏢 Specific Tower / Block</option>
              <option value="resident_group">👥 Specific Resident Group</option>
            </select>
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
                    {g.name} ({g.member_count || 0} members)
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
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0",
              fontSize: "0.85rem",
              color: "var(--fg)",
            }}
          >
            <input
              type="checkbox"
              id="autoPublishCheck"
              checked={autoPublish}
              onChange={(e) => setAutoPublish(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <label htmlFor="autoPublishCheck" style={{ cursor: "pointer", fontWeight: 500 }}>
              Broadcast / Publish immediately (visible to residents right away)
            </label>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
              marginTop: "0.5rem",
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
              {isSubmitting ? "Broadcasting…" : autoPublish ? "📢 Publish Announcement" : "Save Draft"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Group Members Management Modal */}
      <GroupMembersModal
        isOpen={isManageMembersOpen}
        onClose={() => setIsManageMembersOpen(false)}
        group={selectedGroup}
        communityId={activeCommunityId || undefined}
        onMembersUpdated={refetchGroups}
      />

      {/* Create Group Modal */}
      <Modal
        isOpen={isGroupModalOpen}
        onClose={() => {
          setIsGroupModalOpen(false);
          setCreateGroupResidentIds([]);
          setCreateGroupSearch("");
          setCreateGroupTowerFilter("");
        }}
        title="Create Resident Group"
        size="lg"
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
              Group Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              className="input-field"
              required
              placeholder="e.g. Garden Committee / Tower A Owners / Yoga Club"
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
              Description <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>(optional)</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Purpose or guidelines for this group..."
              value={groupForm.description}
              onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
            />
          </div>

          {/* Initial Residents Selection */}
          <div
            style={{
              background: "var(--bg-muted)",
              padding: "1rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
            }}
          >
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
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    margin: 0,
                    display: "block",
                    color: "var(--fg)",
                  }}
                >
                  Add Initial Residents to Group <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 400 }}>(Optional)</span>
                </label>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  You can also add or remove members anytime later.
                </span>
              </div>

              {availableCommunityResidents.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const allFilteredIds = filteredCreateGroupResidents.map((r: { id: string }) => r.id);
                    const areAllSelected = allFilteredIds.every((id: string) =>
                      createGroupResidentIds.includes(id)
                    );
                    if (areAllSelected) {
                      setCreateGroupResidentIds((prev) =>
                        prev.filter((id) => !allFilteredIds.includes(id))
                      );
                    } else {
                      setCreateGroupResidentIds((prev) =>
                        Array.from(new Set([...prev, ...allFilteredIds]))
                      );
                    }
                  }}
                  style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                >
                  {filteredCreateGroupResidents.length > 0 &&
                  filteredCreateGroupResidents.every((r: { id: string }) => createGroupResidentIds.includes(r.id))
                    ? "Deselect Filtered"
                    : "Select All Filtered"}
                </button>
              )}
            </div>

            {/* Filter inputs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: towers.length > 0 ? "1fr auto" : "1fr",
                gap: "0.5rem",
                marginBottom: "0.5rem",
              }}
            >
              <input
                type="text"
                className="input-field"
                placeholder="Search residents by name, unit, phone, email..."
                value={createGroupSearch}
                onChange={(e) => setCreateGroupSearch(e.target.value)}
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
              />

              {towers.length > 0 && (
                <select
                  className="select-field"
                  value={createGroupTowerFilter}
                  onChange={(e) => setCreateGroupTowerFilter(e.target.value)}
                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                >
                  <option value="">All Towers</option>
                  {towers.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Scrollable list */}
            <div
              style={{
                maxHeight: 160,
                overflowY: "auto",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg)",
                padding: "0.25rem 0.5rem",
              }}
            >
              {availableCommunityResidents.length === 0 ? (
                <div style={{ textAlign: "center", padding: "1rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                  No residents registered in this community yet.
                </div>
              ) : filteredCreateGroupResidents.length === 0 ? (
                <div style={{ textAlign: "center", padding: "1rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                  No residents match your search filter.
                </div>
              ) : (
                filteredCreateGroupResidents.map((r: { id: string; name: string; email: string; phone: string; unitDisplay: string; residentType: string }) => {
                  const isChecked = createGroupResidentIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.4rem 0.5rem",
                        borderBottom: "1px solid rgba(0,0,0,0.04)",
                        cursor: "pointer",
                        borderRadius: "var(--radius-xs)",
                        background: isChecked ? "rgba(37, 99, 235, 0.06)" : "transparent",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setCreateGroupResidentIds((prev) =>
                              prev.includes(r.id)
                                ? prev.filter((id) => id !== r.id)
                                : [...prev, r.id]
                            );
                          }}
                          style={{ cursor: "pointer" }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--fg)" }}>
                            {r.name}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                            {r.email || r.phone || "No contact"}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        {r.unitDisplay && (
                          <span className="badge badge-neutral" style={{ fontSize: "0.68rem", padding: "0.1rem 0.35rem" }}>
                            {r.unitDisplay}
                          </span>
                        )}
                        {r.residentType && (
                          <span className="badge badge-primary" style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem" }}>
                            {r.residentType}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: createGroupResidentIds.length > 0 ? "var(--primary)" : "var(--muted)", fontWeight: 500 }}>
              {createGroupResidentIds.length} resident{createGroupResidentIds.length !== 1 ? "s" : ""} selected
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
              marginTop: "0.5rem",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsGroupModalOpen(false);
                setCreateGroupResidentIds([]);
                setCreateGroupSearch("");
                setCreateGroupTowerFilter("");
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting
                ? "Creating Group…"
                : createGroupResidentIds.length > 0
                ? `Save Group (+${createGroupResidentIds.length} Members)`
                : "Save Group"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
