"use client";

import { useState, useMemo, useRef } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CommunityTable, type CommunityWithMetrics } from "@/components/tables/CommunityTable";
import { SearchInput } from "@/components/forms/SearchInput";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { communitiesApi, residentsApi, usersApi } from "@/lib/api";
import {
  useCommunities,
  useCreateCommunity,
  useUpdateCommunity,
  useDeleteCommunity,
  useCreateTower,
  useCreateFloor,
  useCreateUnit,
  useCreateGate,
  useCommunityUnits,
} from "@/hooks/use-communities";
import { useSuperAdminDashboardMetrics } from "@/hooks/use-dashboards";
import { useAddResident } from "@/hooks/use-residents";
import {
  INDIAN_STATES_AND_UTS,
  POPULAR_CITIES_BY_STATE,
  isValidCommunityName,
  isValidCityName,
  isValidPersonName,
} from "@/constants/locations";
import type { Community, Tower, Gate, Floor } from "@/types/communities";
import type { ResidentProfile } from "@/types/residents";
import { PasswordField } from "@/components/forms/PasswordField";
import { generateInitialPassword, PHONE_10_DIGIT_RE, toPhoneDigits } from "@/lib/utils";
import { CreateCommunityModal } from "@/components/super-admin/CreateCommunityModal";
import { CreateUserModal } from "@/components/super-admin/CreateUserModal";
import { EditUserModal, type UserRecord } from "@/components/super-admin/EditUserModal";
import { toast } from "@/store/toast";
import { useUiStore } from "@/store/ui";
import { ScopeBanner } from "@/components/common/ScopeBanner";

