"use client";

import { useState, useMemo } from "react";
import { Modal } from "@/components/common/Modal";
import {
  useGroupMembers,
  useAddGroupMember,
  useRemoveGroupMember,
} from "@/hooks/use-communication";
import { useResidents } from "@/hooks/use-residents";
import { useTowers } from "@/hooks/use-communities";
import { communicationApi } from "@/lib/api";
import { toast } from "@/store/toast";
import type { ResidentGroup, ResidentGroupMember } from "@/types/communication";
import { formatDateTime } from "@/lib/utils";

interface GroupMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ResidentGroup | null;
  communityId?: string;
  onMembersUpdated?: () => void;
}

export function GroupMembersModal({
  isOpen,
  onClose,
  group,
  communityId,
  onMembersUpdated,
}: GroupMembersModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [residentSearchQuery, setResidentSearchQuery] = useState<string>("");
  const [selectedTowerFilter, setSelectedTowerFilter] = useState<string>("");
  const [addMode, setAddMode] = useState<"quick" | "multi">("multi");
  const [isAdding, setIsAdding] = useState(false);

  const {
    data: members = [],
    isLoading: membersLoading,
    refetch: refetchMembers,
  } = useGroupMembers(group?.id);

  const { data: residentsData } = useResidents({
    community_id: communityId,
    page_size: 200,
  });

  const { data: towers = [] } = useTowers(communityId);

  const allResidents: any[] = useMemo(() => {
    if (!residentsData) return [];
    if (Array.isArray(residentsData)) return residentsData;
    if (Array.isArray((residentsData as any)?.data)) return (residentsData as any).data;
    if (Array.isArray((residentsData as any)?.items)) return (residentsData as any).items;
    return [];
  }, [residentsData]);

  const addMemberMutation = useAddGroupMember();
  const removeMemberMutation = useRemoveGroupMember();

  // Set of user IDs already in this group
  const existingUserIds = useMemo(() => {
    return new Set(members.map((m) => m.user_id));
  }, [members]);

  // Residents available to be added (excluding those already in the group)
  const availableResidents = useMemo(() => {
    return allResidents
      .filter((r) => {
        const uId = r.user_id || r.id;
        return uId && !existingUserIds.has(uId);
      })
      .map((r) => {
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
  }, [allResidents, existingUserIds]);

  // Filter available residents based on search and tower filter
  const filteredAvailableResidents = useMemo(() => {
    return availableResidents.filter((r) => {
      if (selectedTowerFilter && r.towerId !== selectedTowerFilter && r.towerName !== selectedTowerFilter) {
        return false;
      }
      if (residentSearchQuery.trim()) {
        const q = residentSearchQuery.toLowerCase();
        const nameMatch = r.name.toLowerCase().includes(q);
        const emailMatch = r.email.toLowerCase().includes(q);
        const phoneMatch = r.phone.toLowerCase().includes(q);
        const unitMatch = r.unitDisplay.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !phoneMatch && !unitMatch) return false;
      }
      return true;
    });
  }, [availableResidents, selectedTowerFilter, residentSearchQuery]);

  // Filter existing members by search term
  const filteredMembers = useMemo(() => {
    if (!searchFilter.trim()) return members;
    const q = searchFilter.toLowerCase();
    return members.filter((m) => {
      const nameMatch = m.full_name?.toLowerCase().includes(q);
      const emailMatch = m.email?.toLowerCase().includes(q);
      const phoneMatch = m.phone?.toLowerCase().includes(q);
      return nameMatch || emailMatch || phoneMatch;
    });
  }, [members, searchFilter]);

  if (!isOpen || !group) return null;

  const handleAddSingleMember = async () => {
    if (!selectedUserId) {
      toast.error("Please select a resident to add.");
      return;
    }

    try {
      setIsAdding(true);
      await addMemberMutation.mutateAsync({
        groupId: group.id,
        userId: selectedUserId,
      });
      toast.success("Resident added to group successfully!", "Member Added");
      setSelectedUserId("");
      refetchMembers();
      if (onMembersUpdated) onMembersUpdated();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add member to group", "Error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddBatchMembers = async () => {
    if (selectedUserIds.length === 0) {
      toast.error("Please select at least one resident to add.");
      return;
    }

    try {
      setIsAdding(true);
      let successCount = 0;
      let failCount = 0;

      for (const uId of selectedUserIds) {
        try {
          await communicationApi.addGroupMember(group.id, { user_id: uId });
          successCount++;
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(
          `Added ${successCount} resident${successCount > 1 ? "s" : ""} to ${group.name}!`,
          "Members Added"
        );
      }
      if (failCount > 0) {
        toast.error(`Failed to add ${failCount} resident(s).`, "Partial Error");
      }

      setSelectedUserIds([]);
      refetchMembers();
      if (onMembersUpdated) onMembersUpdated();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add members", "Error");
    } finally {
      setIsAdding(false);
    }
  };

  const toggleSelectResident = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredAvailableResidents.map((r) => r.id);
    const areAllSelected = allFilteredIds.every((id) => selectedUserIds.includes(id));
    if (areAllSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleRemoveMember = async (member: ResidentGroupMember) => {
    const confirm = window.confirm(
      `Remove ${member.full_name || "this resident"} from ${group.name}?`
    );
    if (!confirm) return;

    try {
      await removeMemberMutation.mutateAsync({
        groupId: group.id,
        memberId: (member as any).id || member.user_id,
      });
      toast.success("Member removed from group.", "Removed");
      refetchMembers();
      if (onMembersUpdated) onMembersUpdated();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove member", "Error");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`👥 Manage Members: ${group.name}`}
      size="lg"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {group.description && (
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
            {group.description}
          </p>
        )}

        {/* Add Resident Section */}
        <div
          style={{
            background: "var(--card-bg)",
            padding: "1.25rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--fg)" }}>
                ➕ Add Residents to Group
              </h4>
              <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                {availableResidents.length} resident{availableResidents.length !== 1 ? "s" : ""} available in this community
              </p>
            </div>

            {/* Mode Switcher */}
            <div style={{ display: "flex", gap: "0.25rem", background: "var(--bg-muted)", padding: "0.2rem", borderRadius: "var(--radius-sm)" }}>
              <button
                type="button"
                className={`btn ${addMode === "multi" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
                onClick={() => setAddMode("multi")}
              >
                ☑️ Multi-Select
              </button>
              <button
                type="button"
                className={`btn ${addMode === "quick" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
                onClick={() => setAddMode("quick")}
              >
                ⚡ Quick Dropdown
              </button>
            </div>
          </div>

          {availableResidents.length === 0 ? (
            <div style={{ fontSize: "0.85rem", color: "var(--muted)", padding: "0.5rem 0" }}>
              🎉 All residents in this community are already members of this group.
            </div>
          ) : addMode === "quick" ? (
            /* Quick Single Dropdown Mode */
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem" }}>
              <select
                className="select-field"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">-- Choose Resident ({availableResidents.length} available) --</option>
                {availableResidents.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.unitDisplay ? `(${r.unitDisplay})` : ""} {r.email ? `- ${r.email}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddSingleMember}
                disabled={!selectedUserId || isAdding || addMemberMutation.isPending}
                style={{ whiteSpace: "nowrap" }}
              >
                {isAdding ? "Adding…" : "+ Add Member"}
              </button>
            </div>
          ) : (
            /* Multi-Select Batch Add Mode */
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
              {/* Filter controls */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search by resident name, unit, phone, or email..."
                  value={residentSearchQuery}
                  onChange={(e) => setResidentSearchQuery(e.target.value)}
                  style={{ fontSize: "0.82rem", padding: "0.35rem 0.65rem" }}
                />

                {towers.length > 0 && (
                  <select
                    className="select-field"
                    value={selectedTowerFilter}
                    onChange={(e) => setSelectedTowerFilter(e.target.value)}
                    style={{ fontSize: "0.82rem", padding: "0.35rem 0.65rem" }}
                  >
                    <option value="">All Towers / Blocks</option>
                    {towers.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSelectAllFiltered}
                  style={{ fontSize: "0.75rem", padding: "0.35rem 0.65rem", whiteSpace: "nowrap" }}
                >
                  {filteredAvailableResidents.length > 0 &&
                  filteredAvailableResidents.every((r) => selectedUserIds.includes(r.id))
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              {/* Residents Checkbox List */}
              <div
                style={{
                  maxHeight: 180,
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg)",
                  padding: "0.25rem 0.5rem",
                }}
              >
                {filteredAvailableResidents.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "1rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                    No available residents match your search filter.
                  </div>
                ) : (
                  filteredAvailableResidents.map((r) => {
                    const isSelected = selectedUserIds.includes(r.id);
                    return (
                      <label
                        key={r.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.45rem 0.6rem",
                          borderBottom: "1px solid rgba(0,0,0,0.04)",
                          cursor: "pointer",
                          borderRadius: "var(--radius-xs)",
                          background: isSelected ? "rgba(37, 99, 235, 0.06)" : "transparent",
                          transition: "background 0.1s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectResident(r.id)}
                            style={{ cursor: "pointer" }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}>
                              {r.name}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                              {r.email || r.phone || "No contact"}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          {r.unitDisplay && (
                            <span className="badge badge-neutral" style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem" }}>
                              {r.unitDisplay}
                            </span>
                          )}
                          {r.residentType && (
                            <span className="badge badge-primary" style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem" }}>
                              {r.residentType}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              {/* Batch Action Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.25rem" }}>
                <span style={{ fontSize: "0.8rem", color: selectedUserIds.length > 0 ? "var(--primary)" : "var(--muted)", fontWeight: 600 }}>
                  {selectedUserIds.length} resident{selectedUserIds.length !== 1 ? "s" : ""} selected
                </span>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddBatchMembers}
                  disabled={selectedUserIds.length === 0 || isAdding}
                  style={{ fontSize: "0.82rem", padding: "0.4rem 0.9rem" }}
                >
                  {isAdding ? "Adding Residents…" : `+ Add Selected Residents (${selectedUserIds.length})`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Current Members Section */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
              Group Members ({members.length})
            </h4>
            {members.length > 3 && (
              <input
                type="text"
                className="input-field"
                placeholder="Search member..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{ maxWidth: 220, padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
              />
            )}
          </div>

          {membersLoading ? (
            <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}>
              Loading group members…
            </div>
          ) : filteredMembers.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "2rem 1rem",
                background: "var(--bg-muted)",
                borderRadius: "var(--radius-sm)",
                border: "1px dashed var(--border)",
                color: "var(--muted)",
                fontSize: "0.85rem",
              }}
            >
              {members.length === 0
                ? "No residents have been added to this group yet. Select residents in the box above to add them."
                : "No matching members found for your search."}
            </div>
          ) : (
            <div
              style={{
                maxHeight: 260,
                overflowY: "auto",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "var(--bg-muted)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Resident Name</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Contact</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Added Date</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((m) => (
                    <tr
                      key={(m as any).id || m.user_id}
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <div style={{ fontWeight: 600, color: "var(--fg)" }}>
                          {m.full_name || "Community Resident"}
                        </div>
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted)" }}>
                        <div>{m.email || "–"}</div>
                        {m.phone && <div style={{ fontSize: "0.75rem" }}>{m.phone}</div>}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted)", fontSize: "0.8rem" }}>
                        {m.added_at ? formatDateTime(m.added_at).split(",")[0] : "–"}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.2rem 0.5rem",
                            color: "var(--danger)",
                            borderColor: "rgba(239, 68, 68, 0.3)",
                          }}
                          onClick={() => handleRemoveMember(m)}
                          disabled={removeMemberMutation.isPending}
                        >
                          Remove ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