export default function CommunitiesPage() {
  const { activeCommunityId } = useUiStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createdAdminInfo, setCreatedAdminInfo] = useState<{
    communityId?: string;
    communityName: string;
    communityCode: string;
    adminName: string;
    adminEmail: string;
    adminPassword?: string;
    adminPhone?: string;
  } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Admin Credential Update State
  const [isEditingAdminCredentials, setIsEditingAdminCredentials] = useState(false);
  const [updateAdminEmail, setUpdateAdminEmail] = useState("");
  const [updateAdminName, setUpdateAdminName] = useState("");
  const [updateAdminPhone, setUpdateAdminPhone] = useState("");
  const [updateAdminPassword, setUpdateAdminPassword] = useState("");
  const [isUpdatingAdminCreds, setIsUpdatingAdminCreds] = useState(false);
  const [updateAdminCredsError, setUpdateAdminCredsError] = useState("");

  // Edit & Delete modal state & validations
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<CommunityWithMetrics | null>(null);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState("");
  const [editTouched, setEditTouched] = useState<Record<string, boolean>>({});
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // View / Structure Details Modal state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingCommunity, setViewingCommunity] = useState<CommunityWithMetrics | null>(null);
  const [activeTab, setActiveTab] = useState<"towers" | "units" | "residents" | "gates" | "credentials" | "staff">("towers");
  const [communityTowers, setCommunityTowers] = useState<Tower[]>([]);
  const [communityGates, setCommunityGates] = useState<Gate[]>([]);
  const [communityResidents, setCommunityResidents] = useState<ResidentProfile[]>([]);
  const [communityPersonnel, setCommunityPersonnel] = useState<UserRecord[]>([]);
  const [personnelRoleFilter, setPersonnelRoleFilter] = useState<string>("");
  const [personnelSearch, setPersonnelSearch] = useState<string>("");
  const [isAddPersonnelOpen, setIsAddPersonnelOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<UserRecord | null>(null);
  const [deletingPersonnel, setDeletingPersonnel] = useState<UserRecord | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsFeedback, setDetailsFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleShowCredentials = (comm: CommunityWithMetrics) => {
    const codeSlug = comm.code.toLowerCase().replace(/[^a-z0-9]/g, "");
    const email = comm.admin_email || `admin.${codeSlug}@gatesphere.com`;
    const adminName = comm.admin_name || `Admin (${comm.name})`;
    const pwd = `${codeSlug}@Gate2026!`;

    setShowPassword(false);
    setCopiedEmail(false);
    setCopiedPassword(false);
    setCopiedAll(false);
    setIsEditingAdminCredentials(false);
    setUpdateAdminEmail(email);
    setUpdateAdminName(adminName);
    setUpdateAdminPhone("");
    setUpdateAdminPassword(pwd);
    setUpdateAdminCredsError("");

    setCreatedAdminInfo({
      communityId: comm.id,
      communityName: comm.name,
      communityCode: comm.code,
      adminName: adminName,
      adminEmail: email,
      adminPassword: pwd,
    });
  };

  const handleSaveAdminCredentials = async () => {
    if (!createdAdminInfo?.communityId) return;
    const trimmedName = updateAdminName.trim();
    if (trimmedName && (trimmedName.length < 2 || !isValidPersonName(trimmedName))) {
      setUpdateAdminCredsError("Admin full name must contain only alphabets and spaces (min 2 chars).");
      return;
    }
    const trimmedEmail = updateAdminEmail.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setUpdateAdminCredsError("Please enter a valid email address.");
      return;
    }
    if (!updateAdminPassword || updateAdminPassword.length < 10) {
      setUpdateAdminCredsError("Password must be at least 10 characters.");
      return;
    }
    const trimmedPhone = updateAdminPhone.trim();
    if (trimmedPhone && !PHONE_10_DIGIT_RE.test(trimmedPhone)) {
      setUpdateAdminCredsError("Admin phone must be exactly 10 digits.");
      return;
    }

    try {
      setIsUpdatingAdminCreds(true);
      setUpdateAdminCredsError("");
      const res = await communitiesApi.provisionAdmin(createdAdminInfo.communityId, {
        email: trimmedEmail,
        password: updateAdminPassword.trim(),
        full_name: trimmedName || undefined,
        phone: trimmedPhone || undefined,
      });

      setCreatedAdminInfo({
        ...createdAdminInfo,
        adminName: res.full_name || updateAdminName.trim(),
        adminEmail: res.email || updateAdminEmail.trim(),
        adminPassword: updateAdminPassword.trim(),
      });

      toast.success(
        `Updated Community Admin credentials for ${createdAdminInfo.communityName}.`,
        "Credentials Updated"
      );
      refetch();
      setIsEditingAdminCredentials(false);
    } catch (err: any) {
      console.error("Failed to update community admin credentials:", err);
      setUpdateAdminCredsError(err?.message || "Failed to update community admin credentials.");
    } finally {
      setIsUpdatingAdminCreds(false);
    }
  };

  // Sub-modals for adding Tower, Floor, Unit, Resident, Gate
  const [isAddTowerOpen, setIsAddTowerOpen] = useState(false);
  const [towerName, setTowerName] = useState("");
  const [towerCode, setTowerCode] = useState("");
  const [towerFloors, setTowerFloors] = useState(10);
  const [towerType, setTowerType] = useState("tower");

  const [isAddFloorOpen, setIsAddFloorOpen] = useState(false);
  const [selectedTowerForFloor, setSelectedTowerForFloor] = useState("");
  const [floorNumber, setFloorNumber] = useState(1);
  const [floorLabel, setFloorLabel] = useState("");

  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [unitTowerId, setUnitTowerId] = useState("");
  const [towerFloorsList, setTowerFloorsList] = useState<Floor[]>([]);
  const [unitFloorId, setUnitFloorId] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [unitType, setUnitType] = useState("apartment");
  const [unitBedrooms, setUnitBedrooms] = useState<number | string>(2);
  const [unitSqFt, setUnitSqFt] = useState<number | string>(1200);
  const [unitError, setUnitError] = useState("");

  const [isAddResidentOpen, setIsAddResidentOpen] = useState(false);
  const [residentTowerId, setResidentTowerId] = useState("");
  const [residentUnitId, setResidentUnitId] = useState("");
  const [residentFullName, setResidentFullName] = useState("");
  const [residentEmail, setResidentEmail] = useState("");
  const [residentPhone, setResidentPhone] = useState("");
  const [residentPassword, setResidentPassword] = useState("");
  const [residentRole, setResidentRole] = useState("primary_owner");
  const [residentIsPrimary, setResidentIsPrimary] = useState(true);
  const [residentFormErrors, setResidentFormErrors] = useState<Record<string, string>>({});

  const [isAddGateOpen, setIsAddGateOpen] = useState(false);
  const [gateName, setGateName] = useState("");
  const [gateCode, setGateCode] = useState("");
  const [gateType, setGateType] = useState<"entry" | "exit" | "both" | "pedestrian">("both");

  const { data: communities, isLoading, refetch } = useCommunities();
  const { data: metrics } = useSuperAdminDashboardMetrics(activeCommunityId);
  const { data: communityUnitsList, refetch: refetchUnits } = useCommunityUnits(
    viewingCommunity?.id || undefined
  );

  const filteredResidentUnits = useMemo(() => {
    if (!communityUnitsList) return [];
    if (!residentTowerId) return communityUnitsList;
    return communityUnitsList.filter((u) => u.tower_id === residentTowerId);
  }, [communityUnitsList, residentTowerId]);

  const createMutation = useCreateCommunity();
  const updateMutation = useUpdateCommunity();
  const deleteMutation = useDeleteCommunity();
  const createTowerMutation = useCreateTower();
  const createFloorMutation = useCreateFloor();
  const createUnitMutation = useCreateUnit();
  const createGateMutation = useCreateGate();
  const addResidentMutation = useAddResident();

  // Field validation rules for Edit Community
  const editErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const trimmedName = editName.trim();

    if (!trimmedName) {
      errs.name = "Community name is required";
    } else if (trimmedName.length < 2) {
      errs.name = "Community name must be at least 2 characters";
    } else if (trimmedName.length > 255) {
      errs.name = "Community name cannot exceed 255 characters";
    } else if (!isValidCommunityName(trimmedName)) {
      errs.name = "Community name contains invalid characters";
    }

    const trimmedCity = editCity.trim();
    if (trimmedCity) {
      if (trimmedCity.length > 120) {
        errs.city = "City cannot exceed 120 characters";
      } else if (!isValidCityName(trimmedCity)) {
        errs.city = "City must contain only alphabetical letters and spaces";
      }
    }

    const trimmedState = editState.trim();
    if (trimmedState && trimmedState.length > 120) {
      errs.state = "State cannot exceed 120 characters";
    }

    return errs;
  }, [editName, editCity, editState]);

  const isEditFormValid = Object.keys(editErrors).length === 0;

  const filteredCommunities: CommunityWithMetrics[] = useMemo(() => {
    if (!communities) return [];
    return communities
      .filter((comm: Community) => {
        if (activeCommunityId && comm.id !== activeCommunityId) {
          return false;
        }

        const matchesSearch =
          searchQuery === "" ||
          comm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          comm.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (comm.city && comm.city.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && comm.is_active) ||
          (statusFilter === "inactive" && !comm.is_active);

        return matchesSearch && matchesStatus;
      })
      .map((comm: Community) => {
        const bd = metrics?.communityBreakdown?.[comm.id];
        return {
          ...comm,
          totalTowersCount: bd?.totalTowers,
          totalUnitsCount: bd?.totalUnits,
          totalResidentsCount: bd?.totalResidents,
          occupancyRate: bd?.occupancyRate ?? 0,
          financialStatus: bd?.financialStatus ?? "Good",
        };
      });
  }, [communities, searchQuery, statusFilter, metrics, activeCommunityId]);

  const handleOpenCreate = () => {
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (comm: CommunityWithMetrics) => {
    setEditingCommunity(comm);
    setEditName(comm.name);
    setEditCity(comm.city || "");
    setEditState(comm.state || "");
    setEditIsActive(comm.is_active);
    setEditError("");
    setEditTouched({});
    setIsConfirmingDelete(false);
    setIsEditModalOpen(true);
  };

  const refreshCommunityDetails = async (commId: string) => {
    try {
      const [towersRes, gatesRes, residentsRes, personnelRes] = await Promise.allSettled([
        communitiesApi.towers(commId),
        communitiesApi.gates(commId),
        residentsApi.list({ community_id: commId, page: 1, page_size: 100 }),
        usersApi.list({ community_id: commId, page_size: 100 }),
      ]);
      if (towersRes.status === "fulfilled") setCommunityTowers(towersRes.value || []);
      if (gatesRes.status === "fulfilled") setCommunityGates(gatesRes.value || []);
      if (residentsRes.status === "fulfilled") {
        const val: unknown = residentsRes.value;
        const resList: ResidentProfile[] = Array.isArray(val)
          ? (val as ResidentProfile[])
          : ((val as { items?: ResidentProfile[] })?.items || []);
        setCommunityResidents(resList);
      }
      if (personnelRes.status === "fulfilled") {
        const pVal = personnelRes.value;
        setCommunityPersonnel((Array.isArray(pVal) ? pVal : []) as unknown as UserRecord[]);
      }
      refetchUnits();
    } catch (err) {
      console.error("Failed to refresh details", err);
    }
  };

  const handleOpenView = async (comm: CommunityWithMetrics) => {
    setViewingCommunity(comm);
    setIsViewModalOpen(true);
    setIsLoadingDetails(true);
    setActiveTab("towers");
    setCommunityTowers([]);
    setCommunityGates([]);
    setCommunityResidents([]);
    setCommunityPersonnel([]);
    setPersonnelRoleFilter("");
    setPersonnelSearch("");
    setDetailsFeedback(null);

    try {
      await refreshCommunityDetails(comm.id);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const filteredPersonnel = useMemo(() => {
    return communityPersonnel.filter((u) => {
      if (personnelRoleFilter) {
        const hasRole = u.roles?.some((r) => r.role_slug === personnelRoleFilter);
        if (!hasRole) return false;
      }
      if (personnelSearch.trim()) {
        const q = personnelSearch.toLowerCase().trim();
        const matches =
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [communityPersonnel, personnelRoleFilter, personnelSearch]);

  const handleTowerSelectForUnit = async (tId: string) => {
    setUnitTowerId(tId);
    setUnitFloorId("");
    if (!tId) {
      setTowerFloorsList([]);
      return;
    }
    try {
      const fls = await communitiesApi.floors(tId);
      setTowerFloorsList(fls || []);
      if (fls && fls.length > 0) {
        setUnitFloorId(fls[0].id);
      }
    } catch (err) {
      console.error("Failed to load floors for tower", err);
      setTowerFloorsList([]);
    }
  };

  // Handlers for creating Tower
  const handleOpenAddTower = () => {
    setTowerName("");
    setTowerCode("");
    setTowerFloors(10);
    setTowerType("tower");
    setDetailsFeedback(null);
    setIsAddTowerOpen(true);
  };

  const handleSaveTower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingCommunity) return;

    const trimmedName = towerName.trim();
    if (!trimmedName) {
      setDetailsFeedback({ type: "error", message: "Tower name is required." });
      return;
    }
    if (trimmedName.length < 2 || trimmedName.length > 128) {
      setDetailsFeedback({ type: "error", message: "Tower name must be between 2 and 128 characters." });
      return;
    }
    if (!/[A-Za-z]/.test(trimmedName)) {
      setDetailsFeedback({ type: "error", message: "Tower name must contain letters and cannot be purely numeric or symbols." });
      return;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9\s\-./]*$/.test(trimmedName)) {
      setDetailsFeedback({ type: "error", message: "Tower name can only contain letters, numbers, spaces, hyphens, and periods." });
      return;
    }

    const trimmedCode = towerCode.trim();
    if (!trimmedCode) {
      setDetailsFeedback({ type: "error", message: "Tower code is required." });
      return;
    }
    if (trimmedCode.length > 32 || !/^[A-Za-z0-9][A-Za-z0-9 _\-\/]*$/.test(trimmedCode)) {
      setDetailsFeedback({ type: "error", message: "Tower code must start with a letter or number and contain only letters, numbers, hyphens, or slashes (1–32 characters)." });
      return;
    }

    const floorsNum = Number(towerFloors);
    if (isNaN(floorsNum) || !Number.isInteger(floorsNum) || floorsNum < 1 || floorsNum > 300) {
      setDetailsFeedback({ type: "error", message: "Total floors must be a whole number between 1 and 300." });
      return;
    }

    try {
      await createTowerMutation.mutateAsync({
        communityId: viewingCommunity.id,
        data: {
          name: trimmedName,
          code: trimmedCode.toUpperCase(),
          total_floors: floorsNum,
          structure_type: towerType,
        },
      });
      setIsAddTowerOpen(false);
      setDetailsFeedback({ type: "success", message: `Tower "${trimmedName}" created successfully.` });
      await refreshCommunityDetails(viewingCommunity.id);
      refetch();
    } catch (err: unknown) {
      setDetailsFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to create tower.",
      });
    }
  };

  // Handlers for creating Floor
  const handleOpenAddFloor = (towerId?: string) => {
    const tId = towerId || communityTowers[0]?.id || "";
    setSelectedTowerForFloor(tId);
    setFloorNumber(1);
    setFloorLabel("");
    setDetailsFeedback(null);
    setIsAddFloorOpen(true);
  };

  const handleSaveFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTowerForFloor || floorNumber === undefined) return;
    try {
      await createFloorMutation.mutateAsync({
        tower_id: selectedTowerForFloor,
        floor_number: Number(floorNumber),
        label: floorLabel.trim() || undefined,
      });
      setIsAddFloorOpen(false);
      setDetailsFeedback({ type: "success", message: `Floor ${floorNumber} created successfully.` });
      if (viewingCommunity) await refreshCommunityDetails(viewingCommunity.id);
    } catch (err: unknown) {
      setDetailsFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to create floor.",
      });
    }
  };

  // Handlers for creating Unit
  const handleOpenAddUnit = async (towerId?: string, floorId?: string) => {
    const tId = towerId || communityTowers[0]?.id || "";
    setUnitTowerId(tId);
    setUnitNumber("");
    setUnitType("apartment");
    setUnitBedrooms(2);
    setUnitSqFt(1200);
    setUnitError("");
    setDetailsFeedback(null);

    if (tId) {
      try {
        const fls = await communitiesApi.floors(tId);
        setTowerFloorsList(fls || []);
        setUnitFloorId(floorId || fls?.[0]?.id || "");
      } catch {
        setTowerFloorsList([]);
        setUnitFloorId("");
      }
    } else {
      setTowerFloorsList([]);
      setUnitFloorId("");
    }
    setIsAddUnitOpen(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitFloorId || !unitNumber.trim()) return;
    setUnitError("");
    try {
      await createUnitMutation.mutateAsync({
        floor_id: unitFloorId,
        unit_number: unitNumber.trim(),
        unit_type: unitType,
        bedrooms:
          unitBedrooms !== "" && !isNaN(Number(unitBedrooms))
            ? Number(unitBedrooms)
            : undefined,
        area_sqft:
          unitSqFt !== "" && !isNaN(Number(unitSqFt)) && Number(unitSqFt) > 0
            ? Number(unitSqFt)
            : undefined,
      });
      setIsAddUnitOpen(false);
      setDetailsFeedback({ type: "success", message: `Unit "${unitNumber}" created successfully.` });
      if (viewingCommunity) await refreshCommunityDetails(viewingCommunity.id);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create unit.";
      setUnitError(msg);
      setDetailsFeedback({
        type: "error",
        message: msg,
      });
    }
  };

  // Handlers for creating Resident
  const handleOpenAddResident = (unitId?: string) => {
    const targetUnit = unitId ? communityUnitsList?.find((u) => u.id === unitId) : undefined;
    setResidentTowerId(targetUnit?.tower_id || "");
    setResidentUnitId(unitId || communityUnitsList?.[0]?.id || "");
    setResidentFullName("");
    setResidentEmail("");
    setResidentPhone("");
    setResidentPassword("resident@Gate2026!");
    setResidentRole("primary_owner");
    setResidentIsPrimary(true);
    setResidentFormErrors({});
    setDetailsFeedback(null);
    setIsAddResidentOpen(true);
  };

  const isSavingResidentRef = useRef(false);

  const handleSaveResident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingResidentRef.current) return;
    if (!viewingCommunity) return;

    const errs: Record<string, string> = {};
    if (!residentUnitId) errs.residentUnitId = "Please select a target residential unit.";
    const trimmedResidentName = residentFullName.trim();
    if (!trimmedResidentName || trimmedResidentName.length < 2) {
      errs.residentFullName = "Full name is required (min 2 characters).";
    } else if (!isValidPersonName(trimmedResidentName)) {
      errs.residentFullName = "Name must contain only alphabets and spaces.";
    }
    if (!residentEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(residentEmail.trim())) {
      errs.residentEmail = "Valid email address is required.";
    }
    if (!residentPhone.trim() || !/^[+0-9][0-9 \-]{4,19}$/.test(residentPhone.trim())) {
      errs.residentPhone = "Enter a valid phone number (10-15 digits).";
    }
    if (residentPassword.trim() && residentPassword.trim().length < 10) {
      errs.residentPassword = "Initial password must be at least 10 characters.";
    }
    setResidentFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      setDetailsFeedback({
        type: "error",
        message: "Please fill in all required fields marked in red below.",
      });
      return;
    }

    isSavingResidentRef.current = true;
    try {
      await addResidentMutation.mutateAsync({
        communityId: viewingCommunity.id,
        data: {
          unit_id: residentUnitId,
          full_name: residentFullName.trim(),
          email: residentEmail.trim().toLowerCase(),
          phone: residentPhone.trim(),
          password: residentPassword.trim() || generateInitialPassword(residentFullName, "resident"),
          occupancy_role: residentRole,
          is_primary: residentIsPrimary,
        },
      });
      setIsAddResidentOpen(false);
      setResidentFormErrors({});
      toast.success(`Resident "${residentFullName.trim()}" onboarded successfully!`, "Resident Registered");
      setDetailsFeedback({
        type: "success",
        message: `Resident "${residentFullName}" onboarded successfully.`,
      });
      await refreshCommunityDetails(viewingCommunity.id);
      refetch();
    } catch (err: unknown) {
      setDetailsFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to onboard resident.",
      });
    } finally {
      isSavingResidentRef.current = false;
    }
  };

  // Handlers for creating Gate
  const handleOpenAddGate = () => {
    setGateName("");
    setGateCode("");
    setGateType("both");
    setDetailsFeedback(null);
    setIsAddGateOpen(true);
  };

  const handleSaveGate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingCommunity || !gateName.trim() || !gateCode.trim()) return;
    try {
      await createGateMutation.mutateAsync({
        communityId: viewingCommunity.id,
        data: {
          name: gateName.trim(),
          code: gateCode.trim().toUpperCase(),
          gate_type: gateType,
        },
      });
      setIsAddGateOpen(false);
      setDetailsFeedback({ type: "success", message: `Gate "${gateName}" created successfully.` });
      await refreshCommunityDetails(viewingCommunity.id);
      refetch();
    } catch (err: unknown) {
      setDetailsFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to create gate.",
      });
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommunity) return;
    setEditError("");
    setEditTouched({ name: true, city: true, state: true });

    if (!isEditFormValid) {
      const firstError = Object.values(editErrors)[0];
      setEditError(firstError || "Please fix validation errors before saving.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: editingCommunity.id,
        data: {
          name: editName.trim(),
          city: editCity.trim() || undefined,
          state: editState.trim() || undefined,
          is_active: editIsActive,
        },
      });
      setIsEditModalOpen(false);
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setEditError(err.message);
      } else {
        setEditError("Failed to update community.");
      }
    }
  };

  const handleDelete = async () => {
    if (!editingCommunity) return;
    setEditError("");

    try {
      await deleteMutation.mutateAsync(editingCommunity.id);
      setIsEditModalOpen(false);
      setIsConfirmingDelete(false);
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setEditError(err.message);
      } else {
        setEditError("Failed to delete community.");
      }
    }
  };

  const editStateCitySuggestions = editState ? POPULAR_CITIES_BY_STATE[editState] || [] : [];

  return (
    <div>
      <PageHeader
        title="Community Management"
        subtitle={
          activeCommunityId
            ? "Viewing scoped community property configuration and structure"
            : "Configure and manage all registered residential properties in the platform"
        }
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Communities" },
        ]}
        actions={
          <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
            ➕ Add Community
          </button>
        }
      />

      {/* Active Scope Banner */}
      <ScopeBanner entityName="community details" />

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">All Communities</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {isLoading ? "Loading registered communities…" : `Total ${communities?.length || 0} registered communities`}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ maxWidth: 260, width: "100%", minWidth: 160 }}>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by name, code or city…"
              />
            </div>
            <select
              className="select-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              style={{ width: "auto", height: 36, padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        <CommunityTable
          communities={filteredCommunities}
          isLoading={isLoading}
          onEdit={handleOpenEdit}
          onView={handleOpenView}
          onViewCredentials={handleShowCredentials}
        />
      </div>

      {/* Create Community 4-Step Wizard (Community → Towers → Floors → Units) */}
      <CreateCommunityModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(adminInfo) => {
          if (adminInfo) {
            setCreatedAdminInfo(adminInfo);
          }
          refetch();
        }}
      />

      {/* Community & Admin Credentials Modal */}
      <Modal
        isOpen={Boolean(createdAdminInfo)}
        onClose={() => setCreatedAdminInfo(null)}
        title={`🔑 Community Admin Credentials — ${createdAdminInfo?.communityName || ""}`}
        maxWidth={620}
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (createdAdminInfo) {
                  const text = `GateSphere Enterprise - Community Admin Credentials\nCommunity: ${createdAdminInfo.communityName} (${createdAdminInfo.communityCode})\nAdmin Name: ${createdAdminInfo.adminName}\nLogin Email: ${createdAdminInfo.adminEmail}\nInitial Password: ${createdAdminInfo.adminPassword || "admin@Gate2026!"}\nRole: Community Admin\nPortal Link: ${window.location.origin}/login`;
                  navigator.clipboard.writeText(text);
                  setCopiedAll(true);
                  setTimeout(() => setCopiedAll(false), 2000);
                }
              }}
              style={{ fontSize: "0.8rem" }}
            >
              {copiedAll ? "✓ All Credentials Copied!" : "📋 Copy All Credentials"}
            </button>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCreatedAdminInfo(null)}
              >
                Done
              </button>
            </div>
          </div>
        }
      >
        <div style={{ padding: "0.25rem 0" }}>
          <div
            style={{
              padding: "0.85rem 1rem",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "8px",
              marginBottom: "1.25rem",
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: "#166534", fontSize: "0.9rem" }}>
              ✅ Credentials ready for <strong>{createdAdminInfo?.communityName}</strong> ({createdAdminInfo?.communityCode})
            </p>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.775rem", color: "#15803d" }}>
              Use these credentials to sign in as Community Administrator or share them with the designated admin.
            </p>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h4
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "#334155",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                🔑 Admin Credentials Card
              </h4>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
                onClick={() => setIsEditingAdminCredentials(!isEditingAdminCredentials)}
              >
                {isEditingAdminCredentials ? "Cancel Edit" : "✏️ Update Credentials"}
              </button>
            </div>

            {updateAdminCredsError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "0.5rem 0.75rem", borderRadius: "6px", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
                ⚠️ {updateAdminCredsError}
              </div>
            )}

            {isEditingAdminCredentials ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.85rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.2rem" }}>
                    Admin Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={updateAdminName}
                    onChange={(e) => setUpdateAdminName(e.target.value)}
                    placeholder="Admin Full Name"
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.2rem" }}>
                      Login Email <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <input
                      type="email"
                      className="input-field"
                      value={updateAdminEmail}
                      onChange={(e) => setUpdateAdminEmail(e.target.value)}
                      placeholder="admin@gatesphere.com"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.2rem" }}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      className="input-field"
                      value={updateAdminPhone}
                      onChange={(e) => setUpdateAdminPhone(toPhoneDigits(e.target.value))}
                      placeholder="9876543210"
                    />
                  </div>
                </div>
                <div>
                  <PasswordField
                    label="New Password"
                    value={updateAdminPassword}
                    onChange={(val) => setUpdateAdminPassword(val)}
                    placeholder="Set new admin password"
                    required
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: "0.25rem", width: "100%" }}
                  onClick={handleSaveAdminCredentials}
                  disabled={isUpdatingAdminCreds}
                >
                  {isUpdatingAdminCreds ? "Updating Credentials…" : "💾 Save & Provision New Credentials"}
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem", fontSize: "0.85rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: "0.4rem",
                    borderBottom: "1px dashed #e2e8f0",
                  }}
                >
                  <span style={{ color: "var(--muted)", fontWeight: 500 }}>Community Name & Code:</span>
                  <span style={{ fontWeight: 600, color: "var(--fg)" }}>
                    {createdAdminInfo?.communityName} <code style={{ background: "#e2e8f0", padding: "0.1rem 0.35rem", borderRadius: 4 }}>{createdAdminInfo?.communityCode}</code>
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: "0.4rem",
                    borderBottom: "1px dashed #e2e8f0",
                  }}
                >
                  <span style={{ color: "var(--muted)", fontWeight: 500 }}>Admin Name:</span>
                  <span style={{ fontWeight: 600, color: "var(--fg)" }}>
                    {createdAdminInfo?.adminName}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: "0.4rem",
                    borderBottom: "1px dashed #e2e8f0",
                  }}
                >
                  <span style={{ color: "var(--muted)", fontWeight: 500 }}>Login Email:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 600, color: "#1e293b", fontFamily: "monospace" }}>
                      {createdAdminInfo?.adminEmail}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }}
                      onClick={() => {
                        if (createdAdminInfo?.adminEmail) {
                          navigator.clipboard.writeText(createdAdminInfo.adminEmail);
                          setCopiedEmail(true);
                          setTimeout(() => setCopiedEmail(false), 2000);
                        }
                      }}
                    >
                      {copiedEmail ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                {createdAdminInfo?.adminPassword && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: "var(--muted)", fontWeight: 500 }}>Admin Password:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <code
                        style={{
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          fontWeight: 600,
                          color: "#0f172a",
                          fontSize: "0.85rem",
                          letterSpacing: showPassword ? "normal" : "0.15em",
                        }}
                      >
                        {showPassword ? createdAdminInfo.adminPassword : "••••••••••••"}
                      </code>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }}
                        onClick={() => {
                          if (createdAdminInfo?.adminPassword) {
                            navigator.clipboard.writeText(createdAdminInfo.adminPassword);
                            setCopiedPassword(true);
                            setTimeout(() => setCopiedPassword(false), 2000);
                          }
                        }}
                      >
                        {copiedPassword ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <p
            style={{
              marginTop: "0.85rem",
              fontSize: "0.775rem",
              color: "var(--muted)",
              lineHeight: 1.4,
            }}
          >
            💡 Community administrators sign in at <strong>/login</strong> using their registered email and password to access the Community Console, manage towers, gates, units, and residents.
          </p>
        </div>
      </Modal>

      {/* Edit & Delete Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={
          isConfirmingDelete
            ? "Confirm Community Deletion"
            : `Edit Community: ${editingCommunity?.name}`
        }
        footer={
          isConfirmingDelete ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsConfirmingDelete(false)}
              >
                Back to Edit
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting…" : "Permanently Delete"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setIsConfirmingDelete(true)}
                style={{ marginRight: "auto" }}
              >
                🗑️ Delete
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-comm-page-form"
                className="btn btn-primary"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </button>
            </>
          )
        }
      >
        {isConfirmingDelete ? (
          <div style={{ padding: "0.5rem 0" }}>
            <div
              style={{
                background: "var(--danger-light)",
                border: "1px solid var(--danger-border)",
                borderRadius: "var(--radius-sm)",
                padding: "1rem",
                marginBottom: "1rem",
                color: "#991b1b",
              }}
            >
              <h4 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                ⚠️ Are you sure you want to delete this community?
              </h4>
              <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>
                Deleting <strong>{editingCommunity?.name}</strong> ({editingCommunity?.code}) will
                permanently remove all associated units, residents, and gate records. This action{" "}
                <strong>cannot be undone</strong>.
              </p>
            </div>
            {editError && (
              <div className="badge badge-danger" style={{ display: "block", padding: "0.5rem" }}>
                {editError}
              </div>
            )}
          </div>
        ) : (
          <form id="edit-comm-page-form" onSubmit={handleSaveEdit} noValidate>
            {editError && (
              <div
                className="badge badge-danger"
                style={{ display: "block", marginBottom: "1.25rem", padding: "0.6rem 0.75rem" }}
              >
                ⚠️ {editError}
              </div>
            )}

            {/* Quick Structure & Residents Navigation Shortcut */}
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "var(--radius-sm)",
                padding: "0.85rem 1rem",
                marginBottom: "1.25rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#166534" }}>
                  🏢 Towers, Units & Residents Management
                </div>
                <div style={{ fontSize: "0.775rem", color: "#15803d" }}>
                  Add or configure Towers, Floors, Units, Residents and Gates for this community
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setIsEditModalOpen(false);
                  if (editingCommunity) handleOpenView(editingCommunity);
                }}
              >
                Manage Structure →
              </button>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.35rem",
                }}
              >
                <label
                  htmlFor="edit-cp-name"
                  style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}
                >
                  Community Name <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: editName.length > 255 ? "var(--danger)" : "var(--muted)",
                  }}
                >
                  {editName.length}/255
                </span>
              </div>
              <input
                id="edit-cp-name"
                type="text"
                className="input-field"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  if (!editTouched.name) setEditTouched((t) => ({ ...t, name: true }));
                }}
                onBlur={() => setEditTouched((t) => ({ ...t, name: true }))}
                style={{
                  borderColor: editTouched.name && editErrors.name ? "var(--danger)" : undefined,
                }}
                required
              />
              {editTouched.name && editErrors.name && (
                <p style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
                  ✕ {editErrors.name}
                </p>
              )}
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label
                htmlFor="edit-cp-code"
                style={{
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                  display: "block",
                  marginBottom: "0.35rem",
                }}
              >
                Community Code (Read-Only)
              </label>
              <input
                id="edit-cp-code"
                type="text"
                className="input-field"
                value={editingCommunity?.code || ""}
                disabled
                style={{
                  background: "#f1f5f9",
                  cursor: "not-allowed",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <label
                  htmlFor="edit-cp-state"
                  style={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: "var(--fg)",
                    display: "block",
                    marginBottom: "0.35rem",
                  }}
                >
                  State / UT
                </label>
                <select
                  id="edit-cp-state"
                  className="select-field"
                  value={editState}
                  onChange={(e) => {
                    setEditState(e.target.value);
                    if (!editTouched.state) setEditTouched((t) => ({ ...t, state: true }));
                  }}
                  onBlur={() => setEditTouched((t) => ({ ...t, state: true }))}
                  style={{
                    borderColor:
                      editTouched.state && editErrors.state ? "var(--danger)" : undefined,
                  }}
                >
                  <option value="">Select State / UT…</option>
                  {INDIAN_STATES_AND_UTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {editTouched.state && editErrors.state && (
                  <p style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
                    ✕ {editErrors.state}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="edit-cp-city"
                  style={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: "var(--fg)",
                    display: "block",
                    marginBottom: "0.35rem",
                  }}
                >
                  City
                </label>
                <input
                  id="edit-cp-city"
                  type="text"
                  list="edit-modal-city-suggestions"
                  className="input-field"
                  value={editCity}
                  onChange={(e) => {
                    setEditCity(e.target.value);
                    if (!editTouched.city) setEditTouched((t) => ({ ...t, city: true }));
                  }}
                  onBlur={() => setEditTouched((t) => ({ ...t, city: true }))}
                  style={{
                    borderColor: editTouched.city && editErrors.city ? "var(--danger)" : undefined,
                  }}
                />
                <datalist id="edit-modal-city-suggestions">
                  {editStateCitySuggestions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {editTouched.city && editErrors.city && (
                  <p style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
                    ✕ {editErrors.city}
                  </p>
                )}
              </div>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  style={{ width: "auto", margin: 0 }}
                />
                <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                  Active Community Status
                </span>
              </label>
            </div>
          </form>
        )}
      </Modal>

      {/* View & Manage Community Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Community Console: ${viewingCommunity?.name || ""}`}
        maxWidth={850}
        footer={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsViewModalOpen(false)}
          >
            Close
          </button>
        }
      >
        {viewingCommunity && (
          <div>
            {/* Quick Metrics & Meta Banner */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "0.75rem",
                padding: "0.85rem 1rem",
                background: "#f8fafc",
                borderRadius: "var(--radius)",
                marginBottom: "1.25rem",
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Code</span>
                <div style={{ fontWeight: 600 }}>{viewingCommunity.code}</div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Location</span>
                <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                  {[viewingCommunity.city, viewingCommunity.state].filter(Boolean).join(", ") || "–"}
                </div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Towers</span>
                <div style={{ fontWeight: 600 }}>{communityTowers.length}</div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Units</span>
                <div style={{ fontWeight: 600 }}>{communityUnitsList?.length || 0}</div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Residents</span>
                <div style={{ fontWeight: 600 }}>{communityResidents.length}</div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Status</span>
                <div>
                  <StatusBadge status={viewingCommunity.is_active} />
                </div>
              </div>
            </div>

            {/* Notification & Feedback Alerts */}
            {detailsFeedback && (
              <div
                className={`badge ${detailsFeedback.type === "success" ? "badge-success" : "badge-danger"}`}
                style={{
                  display: "block",
                  marginBottom: "1rem",
                  padding: "0.6rem 0.85rem",
                  textAlign: "left",
                  fontSize: "0.825rem",
                }}
              >
                {detailsFeedback.type === "success" ? "✓" : "⚠️"} {detailsFeedback.message}
              </div>
            )}

            {/* Tab Navigation */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                borderBottom: "1px solid var(--border)",
                marginBottom: "1rem",
                paddingBottom: "0.25rem",
              }}
            >
              <button
                type="button"
                className={`btn btn-sm ${activeTab === "towers" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveTab("towers")}
              >
                🏢 Towers & Floors ({communityTowers.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === "units" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveTab("units")}
              >
                🚪 Units ({communityUnitsList?.length || 0})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === "residents" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveTab("residents")}
              >
                👥 Residents ({communityResidents.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === "gates" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveTab("gates")}
              >
                🛡️ Gates ({communityGates.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === "credentials" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveTab("credentials")}
              >
                🔑 Admin Credentials
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === "staff" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveTab("staff")}
              >
                👔 Personnel & Admins ({communityPersonnel.length})
              </button>
            </div>

            {isLoadingDetails ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1rem" }}>
                <div className="skeleton" style={{ height: 32 }} />
                <div className="skeleton" style={{ height: 32 }} />
                <div className="skeleton" style={{ height: 32 }} />
              </div>
            ) : (
              <div>
                {/* Tab 1: TOWERS & FLOORS */}
                {activeTab === "towers" && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.85rem",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 500 }}>
                        Configure property buildings, blocks and floor levels
                      </span>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {communityTowers.length > 0 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleOpenAddFloor()}
                          >
                            ➕ Add Floor
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={handleOpenAddTower}
                        >
                          ➕ Add Tower
                        </button>
                      </div>
                    </div>

                    {communityTowers.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {communityTowers.map((t) => (
                          <div
                            key={t.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.75rem 1rem",
                              background: "#f8fafc",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{t.name}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                                Code: <strong>{t.code || "–"}</strong> • {t.total_floors} Floors
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => handleOpenAddFloor(t.id)}
                              >
                                ➕ Floor
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => handleOpenAddUnit(t.id)}
                              >
                                ➕ Unit
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "2rem 1rem",
                          border: "1px dashed var(--border)",
                          borderRadius: "var(--radius)",
                          color: "var(--muted)",
                        }}
                      >
                        <p style={{ marginBottom: "0.75rem" }}>No towers or blocks added yet.</p>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleOpenAddTower}
                        >
                          ➕ Add First Tower
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: UNITS */}
                {activeTab === "units" && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.85rem",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 500 }}>
                        All residential and commercial flats/units
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => handleOpenAddUnit()}
                        disabled={communityTowers.length === 0}
                      >
                        ➕ Add Unit
                      </button>
                    </div>

                    {communityTowers.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "1.5rem",
                          background: "#fffbeb",
                          border: "1px solid #fef3c7",
                          borderRadius: "var(--radius)",
                          color: "#92400e",
                          fontSize: "0.85rem",
                        }}
                      >
                        ⚠️ Please add at least one Tower and Floor before adding Units.
                        <div style={{ marginTop: "0.5rem" }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={handleOpenAddTower}
                          >
                            ➕ Add Tower
                          </button>
                        </div>
                      </div>
                    ) : communityUnitsList && communityUnitsList.length > 0 ? (
                      <div
                        className="table-responsive-wrapper"
                        style={{
                          maxHeight: "360px",
                          overflow: "auto",
                          width: "100%",
                          maxWidth: "100%",
                          minWidth: 0,
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          WebkitOverflowScrolling: "touch",
                        }}
                      >
                        <table className="data-table" style={{ width: "100%", fontSize: "0.825rem" }}>
                          <thead>
                            <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                              <th style={{ padding: "0.5rem 0.75rem" }}>Unit #</th>
                              <th style={{ padding: "0.5rem 0.75rem" }}>Type</th>
                              <th style={{ padding: "0.5rem 0.75rem" }}>Area (Sq. Ft.)</th>
                              <th style={{ padding: "0.5rem 0.75rem" }}>Status</th>
                              <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {communityUnitsList.map((u) => (
                              <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>
                                  {u.unit_number}
                                </td>
                                <td style={{ padding: "0.5rem 0.75rem" }}>{u.unit_type || "–"}</td>
                                <td style={{ padding: "0.5rem 0.75rem" }}>{u.sq_ft ? `${u.sq_ft} sq ft` : "–"}</td>
                                <td style={{ padding: "0.5rem 0.75rem" }}>
                                  <span
                                    className={`badge ${u.is_occupied ? "badge-success" : "badge-secondary"}`}
                                  >
                                    {u.is_occupied ? "Occupied" : "Vacant"}
                                  </span>
                                </td>
                                <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => handleOpenAddResident(u.id)}
                                    title="Onboard Resident into this Unit"
                                  >
                                    + Resident
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "2rem 1rem",
                          border: "1px dashed var(--border)",
                          borderRadius: "var(--radius)",
                          color: "var(--muted)",
                        }}
                      >
                        <p style={{ marginBottom: "0.75rem" }}>No units created yet.</p>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenAddUnit()}
                        >
                          ➕ Add First Unit
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: RESIDENTS */}
                {activeTab === "residents" && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.85rem",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 500 }}>
                        Onboarded owners, tenants and occupants
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => handleOpenAddResident()}
                        disabled={!communityUnitsList || communityUnitsList.length === 0}
                      >
                        ➕ Add Resident
                      </button>
                    </div>

                    {!communityUnitsList || communityUnitsList.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "1.5rem",
                          background: "#fffbeb",
                          border: "1px solid #fef3c7",
                          borderRadius: "var(--radius)",
                          color: "#92400e",
                          fontSize: "0.85rem",
                        }}
                      >
                        ⚠️ Please add units first before onboarding residents.
                      </div>
                    ) : communityResidents && communityResidents.length > 0 ? (
                      <div
                        className="table-responsive-wrapper"
                        style={{
                          maxHeight: "360px",
                          overflow: "auto",
                          width: "100%",
                          maxWidth: "100%",
                          minWidth: 0,
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          WebkitOverflowScrolling: "touch",
                        }}
                      >
                        <table className="data-table" style={{ width: "100%", fontSize: "0.825rem" }}>
                          <thead>
                            <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                              <th style={{ padding: "0.5rem 0.75rem" }}>Name</th>
                              <th style={{ padding: "0.5rem 0.75rem" }}>Unit</th>
                              <th style={{ padding: "0.5rem 0.75rem" }}>Role</th>
                              <th style={{ padding: "0.5rem 0.75rem" }}>Email / Phone</th>
                            </tr>
                          </thead>
                          <tbody>
                            {communityResidents.map((r) => (
                              <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>
                                  {r.full_name || "–"}
                                </td>
                                <td style={{ padding: "0.5rem 0.75rem" }}>
                                  {r.unit_number || r.tower_name || "–"}
                                </td>
                                <td style={{ padding: "0.5rem 0.75rem" }}>
                                  <span className="badge badge-primary" style={{ textTransform: "capitalize" }}>
                                    {(r.resident_type || "Resident").replace(/_/g, " ")}
                                  </span>
                                </td>
                                <td style={{ padding: "0.5rem 0.75rem", color: "var(--muted)" }}>
                                  <div>{r.email || "–"}</div>
                                  <div>{r.phone || "–"}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "2rem 1rem",
                          border: "1px dashed var(--border)",
                          borderRadius: "var(--radius)",
                          color: "var(--muted)",
                        }}
                      >
                        <p style={{ marginBottom: "0.75rem" }}>No residents onboarded yet.</p>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenAddResident()}
                        >
                          ➕ Add First Resident
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: GATES */}
                {activeTab === "gates" && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.85rem",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 500 }}>
                        Configured entry and exit checkpoints
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={handleOpenAddGate}
                      >
                        ➕ Add Gate
                      </button>
                    </div>

                    {communityGates.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {communityGates.map((g) => (
                          <div
                            key={g.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.6rem 0.85rem",
                              background: "#f8fafc",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{g.name}</span>
                              <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "0.5rem" }}>
                                ({g.code})
                              </span>
                            </div>
                            <span
                              className="badge badge-secondary"
                              style={{ textTransform: "capitalize", fontSize: "0.75rem" }}
                            >
                              {g.gate_type}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "2rem 1rem",
                          border: "1px dashed var(--border)",
                          borderRadius: "var(--radius)",
                          color: "var(--muted)",
                        }}
                      >
                        <p style={{ marginBottom: "0.75rem" }}>No security gates configured yet.</p>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleOpenAddGate}
                        >
                          ➕ Add First Gate
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 5: ADMIN CREDENTIALS */}
                {activeTab === "credentials" && (
                  <div style={{ padding: "0.5rem 0" }}>
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "1.25rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "1rem",
                        }}
                      >
                        <div>
                          <h4 style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>
                            🔑 Community Admin Account Credentials
                          </h4>
                          <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.775rem", color: "var(--muted)" }}>
                            Portal access and login details for <strong>{viewingCommunity.name}</strong> ({viewingCommunity.code})
                          </p>
                        </div>
                        <span className="badge badge-primary" style={{ fontSize: "0.75rem" }}>
                          community_admin
                        </span>
                      </div>

                      <div style={{ display: "grid", gap: "0.85rem", fontSize: "0.85rem" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            paddingBottom: "0.5rem",
                            borderBottom: "1px dashed #e2e8f0",
                          }}
                        >
                          <span style={{ color: "var(--muted)", fontWeight: 500 }}>Community Code:</span>
                          <code style={{ background: "#e2e8f0", padding: "0.15rem 0.4rem", borderRadius: 4, fontWeight: 700 }}>
                            {viewingCommunity.code}
                          </code>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            paddingBottom: "0.5rem",
                            borderBottom: "1px dashed #e2e8f0",
                          }}
                        >
                          <span style={{ color: "var(--muted)", fontWeight: 500 }}>Admin Name:</span>
                          <span style={{ fontWeight: 600, color: "var(--fg)" }}>
                            {viewingCommunity.admin_name || `Admin (${viewingCommunity.name})`}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            paddingBottom: "0.5rem",
                            borderBottom: "1px dashed #e2e8f0",
                          }}
                        >
                          <span style={{ color: "var(--muted)", fontWeight: 500 }}>Login Email:</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontWeight: 600, color: "#0f172a", fontFamily: "monospace" }}>
                              {viewingCommunity.admin_email || `admin.${viewingCommunity.code.toLowerCase().replace(/[^a-z0-9]/g, "")}@gatesphere.com`}
                            </span>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }}
                              onClick={() => {
                                const email = viewingCommunity.admin_email || `admin.${viewingCommunity.code.toLowerCase().replace(/[^a-z0-9]/g, "")}@gatesphere.com`;
                                navigator.clipboard.writeText(email);
                                setCopiedEmail(true);
                                setTimeout(() => setCopiedEmail(false), 2000);
                              }}
                            >
                              {copiedEmail ? "✓ Copied" : "Copy"}
                            </button>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ color: "var(--muted)", fontWeight: 500 }}>Initial / Standard Password:</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <code
                              style={{
                                background: "#f1f5f9",
                                border: "1px solid #cbd5e1",
                                padding: "0.2rem 0.5rem",
                                borderRadius: "4px",
                                fontWeight: 600,
                                color: "#0f172a",
                                fontSize: "0.85rem",
                                letterSpacing: showPassword ? "normal" : "0.15em",
                              }}
                            >
                              {showPassword ? `${viewingCommunity.code.toLowerCase().replace(/[^a-z0-9]/g, "")}@Gate2026!` : "••••••••••••"}
                            </code>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }}
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? "Hide" : "Show"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }}
                              onClick={() => {
                                const pwd = `${viewingCommunity.code.toLowerCase().replace(/[^a-z0-9]/g, "")}@Gate2026!`;
                                navigator.clipboard.writeText(pwd);
                                setCopiedPassword(true);
                                setTimeout(() => setCopiedPassword(false), 2000);
                              }}
                            >
                              {copiedPassword ? "✓ Copied" : "Copy"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          const codeSlug = viewingCommunity.code.toLowerCase().replace(/[^a-z0-9]/g, "");
                          const email = viewingCommunity.admin_email || `admin.${codeSlug}@gatesphere.com`;
                          const name = viewingCommunity.admin_name || `Admin (${viewingCommunity.name})`;
                          const pwd = `${codeSlug}@Gate2026!`;
                          const text = `GateSphere Enterprise - Community Admin Credentials\nCommunity: ${viewingCommunity.name} (${viewingCommunity.code})\nAdmin Name: ${name}\nLogin Email: ${email}\nInitial Password: ${pwd}\nRole: Community Admin\nPortal Link: ${window.location.origin}/login`;
                          navigator.clipboard.writeText(text);
                          setCopiedAll(true);
                          setTimeout(() => setCopiedAll(false), 2000);
                        }}
                        style={{ fontSize: "0.8rem" }}
                      >
                        {copiedAll ? "✓ All Credentials Copied!" : "📋 Copy All Credentials"}
                      </button>
                      
                    </div>
                  </div>
                )}

                {/* Tab 6: PERSONNEL & ADMINS */}
                {activeTab === "staff" && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                        marginBottom: "1rem",
                      }}
                    >
                      <div style={{ display: "flex", gap: "0.5rem", flex: 1, minWidth: "260px" }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search personnel by name, email, phone..."
                          value={personnelSearch}
                          onChange={(e) => setPersonnelSearch(e.target.value)}
                          style={{ fontSize: "0.85rem", padding: "0.4rem 0.75rem" }}
                        />
                        <select
                          className="form-control"
                          value={personnelRoleFilter}
                          onChange={(e) => setPersonnelRoleFilter(e.target.value)}
                          style={{ fontSize: "0.85rem", padding: "0.4rem 0.65rem", width: "auto" }}
                        >
                          <option value="">All Assigned Roles</option>
                          <option value="community_admin">Community Admin</option>
                          <option value="association_committee">Association Committee</option>
                          <option value="facility_manager">Facility Manager</option>
                          <option value="vendor_technician">Vendor Technician</option>
                          <option value="auditor">Auditor (Read-Only)</option>
                          <option value="domestic_staff">Domestic Staff</option>
                          <option value="security_supervisor">Security Supervisor</option>
                          <option value="security_guard">Security Guard</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setIsAddPersonnelOpen(true)}
                        style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
                      >
                        <span>+</span> Add Personnel / Admin
                      </button>
                    </div>

                    {filteredPersonnel.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "2.5rem 1rem",
                          background: "var(--surface-muted, #f8fafc)",
                          borderRadius: "8px",
                          border: "1px dashed var(--border)",
                        }}
                      >
                        <p style={{ fontWeight: 600, color: "var(--brand-heading)", marginBottom: "0.25rem" }}>
                          No personnel records found
                        </p>
                        <p style={{ fontSize: "0.825rem", color: "var(--muted)", marginBottom: "1rem" }}>
                          No administrators or staff match the current filters for {viewingCommunity.name}.
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setIsAddPersonnelOpen(true)}
                        >
                          + Add Personnel to {viewingCommunity.name}
                        </button>
                      </div>
                    ) : (
                      <div className="table-responsive" style={{ maxHeight: "420px", overflowY: "auto" }}>
                        <table className="table" style={{ width: "100%", fontSize: "0.85rem" }}>
                          <thead>
                            <tr>
                              <th>Personnel / Admin</th>
                              <th>Assigned Role(s)</th>
                              <th>Status</th>
                              <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPersonnel.map((u) => (
                              <tr key={u.id}>
                                <td>
                                  <div>
                                    <div style={{ fontWeight: 600, color: "var(--fg)" }}>{u.full_name}</div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                                      {u.email} {u.phone ? `• ${u.phone}` : ""}
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                                    {u.roles && u.roles.length > 0 ? (
                                      u.roles.map((r) => (
                                        <span
                                          key={r.id}
                                          className="badge badge-primary"
                                          style={{ fontSize: "0.725rem", textTransform: "capitalize" }}
                                        >
                                          {r.role_name || r.role_slug.replace(/_/g, " ")}
                                        </span>
                                      ))
                                    ) : (
                                      <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Unassigned</span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <span
                                    className={`badge ${u.is_active !== false ? "badge-success" : "badge-neutral"}`}
                                    style={{ fontSize: "0.725rem" }}
                                  >
                                    {u.is_active !== false ? "Active" : "Disabled"}
                                  </span>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                                      onClick={() => setEditingPersonnel(u)}
                                    >
                                      Edit Access
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                                      onClick={() => setDeletingPersonnel(u)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Personnel Sub-Modals */}
      {isAddPersonnelOpen && viewingCommunity && (
        <CreateUserModal
          isOpen={isAddPersonnelOpen}
          onClose={() => setIsAddPersonnelOpen(false)}
          preselectedCommunityId={viewingCommunity.id}
          lockCommunity={true}
          onSuccess={() => {
            refreshCommunityDetails(viewingCommunity.id);
          }}
        />
      )}

      {editingPersonnel && viewingCommunity && (
        <EditUserModal
          isOpen={!!editingPersonnel}
          onClose={() => setEditingPersonnel(null)}
          user={editingPersonnel}
          onSuccess={() => {
            refreshCommunityDetails(viewingCommunity.id);
          }}
        />
      )}

      {deletingPersonnel && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingPersonnel(null)}
          title="Delete Personnel Account"
          size="sm"
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingPersonnel(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  try {
                    await usersApi.delete(deletingPersonnel.id);
                    toast.success(`Personnel "${deletingPersonnel.full_name}" deleted.`);
                    setDeletingPersonnel(null);
                    if (viewingCommunity) refreshCommunityDetails(viewingCommunity.id);
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to delete user");
                  }
                }}
              >
                Confirm Delete
              </button>
            </>
          }
        >
          <p style={{ fontSize: "0.9rem" }}>
            Are you sure you want to delete user <strong>{deletingPersonnel.full_name}</strong> ({deletingPersonnel.email})?
            This will revoke all role grants and session tokens for this user.
          </p>
        </Modal>
      )}

      {/* SUB-MODAL: Add Tower */}
      <Modal
        isOpen={isAddTowerOpen}
        onClose={() => setIsAddTowerOpen(false)}
        title="Add Tower / Block"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddTowerOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-tower-form"
              className="btn btn-primary"
              disabled={createTowerMutation.isPending}
            >
              {createTowerMutation.isPending ? "Creating…" : "Create Tower"}
            </button>
          </>
        }
      >
        <form id="add-tower-form" onSubmit={handleSaveTower}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              Tower / Block Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Tower A or Wing 1"
              value={towerName}
              onChange={(e) => setTowerName(e.target.value)}
              required
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              Tower Code <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. TWR-A"
              value={towerCode}
              onChange={(e) => setTowerCode(e.target.value)}
              required
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Total Floors
              </label>
              <input
                type="number"
                min="1"
                max="100"
                className="input-field"
                value={towerFloors}
                onChange={(e) => setTowerFloors(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Structure Type
              </label>
              <select
                className="select-field"
                value={towerType}
                onChange={(e) => setTowerType(e.target.value)}
              >
                <option value="tower">Tower</option>
                <option value="block">Block</option>
                <option value="villa_cluster">Villa Cluster</option>
                <option value="wing">Wing</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* SUB-MODAL: Add Floor */}
      <Modal
        isOpen={isAddFloorOpen}
        onClose={() => setIsAddFloorOpen(false)}
        title="Add Floor Level"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddFloorOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-floor-form"
              className="btn btn-primary"
              disabled={createFloorMutation.isPending}
            >
              {createFloorMutation.isPending ? "Creating…" : "Create Floor"}
            </button>
          </>
        }
      >
        <form id="add-floor-form" onSubmit={handleSaveFloor}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              Select Tower <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <select
              className="select-field"
              value={selectedTowerForFloor}
              onChange={(e) => setSelectedTowerForFloor(e.target.value)}
              required
            >
              {communityTowers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Floor Number <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className="input-field"
                value={floorNumber}
                onChange={(e) => setFloorNumber(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Floor Label (Optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Ground Floor, 1st Floor"
                value={floorLabel}
                onChange={(e) => setFloorLabel(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* SUB-MODAL: Add Unit */}
      <Modal
        isOpen={isAddUnitOpen}
        onClose={() => setIsAddUnitOpen(false)}
        title="Add Unit / Apartment"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddUnitOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-unit-form"
              className="btn btn-primary"
              disabled={createUnitMutation.isPending || !unitFloorId}
            >
              {createUnitMutation.isPending ? "Creating…" : "Create Unit"}
            </button>
          </>
        }
      >
        <form id="add-unit-form" onSubmit={handleSaveUnit}>
          {unitError && (
            <div
              style={{
                padding: "0.6rem 0.8rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-sm, 6px)",
                color: "#b91c1c",
                fontSize: "0.85rem",
                marginBottom: "1rem",
              }}
            >
              ⚠️ {unitError}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Tower <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select
                className="select-field"
                value={unitTowerId}
                onChange={(e) => handleTowerSelectForUnit(e.target.value)}
                required
              >
                <option value="">Select Tower…</option>
                {communityTowers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Floor <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select
                className="select-field"
                value={unitFloorId}
                onChange={(e) => setUnitFloorId(e.target.value)}
                required
                disabled={towerFloorsList.length === 0}
              >
                {towerFloorsList.length === 0 ? (
                  <option value="">No floors found in this tower</option>
                ) : (
                  towerFloorsList.map((f) => (
                    <option key={f.id} value={f.id}>
                      Floor {f.floor_number}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              Unit Number / Identifier <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. A-101, Flat 304, Villa 12"
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Unit Type <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select
                className="select-field"
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                required
              >
                <option value="apartment">Apartment</option>
                <option value="office">Office</option>
                <option value="penthouse">Penthouse</option>
                <option value="shop">Shop</option>
                <option value="studio">Studio</option>
                <option value="villa">Villa</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Bedrooms
              </label>
              <input
                type="number"
                min="0"
                max="10"
                className="input-field"
                value={unitBedrooms}
                onChange={(e) => setUnitBedrooms(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Area (Sq. Ft.)
              </label>
              <input
                type="number"
                min="100"
                max="50000"
                className="input-field"
                value={unitSqFt}
                onChange={(e) => setUnitSqFt(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* SUB-MODAL: Add Resident */}
      <Modal
        isOpen={isAddResidentOpen}
        onClose={() => setIsAddResidentOpen(false)}
        title="👤 Onboard Resident"
        maxWidth={640}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddResidentOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-resident-form"
              className="btn btn-primary"
              disabled={addResidentMutation.isPending}
            >
              {addResidentMutation.isPending ? "Registering…" : "👤 Register Resident"}
            </button>
          </>
        }
      >
        <form id="add-resident-form" onSubmit={handleSaveResident}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* SECTION 1: UNIT & TOWER ALLOCATION */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "0.85rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "#334155" }}>
                🏢 Tower &amp; Unit Selection
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.3rem" }}>
                    Tower / Block
                  </label>
                  <select
                    className="select-field"
                    value={residentTowerId}
                    onChange={(e) => {
                      setResidentTowerId(e.target.value);
                      setResidentUnitId("");
                    }}
                  >
                    <option value="">All Towers ({communityTowers.length})</option>
                    {communityTowers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code || `${t.total_floors} fl`})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.3rem" }}>
                    Target Unit <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <select
                    className="select-field"
                    value={residentUnitId}
                    onChange={(e) => {
                      setResidentUnitId(e.target.value);
                      if (residentFormErrors.residentUnitId) {
                        setResidentFormErrors((prev) => ({ ...prev, residentUnitId: "" }));
                      }
                    }}
                    style={{
                      border: residentFormErrors.residentUnitId ? "1px solid var(--danger, #dc2626)" : undefined,
                    }}
                  >
                    <option value="">Select Unit…</option>
                    {filteredResidentUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unit {u.unit_number} {u.unit_type ? `(${u.unit_type})` : ""} {u.sq_ft ? `• ${u.sq_ft} sqft` : ""}
                      </option>
                    ))}
                  </select>
                  {residentFormErrors.residentUnitId && (
                    <span style={{ fontSize: "0.75rem", color: "var(--danger, #dc2626)", marginTop: "0.25rem", display: "block" }}>
                      {residentFormErrors.residentUnitId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 2: IDENTITY & CONTACT */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "0.85rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "#334155" }}>
                👤 Resident Profile
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.3rem" }}>
                    Full Name <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Ananya Patel"
                    value={residentFullName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setResidentFullName(val);
                      setResidentPassword(generateInitialPassword(val, "resident"));
                      if (residentFormErrors.residentFullName) {
                        setResidentFormErrors((prev) => ({ ...prev, residentFullName: "" }));
                      }
                    }}
                    style={{
                      border: residentFormErrors.residentFullName ? "1px solid var(--danger, #dc2626)" : undefined,
                    }}
                  />
                  {residentFormErrors.residentFullName && (
                    <span style={{ fontSize: "0.75rem", color: "var(--danger, #dc2626)", marginTop: "0.25rem", display: "block" }}>
                      {residentFormErrors.residentFullName}
                    </span>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.3rem" }}>
                    Occupancy Role <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <select
                    className="select-field"
                    value={residentRole}
                    onChange={(e) => {
                      const val = e.target.value;
                      setResidentRole(val);
                      if (val === "secondary_owner") {
                        setResidentIsPrimary(false);
                      } else if (val === "primary_owner") {
                        setResidentIsPrimary(true);
                      }
                    }}
                  >
                    <option value="primary_owner">Primary Owner</option>
                    <option value="secondary_owner">Secondary Owner</option>
                    <option value="tenant">Tenant</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.3rem" }}>
                    Email <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="ananya@example.com"
                    value={residentEmail}
                    onChange={(e) => {
                      setResidentEmail(e.target.value);
                      if (residentFormErrors.residentEmail) {
                        setResidentFormErrors((prev) => ({ ...prev, residentEmail: "" }));
                      }
                    }}
                    style={{
                      border: residentFormErrors.residentEmail ? "1px solid var(--danger, #dc2626)" : undefined,
                    }}
                  />
                  {residentFormErrors.residentEmail && (
                    <span style={{ fontSize: "0.75rem", color: "var(--danger, #dc2626)", marginTop: "0.25rem", display: "block" }}>
                      {residentFormErrors.residentEmail}
                    </span>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.3rem" }}>
                    Phone <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="+91 98765 43210"
                    value={residentPhone}
                    onChange={(e) => {
                      setResidentPhone(e.target.value);
                      if (residentFormErrors.residentPhone) {
                        setResidentFormErrors((prev) => ({ ...prev, residentPhone: "" }));
                      }
                    }}
                    style={{
                      border: residentFormErrors.residentPhone ? "1px solid var(--danger, #dc2626)" : undefined,
                    }}
                  />
                  {residentFormErrors.residentPhone && (
                    <span style={{ fontSize: "0.75rem", color: "var(--danger, #dc2626)", marginTop: "0.25rem", display: "block" }}>
                      {residentFormErrors.residentPhone}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <PasswordField
                  value={residentPassword}
                  onChange={(val) => {
                    setResidentPassword(val);
                    if (residentFormErrors.residentPassword) {
                      setResidentFormErrors((prev) => ({ ...prev, residentPassword: "" }));
                    }
                  }}
                  placeholder="e.g. ananya@Gate2026!"
                  helperText="💡 Providing credentials allows this resident to sign in to the Resident Portal to approve visitors, receive delivery alerts, and book amenities."
                />
                {residentFormErrors.residentPassword && (
                  <span style={{ fontSize: "0.75rem", color: "var(--danger, #dc2626)", marginTop: "0.25rem", display: "block" }}>
                    {residentFormErrors.residentPassword}
                  </span>
                )}
              </div>

              <div
                style={{
                  background: residentIsPrimary ? "#f0fdf4" : "#f8fafc",
                  border: residentIsPrimary ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "0.6rem 0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                }}
                onClick={() => setResidentIsPrimary(!residentIsPrimary)}
              >
                <input
                  type="checkbox"
                  checked={residentIsPrimary}
                  onChange={(e) => setResidentIsPrimary(e.target.checked)}
                  style={{ width: "auto", margin: 0, accentColor: "#16a34a" }}
                  onClick={(e) => e.stopPropagation()}
                />
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: residentIsPrimary ? "#166534" : "#334155" }}>
                  Primary point of contact for gate entries and invoices
                </span>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* SUB-MODAL: Add Gate */}
      <Modal
        isOpen={isAddGateOpen}
        onClose={() => setIsAddGateOpen(false)}
        title="Add Security Gate"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddGateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-gate-form"
              className="btn btn-primary"
              disabled={createGateMutation.isPending}
            >
              {createGateMutation.isPending ? "Creating…" : "Create Gate"}
            </button>
          </>
        }
      >
        <form id="add-gate-form" onSubmit={handleSaveGate}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              Gate Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Main North Entrance, West Gate"
              value={gateName}
              onChange={(e) => setGateName(e.target.value)}
              required
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Gate Code <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. GATE-01"
                value={gateCode}
                onChange={(e) => setGateCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Gate Type <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select
                className="select-field"
                value={gateType}
                onChange={(e) => setGateType(e.target.value as "entry" | "exit" | "both" | "pedestrian")}
              >
                <option value="both">Entry & Exit (Both)</option>
                <option value="entry">Entry Only</option>
                <option value="exit">Exit Only</option>
                <option value="pedestrian">Pedestrian Only</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
