"use client";

import { useState } from "react";
import { useUiStore } from "@/store/ui";
import {
  useCommunityDetails,
  useTowers,
  useFloors,
  useUnits,
  useGates,
  useCreateTower,
  useUpdateTower,
  useDeleteTower,
  useCreateFloor,
  useUpdateFloor,
  useDeleteFloor,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
  useCreateGate,
  useUpdateGate,
  useDeleteGate,
} from "@/hooks/use-communities";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FilterPanel } from "@/components/common/FilterPanel";
import { Modal } from "@/components/common/Modal";
import type { Tower, Floor, Unit, Gate } from "@/types/communities";
import { toast } from "@/store/toast";

export default function CommunityAdminPropertyPage() {
  const { activeCommunityId } = useUiStore();
  const [activeTab, setActiveTab] = useState<"towers" | "floors" | "units" | "gates">("towers");
  const [selectedTowerId, setSelectedTowerId] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // Queries
  const { data: community } = useCommunityDetails(activeCommunityId || undefined);
  const {
    data: towers,
    isLoading: towersLoading,
    refetch: refetchTowers,
  } = useTowers(activeCommunityId || undefined);
  const {
    data: gates,
    isLoading: gatesLoading,
    refetch: refetchGates,
  } = useGates(activeCommunityId || undefined);

  // Set default tower if none selected
  const currentTowerId = selectedTowerId || (towers && towers.length > 0 ? towers[0].id : "");
  const {
    data: floors,
    isLoading: floorsLoading,
    refetch: refetchFloors,
  } = useFloors(currentTowerId || undefined);

  // Set default floor if none selected
  const currentFloorId = selectedFloorId || (floors && floors.length > 0 ? floors[0].id : "");
  const {
    data: units,
    isLoading: unitsLoading,
    refetch: refetchUnits,
  } = useUnits(currentFloorId || undefined);

  // Mutations
  const createTower = useCreateTower();
  const updateTower = useUpdateTower();
  const deleteTower = useDeleteTower();

  const createFloor = useCreateFloor();
  const updateFloor = useUpdateFloor();
  const deleteFloor = useDeleteFloor();

  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const deleteUnit = useDeleteUnit();

  const createGate = useCreateGate();
  const updateGate = useUpdateGate();
  const deleteGate = useDeleteGate();

  // Create modals state
  const [isAddTowerOpen, setIsAddTowerOpen] = useState(false);
  const [isAddFloorOpen, setIsAddFloorOpen] = useState(false);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [isAddGateOpen, setIsAddGateOpen] = useState(false);

  // Edit modals state
  const [editingTower, setEditingTower] = useState<Tower | null>(null);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editingGate, setEditingGate] = useState<Gate | null>(null);

  // Delete modals state
  const [deletingTower, setDeletingTower] = useState<Tower | null>(null);
  const [deletingFloor, setDeletingFloor] = useState<Floor | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
  const [deletingGate, setDeletingGate] = useState<Gate | null>(null);

  // Create Form states
  const [towerForm, setTowerForm] = useState<{
    name: string;
    code: string;
    structure_type: string;
    total_floors: number | string;
  }>({
    name: "",
    code: "",
    structure_type: "tower",
    total_floors: 10,
  });
  const [floorForm, setFloorForm] = useState<{
    tower_id: string;
    floor_number: number | string;
    label: string;
  }>({ tower_id: "", floor_number: 1, label: "" });
  const [unitForm, setUnitForm] = useState<{
    floor_id: string;
    unit_number: string;
    unit_type: string;
    bedrooms: number | string;
    area_sqft: number | string;
  }>({
    floor_id: "",
    unit_number: "",
    unit_type: "apartment",
    bedrooms: 2,
    area_sqft: 1200,
  });
  const [gateForm, setGateForm] = useState({ name: "", code: "", gate_type: "main" });

  // Edit Form states
  const [editTowerForm, setEditTowerForm] = useState<{
    name: string;
    code: string;
    structure_type: string;
    total_floors: number | string;
  }>({
    name: "",
    code: "",
    structure_type: "tower",
    total_floors: 10,
  });
  const [editFloorForm, setEditFloorForm] = useState<{
    floor_number: number | string;
    label: string;
  }>({ floor_number: 1, label: "" });
  const [editUnitForm, setEditUnitForm] = useState<{
    unit_number: string;
    unit_type: string;
    bedrooms: number | string;
    area_sqft: number | string;
  }>({
    unit_number: "",
    unit_type: "apartment",
    bedrooms: 2,
    area_sqft: 1200,
  });
  const [editGateForm, setEditGateForm] = useState<{
    name: string;
    code: string;
    gate_type: Gate["gate_type"];
    is_active: boolean;
  }>({
    name: "",
    code: "",
    gate_type: "main",
    is_active: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [propertyFieldErrors, setPropertyFieldErrors] = useState<Record<string, string>>({});

  // -------------------------------------------------------------
  // TOWERS: CREATE, EDIT, DELETE HANDLERS
  // -------------------------------------------------------------

  const handleCreateTower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) {
      setErrorMessage("No active community selected.");
      return;
    }

    const errors: Record<string, string> = {};
    const trimmedName = towerForm.name.trim();
    const trimmedCode = towerForm.code.trim();
    const floorsVal =
      typeof towerForm.total_floors === "string"
        ? towerForm.total_floors.trim()
        : towerForm.total_floors;

    if (!trimmedName) {
      errors.tower_name = "Tower name is required.";
    } else if (trimmedName.length < 2 || trimmedName.length > 128) {
      errors.tower_name = "Tower name must be between 2 and 128 characters.";
    } else if (!/[A-Za-z]/.test(trimmedName)) {
      errors.tower_name = "Tower name must contain letters and cannot be purely numeric or symbols.";
    } else if (!/^[A-Za-z0-9][A-Za-z0-9 \-_.,&()'/]*$/.test(trimmedName)) {
      errors.tower_name =
        "Tower name must start with a letter or number and contain only valid characters.";
    }

    if (!trimmedCode) {
      errors.tower_code = "Block / Tower code is required.";
    } else if (trimmedCode.length < 1 || trimmedCode.length > 32) {
      errors.tower_code = "Block / Tower code must be between 1 and 32 characters.";
    } else if (!/^[A-Za-z0-9][A-Za-z0-9 _\-\/]*$/.test(trimmedCode)) {
      errors.tower_code =
        "Block code must start with a letter or number and contain only valid characters.";
    }

    const validStructureTypes = ["tower", "block", "villa_cluster", "wing"];
    if (!validStructureTypes.includes(towerForm.structure_type)) {
      errors.structure_type = "Please select a valid structure type.";
    }

    if (floorsVal === "" || floorsVal === undefined || floorsVal === null) {
      errors.total_floors = "Total floors is required.";
    } else {
      const numFloors = Number(floorsVal);
      if (isNaN(numFloors) || !Number.isInteger(numFloors)) {
        errors.total_floors = "Total floors must be a whole number (e.g. 10).";
      } else if (numFloors < 1 || numFloors > 300) {
        errors.total_floors = "Total floors must be between 1 and 300.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setPropertyFieldErrors(errors);
      setErrorMessage(Object.values(errors)[0]);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setPropertyFieldErrors({});
      await createTower.mutateAsync({
        communityId: activeCommunityId,
        data: {
          name: trimmedName,
          code: trimmedCode.toUpperCase(),
          structure_type: towerForm.structure_type,
          total_floors: Number(floorsVal),
        },
      });
      toast.success(`Tower "${trimmedName}" created successfully.`, "Tower Created");
      setIsAddTowerOpen(false);
      setPropertyFieldErrors({});
      setTowerForm({ name: "", code: "", structure_type: "tower", total_floors: 10 });
      refetchTowers();
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error ? err.message : "Failed to create tower");
      setErrorMessage(msg);
      toast.error(msg, "Tower Creation Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditTower = (tower: Tower) => {
    setEditingTower(tower);
    setEditTowerForm({
      name: tower.name || "",
      code: tower.code || "",
      structure_type: tower.structure_type || "tower",
      total_floors: tower.total_floors ?? 1,
    });
    setErrorMessage(null);
    setPropertyFieldErrors({});
  };

  const handleUpdateTower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTower) return;

    const errors: Record<string, string> = {};
    const trimmedName = editTowerForm.name.trim();
    const trimmedCode = editTowerForm.code.trim();
    const floorsVal =
      typeof editTowerForm.total_floors === "string"
        ? editTowerForm.total_floors.trim()
        : editTowerForm.total_floors;

    if (!trimmedName) {
      errors.tower_name = "Tower name is required.";
    } else if (trimmedName.length < 2 || trimmedName.length > 128) {
      errors.tower_name = "Tower name must be between 2 and 128 characters.";
    }

    if (!trimmedCode) {
      errors.tower_code = "Block / Tower code is required.";
    } else if (trimmedCode.length < 1 || trimmedCode.length > 32) {
      errors.tower_code = "Block / Tower code must be between 1 and 32 characters.";
    }

    if (floorsVal === "" || floorsVal === undefined || floorsVal === null) {
      errors.total_floors = "Total floors is required.";
    } else {
      const numFloors = Number(floorsVal);
      if (isNaN(numFloors) || !Number.isInteger(numFloors) || numFloors < 1 || numFloors > 300) {
        errors.total_floors = "Total floors must be between 1 and 300.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setPropertyFieldErrors(errors);
      setErrorMessage(Object.values(errors)[0]);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await updateTower.mutateAsync({
        id: editingTower.id,
        communityId: activeCommunityId || undefined,
        data: {
          name: trimmedName,
          code: trimmedCode.toUpperCase(),
          structure_type: editTowerForm.structure_type,
          total_floors: Number(floorsVal),
        },
      });
      toast.success(`Tower "${trimmedName}" updated successfully.`, "Tower Updated");
      setEditingTower(null);
      setPropertyFieldErrors({});
      refetchTowers();
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error ? err.message : "Failed to update tower");
      setErrorMessage(msg);
      toast.error(msg, "Tower Update Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTower = async () => {
    if (!deletingTower) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await deleteTower.mutateAsync({
        id: deletingTower.id,
        communityId: activeCommunityId || undefined,
      });
      toast.success(`Tower "${deletingTower.name}" deleted successfully.`, "Tower Deleted");
      setDeletingTower(null);
      if (selectedTowerId === deletingTower.id) {
        setSelectedTowerId("");
        setSelectedFloorId("");
      }
      refetchTowers();
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error ? err.message : "Failed to delete tower");
      setErrorMessage(msg);
      toast.error(msg, "Tower Deletion Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // FLOORS: CREATE, EDIT, DELETE HANDLERS
  // -------------------------------------------------------------

  const handleCreateFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    const towerId = floorForm.tower_id || currentTowerId;
    if (!towerId) {
      setErrorMessage("Please select a target tower.");
      return;
    }

    const errors: Record<string, string> = {};
    const fVal =
      typeof floorForm.floor_number === "string"
        ? floorForm.floor_number.trim()
        : floorForm.floor_number;

    if (fVal === "" || fVal === undefined || fVal === null) {
      errors.floor_number = "Floor number is required.";
    } else {
      const fNum = Number(fVal);
      if (isNaN(fNum) || !Number.isInteger(fNum)) {
        errors.floor_number = "Floor number must be an integer (e.g. 1, 0, -1).";
      } else if (fNum < -10 || fNum > 300) {
        errors.floor_number = "Floor number must be between -10 and 300.";
      }
    }

    if (floorForm.label && floorForm.label.trim().length > 40) {
      errors.floor_label = "Floor label cannot exceed 40 characters.";
    }

    if (Object.keys(errors).length > 0) {
      setPropertyFieldErrors(errors);
      setErrorMessage(Object.values(errors)[0]);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await createFloor.mutateAsync({
        tower_id: towerId,
        floor_number: Number(fVal),
        label: floorForm.label ? floorForm.label.trim() : undefined,
      });
      toast.success(`Floor #${fVal} added successfully.`, "Floor Added");
      setIsAddFloorOpen(false);
      setPropertyFieldErrors({});
      setFloorForm({ tower_id: "", floor_number: 1, label: "" });
      refetchFloors();
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error ? err.message : "Failed to create floor");
      setErrorMessage(msg);
      toast.error(msg, "Floor Creation Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditFloor = (floor: Floor) => {
    setEditingFloor(floor);
    setEditFloorForm({
      floor_number: floor.floor_number ?? 1,
      label: floor.label || "",
    });
    setErrorMessage(null);
    setPropertyFieldErrors({});
  };

  const handleUpdateFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFloor) return;

    const errors: Record<string, string> = {};
    const fVal =
      typeof editFloorForm.floor_number === "string"
        ? editFloorForm.floor_number.trim()
        : editFloorForm.floor_number;

    if (fVal === "" || fVal === undefined || fVal === null) {
      errors.floor_number = "Floor number is required.";
    } else {
      const fNum = Number(fVal);
      if (isNaN(fNum) || !Number.isInteger(fNum) || fNum < -10 || fNum > 300) {
        errors.floor_number = "Floor number must be between -10 and 300.";
      }
    }

    if (editFloorForm.label && editFloorForm.label.trim().length > 40) {
      errors.floor_label = "Floor label cannot exceed 40 characters.";
    }

    if (Object.keys(errors).length > 0) {
      setPropertyFieldErrors(errors);
      setErrorMessage(Object.values(errors)[0]);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await updateFloor.mutateAsync({
        id: editingFloor.id,
        tower_id: editingFloor.tower_id,
        data: {
          floor_number: Number(fVal),
          label: editFloorForm.label ? editFloorForm.label.trim() : undefined,
        },
      });
      toast.success(`Floor #${fVal} updated successfully.`, "Floor Updated");
      setEditingFloor(null);
      setPropertyFieldErrors({});
      refetchFloors();
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error ? err.message : "Failed to update floor");
      setErrorMessage(msg);
      toast.error(msg, "Floor Update Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFloor = async () => {
    if (!deletingFloor) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await deleteFloor.mutateAsync({
        id: deletingFloor.id,
        tower_id: deletingFloor.tower_id,
      });
      toast.success(`Floor #${deletingFloor.floor_number} deleted successfully.`, "Floor Deleted");
      setDeletingFloor(null);
      if (selectedFloorId === deletingFloor.id) {
        setSelectedFloorId("");
      }
      refetchFloors();
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error ? err.message : "Failed to delete floor");
      setErrorMessage(msg);
      toast.error(msg, "Floor Deletion Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // UNITS: CREATE, EDIT, DELETE HANDLERS
  // -------------------------------------------------------------

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const floorId = unitForm.floor_id || currentFloorId;
    if (!floorId) {
      setErrorMessage("Please select a target floor.");
      return;
    }

    const errors: Record<string, string> = {};
    const trimmedUnitNumber = unitForm.unit_number.trim();

    if (!trimmedUnitNumber) {
      errors.unit_number = "Unit number is required.";
    } else if (trimmedUnitNumber.length > 32) {
      errors.unit_number = "Unit number cannot exceed 32 characters.";
    } else if (!/^[A-Za-z0-9][A-Za-z0-9 \-_./]*$/.test(trimmedUnitNumber)) {
      errors.unit_number =
        "Unit number must start with a letter or number and contain valid characters.";
    }

    if (unitForm.bedrooms !== "" && unitForm.bedrooms !== undefined && unitForm.bedrooms !== null) {
      const bNum = Number(unitForm.bedrooms);
      if (isNaN(bNum) || !Number.isInteger(bNum) || bNum < 0 || bNum > 20) {
        errors.bedrooms = "Bedrooms must be a whole number between 0 and 20.";
      }
    }

    if (unitForm.area_sqft !== "" && unitForm.area_sqft !== undefined && unitForm.area_sqft !== null) {
      const aNum = Number(unitForm.area_sqft);
      if (isNaN(aNum) || aNum <= 0 || aNum > 1000000) {
        errors.area_sqft = "Area must be a positive number up to 1,000,000 sq ft.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setPropertyFieldErrors(errors);
      setErrorMessage(Object.values(errors)[0]);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await createUnit.mutateAsync({
        floor_id: floorId,
        unit_number: trimmedUnitNumber,
        unit_type: unitForm.unit_type,
        bedrooms:
          unitForm.bedrooms !== "" && unitForm.bedrooms !== undefined
            ? Number(unitForm.bedrooms)
            : undefined,
        area_sqft:
          unitForm.area_sqft !== "" && unitForm.area_sqft !== undefined
            ? Number(unitForm.area_sqft)
            : undefined,
      });
      toast.success(`Unit "${trimmedUnitNumber}" created successfully.`, "Unit Created");
      setIsAddUnitOpen(false);
      setPropertyFieldErrors({});
      setUnitForm({
        floor_id: "",
        unit_number: "",
        unit_type: "apartment",
        bedrooms: 2,
        area_sqft: 1200,
      });
      refetchUnits();
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error ? err.message : "Failed to create unit");
      setErrorMessage(msg);
      toast.error(msg, "Unit Creation Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    setEditUnitForm({
      unit_number: unit.unit_number || "",
      unit_type: unit.unit_type || "apartment",
      bedrooms: unit.bedrooms !== undefined ? unit.bedrooms : 2,
      area_sqft: unit.sq_ft ?? unit.area_sqft ?? 1200,
    });
    setErrorMessage(null);
    setPropertyFieldErrors({});
  };

  const handleUpdateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit) return;

    const errors: Record<string, string> = {};
    const trimmedUnitNumber = editUnitForm.unit_number.trim();

    if (!trimmedUnitNumber) {
      errors.unit_number = "Unit number is required.";
    } else if (trimmedUnitNumber.length > 32) {
      errors.unit_number = "Unit number cannot exceed 32 characters.";
    }

    if (editUnitForm.bedrooms !== "" && editUnitForm.bedrooms !== undefined) {
      const bNum = Number(editUnitForm.bedrooms);
      if (isNaN(bNum) || !Number.isInteger(bNum) || bNum < 0 || bNum > 20) {
        errors.bedrooms = "Bedrooms must be a whole number between 0 and 20.";
      }
    }

    if (editUnitForm.area_sqft !== "" && editUnitForm.area_sqft !== undefined) {
      const aNum = Number(editUnitForm.area_sqft);
      if (isNaN(aNum) || aNum <= 0 || aNum > 1000000) {
        errors.area_sqft = "Area must be a positive number up to 1,000,000 sq ft.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setPropertyFieldErrors(errors);
      setErrorMessage(Object.values(errors)[0]);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await updateUnit.mutateAsync({
        id: editingUnit.id,
        floor_id: editingUnit.floor_id,
        data: {
          unit_number: trimmedUnitNumber,
          unit_type: editUnitForm.unit_type,
          bedrooms:
            editUnitForm.bedrooms !== "" && editUnitForm.bedrooms !== undefined
              ? Number(editUnitForm.bedrooms)
              : undefined,
          area_sqft:
            editUnitForm.area_sqft !== "" && editUnitForm.area_sqft !== undefined
              ? Number(editUnitForm.area_sqft)
              : undefined,
        },
      });
      toast.success(`Unit "${trimmedUnitNumber}" updated successfully.`, "Unit Updated");
      setEditingUnit(null);
      setPropertyFieldErrors({});
      refetchUnits();
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error ? err.message : "Failed to update unit");
      setErrorMessage(msg);
      toast.error(msg, "Unit Update Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUnit = async () => {
    if (!deletingUnit) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await deleteUnit.mutateAsync({
        id: deletingUnit.id,
        floor_id: deletingUnit.floor_id,
      });
      toast.success(`Unit "${deletingUnit.unit_number}" deleted successfully.`, "Unit Deleted");
      setDeletingUnit(null);
      refetchUnits();
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error ? err.message : "Failed to delete unit");
      setErrorMessage(msg);
      toast.error(msg, "Unit Deletion Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // GATES: CREATE, EDIT, DELETE HANDLERS
  // -------------------------------------------------------------

  const handleCreateGate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) {
      setErrorMessage("No active community selected.");
      return;
    }

    const errors: Record<string, string> = {};
    const trimmedName = gateForm.name.trim();
    const trimmedCode = gateForm.code.trim();

    if (!trimmedName) {
      errors.gate_name = "Gate name is required.";
    } else if (trimmedName.length < 2 || trimmedName.length > 120) {
      errors.gate_name = "Gate name must be between 2 and 120 characters.";
    } else if (!/^[A-Za-z0-9][A-Za-z0-9 \-_.,&()'/]*$/.test(trimmedName)) {
      errors.gate_name =
        "Gate name must start with a letter or number and contain only valid characters.";
    }

    if (!trimmedCode) {
      errors.gate_code = "Gate code is required.";
    } else if (trimmedCode.length < 1 || trimmedCode.length > 32) {
      errors.gate_code = "Gate code must be between 1 and 32 characters.";
    } else if (!/^[A-Za-z0-9][A-Za-z0-9 _\-\/]*$/.test(trimmedCode)) {
      errors.gate_code =
        "Gate code must start with a letter or number and contain only valid characters.";
    }

    if (Object.keys(errors).length > 0) {
      setPropertyFieldErrors(errors);
      setErrorMessage(Object.values(errors)[0]);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await createGate.mutateAsync({
        communityId: activeCommunityId,
        data: {
          name: trimmedName,
          code: trimmedCode.toUpperCase(),
          gate_type: gateForm.gate_type,
        },
      });
      toast.success(`Security gate "${trimmedName}" registered successfully.`, "Gate Created");
      setIsAddGateOpen(false);
      setPropertyFieldErrors({});
      setGateForm({ name: "", code: "", gate_type: "main" });
      refetchGates();
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error ? err.message : "Failed to create security gate");
      setErrorMessage(msg);
      toast.error(msg, "Gate Creation Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditGate = (gate: Gate) => {
    setEditingGate(gate);
    setEditGateForm({
      name: gate.name || "",
      code: gate.code || "",
      gate_type: gate.gate_type || "main",
      is_active: gate.is_active ?? true,
    });
    setErrorMessage(null);
    setPropertyFieldErrors({});
  };

  const handleUpdateGate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGate) return;

    const errors: Record<string, string> = {};
    const trimmedName = editGateForm.name.trim();

    if (!trimmedName) {
      errors.gate_name = "Gate name is required.";
    } else if (trimmedName.length < 2 || trimmedName.length > 120) {
      errors.gate_name = "Gate name must be between 2 and 120 characters.";
    }

    if (Object.keys(errors).length > 0) {
      setPropertyFieldErrors(errors);
      setErrorMessage(Object.values(errors)[0]);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await updateGate.mutateAsync({
        id: editingGate.id,
        communityId: activeCommunityId || undefined,
        data: {
          // `code` is immutable after creation — `GateUpdate` rejects it (GS-020).
          name: trimmedName,
          gate_type: editGateForm.gate_type,
          is_active: editGateForm.is_active,
        },
      });
      toast.success(`Security gate "${trimmedName}" updated successfully.`, "Gate Updated");
      setEditingGate(null);
      setPropertyFieldErrors({});
      refetchGates();
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error ? err.message : "Failed to update security gate");
      setErrorMessage(msg);
      toast.error(msg, "Gate Update Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGate = async () => {
    if (!deletingGate) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await deleteGate.mutateAsync({
        id: deletingGate.id,
        communityId: activeCommunityId || undefined,
      });
      toast.success(`Security gate "${deletingGate.name}" deleted successfully.`, "Gate Deleted");
      setDeletingGate(null);
      refetchGates();
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error ? err.message : "Failed to delete security gate");
      setErrorMessage(msg);
      toast.error(msg, "Gate Deletion Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // TABLE COLUMNS DEFINITIONS
  // -------------------------------------------------------------

  // Towers Columns
  const towerColumns: Column<Tower>[] = [
    { key: "name", header: "Tower / Block Name", render: (t) => <strong>{t.name}</strong> },
    {
      key: "code",
      header: "Code",
      render: (t) => <span className="badge badge-neutral">{t.code || "–"}</span>,
    },
    {
      key: "structure_type",
      header: "Structure",
      render: (t) => (
        <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>
          {t.structure_type || "Tower"}
        </span>
      ),
    },
    { key: "total_floors", header: "Floors", render: (t) => t.total_floors ?? "–" },
    {
      key: "total_units",
      header: "Units",
      render: (t) => (
        <span
          className={`badge ${t.total_units && t.total_units > 0 ? "badge-info" : "badge-neutral"}`}
          style={{ fontSize: "0.8rem", fontWeight: 600 }}
        >
          {t.total_units !== undefined ? `${t.total_units} unit${t.total_units === 1 ? "" : "s"}` : "0 units"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (t) => (
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTowerId(t.id);
              setActiveTab("floors");
            }}
          >
            View Floors →
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
            onClick={(e) => {
              e.stopPropagation();
              openEditTower(t);
            }}
            title="Edit Tower"
          >
            ✏️ Edit
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              fontSize: "0.75rem",
              padding: "0.25rem 0.6rem",
              color: "#b91c1c",
              borderColor: "#fecaca",
              background: "#fff5f5",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setDeletingTower(t);
              setErrorMessage(null);
            }}
            title="Delete Tower"
          >
            🗑️ Delete
          </button>
        </div>
      ),
    },
  ];

  // Floors Columns
  const floorColumns: Column<Floor>[] = [
    {
      key: "floor_number",
      header: "Floor #",
      render: (f) => (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <strong>Floor {f.floor_number}</strong>
          {(f as any).label && (
            <span className="badge badge-neutral" style={{ fontSize: "0.75rem" }}>
              {(f as any).label}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "total_units",
      header: "Total Units",
      render: (f) => (
        <span
          className={`badge ${f.total_units && f.total_units > 0 ? "badge-info" : "badge-neutral"}`}
          style={{ fontSize: "0.8rem", fontWeight: 600 }}
        >
          {f.total_units !== undefined ? `${f.total_units} unit${f.total_units === 1 ? "" : "s"}` : "0 units"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (f) => (
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
            onClick={(e) => {
              e.stopPropagation();
              if (f.tower_id) setSelectedTowerId(f.tower_id);
              setSelectedFloorId(f.id);
              setActiveTab("units");
            }}
          >
            View Units ({f.total_units ?? 0}) →
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
            onClick={(e) => {
              e.stopPropagation();
              openEditFloor(f);
            }}
            title="Edit Floor"
          >
            ✏️ Edit
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              fontSize: "0.75rem",
              padding: "0.25rem 0.6rem",
              color: "#b91c1c",
              borderColor: "#fecaca",
              background: "#fff5f5",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setDeletingFloor(f);
              setErrorMessage(null);
            }}
            title="Delete Floor"
          >
            🗑️ Delete
          </button>
        </div>
      ),
    },
  ];

  // Units Columns
  const unitColumns: Column<Unit>[] = [
    {
      key: "unit_number",
      header: "Unit Number",
      render: (u) => <strong>Unit {u.unit_number}</strong>,
    },
    {
      key: "unit_type",
      header: "Type",
      render: (u) => (
        <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>
          {u.unit_type || "Standard"}
        </span>
      ),
    },
    {
      key: "bedrooms",
      header: "Bedrooms (BHK)",
      render: (u) => (u.bedrooms !== undefined && u.bedrooms !== null ? `${u.bedrooms} BHK` : "–"),
    },
    {
      key: "sq_ft",
      header: "Area",
      render: (u) => (u.sq_ft ?? u.area_sqft ? `${u.sq_ft ?? u.area_sqft} sq ft` : "–"),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <span className={`badge ${u.is_occupied ? "badge-success" : "badge-neutral"}`}>
          {u.is_occupied ? "Occupied" : "Vacant"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (u) => (
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
            onClick={(e) => {
              e.stopPropagation();
              openEditUnit(u);
            }}
            title="Edit Unit"
          >
            ✏️ Edit
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              fontSize: "0.75rem",
              padding: "0.25rem 0.6rem",
              color: "#b91c1c",
              borderColor: "#fecaca",
              background: "#fff5f5",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setDeletingUnit(u);
              setErrorMessage(null);
            }}
            title="Delete Unit"
          >
            🗑️ Delete
          </button>
        </div>
      ),
    },
  ];

  // Gates Columns
  const gateColumns: Column<Gate>[] = [
    { key: "name", header: "Gate Name", render: (g) => <strong>{g.name}</strong> },
    {
      key: "code",
      header: "Code",
      render: (g) => <span className="badge badge-neutral">{g.code || "–"}</span>,
    },
    {
      key: "gate_type",
      header: "Gate Type",
      render: (g) => (
        <span className="badge badge-primary" style={{ textTransform: "capitalize" }}>
          {g.gate_type}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Operational Status",
      render: (g) => (
        <span className={`badge ${g.is_active ? "badge-success" : "badge-danger"}`}>
          {g.is_active ? "Active" : "Closed"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (g) => (
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
            onClick={(e) => {
              e.stopPropagation();
              openEditGate(g);
            }}
            title="Edit Gate"
          >
            ✏️ Edit
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              fontSize: "0.75rem",
              padding: "0.25rem 0.6rem",
              color: "#b91c1c",
              borderColor: "#fecaca",
              background: "#fff5f5",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setDeletingGate(g);
              setErrorMessage(null);
            }}
            title="Delete Gate"
          >
            🗑️ Delete
          </button>
        </div>
      ),
    },
  ];

  const filteredTowers = towers?.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.code?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <PageHeader
        title="Property & Infrastructure"
        description="Community hierarchy, residential blocks, floors, and individual apartment units."
        action={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {activeTab === "towers" && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setErrorMessage(null);
                  setPropertyFieldErrors({});
                  setTowerForm({ name: "", code: "", structure_type: "tower", total_floors: 10 });
                  setIsAddTowerOpen(true);
                }}
              >
                + Add Tower
              </button>
            )}
            {activeTab === "floors" && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setErrorMessage(null);
                  setPropertyFieldErrors({});
                  setFloorForm((f) => ({ ...f, tower_id: currentTowerId }));
                  setIsAddFloorOpen(true);
                }}
              >
                + Add Floor
              </button>
            )}
            {activeTab === "units" && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setErrorMessage(null);
                  setPropertyFieldErrors({});
                  setUnitForm((u) => ({ ...u, floor_id: currentFloorId }));
                  setIsAddUnitOpen(true);
                }}
              >
                + Add Unit
              </button>
            )}
            {activeTab === "gates" && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setErrorMessage(null);
                  setPropertyFieldErrors({});
                  setIsAddGateOpen(true);
                }}
              >
                + Add Gate
              </button>
            )}
          </div>
        }
      />

      {/* Community Summary Header Card */}
      {community && (
        <div className="card" style={{ background: "#f8fafc", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{community.name}</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                {community.city ? `${community.city}, ` : ""}
                {community.state || "Community Registered"} · Code:{" "}
                <strong>{community.code}</strong>
              </p>
            </div>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{towers?.length || 0}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Towers</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{gates?.length || 0}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Security Gates</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: "1.5rem" }}>
        <button
          type="button"
          onClick={() => setActiveTab("towers")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "towers" ? 700 : 500,
            color: activeTab === "towers" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "towers" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          🏢 Towers & Blocks ({towers?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("floors")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "floors" ? 700 : 500,
            color: activeTab === "floors" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "floors" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          📑 Floors Structure
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("units")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "units" ? 700 : 500,
            color: activeTab === "units" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "units" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          🚪 Residential Units
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("gates")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "gates" ? 700 : 500,
            color: activeTab === "gates" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "gates" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          🛡️ Security Gates ({gates?.length || 0})
        </button>
      </div>

      {/* Tab: Towers */}
      {activeTab === "towers" && (
        <div>
          <FilterPanel
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search towers by name or code..."
          />
          <DataTable
            columns={towerColumns}
            data={filteredTowers as (Tower & Record<string, unknown>)[]}
            isLoading={towersLoading}
            emptyTitle="No towers found"
            emptyDescription="No residential towers registered for this community."
            enableClientPagination={true}
          />
        </div>
      )}

      {/* Tab: Floors */}
      {activeTab === "floors" && (
        <div>
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}
          >
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--fg-secondary)" }}>
              Select Tower:
            </span>
            <select
              className="select-field"
              style={{ maxWidth: 260 }}
              value={currentTowerId}
              onChange={(e) => {
                setSelectedTowerId(e.target.value);
                setSelectedFloorId("");
              }}
            >
              {towers?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code || "No code"})
                </option>
              ))}
            </select>
          </div>

          <DataTable
            columns={floorColumns}
            data={floors as (Floor & Record<string, unknown>)[]}
            isLoading={floorsLoading}
            emptyTitle="No floors registered"
            emptyDescription="Add floors to this tower to configure residential units."
            enableClientPagination={true}
          />
        </div>
      )}

      {/* Tab: Units */}
      {activeTab === "units" && (
        <div>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--fg-secondary)" }}>
                Tower:
              </span>
              <select
                className="select-field"
                style={{ maxWidth: 200 }}
                value={currentTowerId}
                onChange={(e) => {
                  setSelectedTowerId(e.target.value);
                  setSelectedFloorId("");
                }}
              >
                {towers?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--fg-secondary)" }}>
                Floor:
              </span>
              <select
                className="select-field"
                style={{ maxWidth: 180 }}
                value={currentFloorId}
                onChange={(e) => setSelectedFloorId(e.target.value)}
              >
                {floors?.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    Floor {f.floor_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DataTable
            columns={unitColumns}
            data={units as (Unit & Record<string, unknown>)[]}
            isLoading={unitsLoading}
            emptyTitle="No units on this floor"
            emptyDescription="Add residential apartments or commercial units to this floor."
            enableClientPagination={true}
          />
        </div>
      )}

      {/* Tab: Gates */}
      {activeTab === "gates" && (
        <DataTable
          columns={gateColumns}
          data={gates as (Gate & Record<string, unknown>)[]}
          isLoading={gatesLoading}
          emptyTitle="No security gates configured"
          emptyDescription="Register vehicle and pedestrian entry/exit checkpoints."
          enableClientPagination={true}
        />
      )}

      {/* ========================================================================= */}
      {/* ADD MODALS                                                                */}
      {/* ========================================================================= */}

      {/* Add Tower Modal */}
      <Modal
        isOpen={isAddTowerOpen}
        onClose={() => {
          setIsAddTowerOpen(false);
          setPropertyFieldErrors({});
          setErrorMessage(null);
        }}
        title="Add Residential Tower / Block"
      >
        <form
          noValidate
          onSubmit={handleCreateTower}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {errorMessage && (
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
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="tower-name-input"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Tower Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="tower-name-input"
              type="text"
              className="input-field"
              placeholder="e.g. Tower A / Block 1"
              value={towerForm.name}
              style={{
                borderColor: propertyFieldErrors.tower_name ? "#ef4444" : undefined,
                boxShadow: propertyFieldErrors.tower_name ? "0 0 0 1px #ef4444" : undefined,
              }}
              aria-invalid={!!propertyFieldErrors.tower_name}
              onChange={(e) => {
                setTowerForm({ ...towerForm, name: e.target.value });
                if (propertyFieldErrors.tower_name) {
                  setPropertyFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.tower_name;
                    return next;
                  });
                }
              }}
            />
            {propertyFieldErrors.tower_name ? (
              <span
                style={{
                  color: "#ef4444",
                  fontSize: "0.75rem",
                  marginTop: "0.25rem",
                  display: "block",
                }}
              >
                {propertyFieldErrors.tower_name}
              </span>
            ) : (
              <span
                style={{
                  color: "var(--muted)",
                  fontSize: "0.75rem",
                  marginTop: "0.25rem",
                  display: "block",
                }}
              >
                2–128 characters (alphanumeric, spaces, hyphens).
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                htmlFor="tower-code-input"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Block / Tower Code <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="tower-code-input"
                type="text"
                className="input-field"
                placeholder="e.g. T-A"
                value={towerForm.code}
                style={{
                  borderColor: propertyFieldErrors.tower_code ? "#ef4444" : undefined,
                  boxShadow: propertyFieldErrors.tower_code ? "0 0 0 1px #ef4444" : undefined,
                }}
                aria-invalid={!!propertyFieldErrors.tower_code}
                onChange={(e) => {
                  setTowerForm({ ...towerForm, code: e.target.value });
                  if (propertyFieldErrors.tower_code) {
                    setPropertyFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.tower_code;
                      return next;
                    });
                  }
                }}
              />
              {propertyFieldErrors.tower_code ? (
                <span
                  style={{
                    color: "#ef4444",
                    fontSize: "0.75rem",
                    marginTop: "0.25rem",
                    display: "block",
                  }}
                >
                  {propertyFieldErrors.tower_code}
                </span>
              ) : (
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.75rem",
                    marginTop: "0.25rem",
                    display: "block",
                  }}
                >
                  1–32 letters/numbers, hyphens, slashes.
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="tower-structure-type-select"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Structure Type <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                id="tower-structure-type-select"
                className="select-field"
                value={towerForm.structure_type}
                style={{
                  borderColor: propertyFieldErrors.structure_type ? "#ef4444" : undefined,
                }}
                aria-invalid={!!propertyFieldErrors.structure_type}
                onChange={(e) => {
                  setTowerForm({ ...towerForm, structure_type: e.target.value });
                  if (propertyFieldErrors.structure_type) {
                    setPropertyFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.structure_type;
                      return next;
                    });
                  }
                }}
              >
                <option value="tower">Tower</option>
                <option value="block">Block</option>
                <option value="villa_cluster">Villa Cluster</option>
                <option value="wing">Wing</option>
              </select>
              {propertyFieldErrors.structure_type && (
                <span
                  style={{
                    color: "#ef4444",
                    fontSize: "0.75rem",
                    marginTop: "0.25rem",
                    display: "block",
                  }}
                >
                  {propertyFieldErrors.structure_type}
                </span>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="tower-total-floors-input"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Total Floors <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="tower-total-floors-input"
              type="number"
              className="input-field"
              min={1}
              max={300}
              placeholder="e.g. 10 (1–300)"
              value={towerForm.total_floors}
              style={{
                borderColor: propertyFieldErrors.total_floors ? "#ef4444" : undefined,
                boxShadow: propertyFieldErrors.total_floors ? "0 0 0 1px #ef4444" : undefined,
              }}
              aria-invalid={!!propertyFieldErrors.total_floors}
              onChange={(e) => {
                setTowerForm({ ...towerForm, total_floors: e.target.value });
                if (propertyFieldErrors.total_floors) {
                  setPropertyFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.total_floors;
                    return next;
                  });
                }
              }}
            />
            {propertyFieldErrors.total_floors ? (
              <span
                style={{
                  color: "#ef4444",
                  fontSize: "0.75rem",
                  marginTop: "0.25rem",
                  display: "block",
                }}
              >
                {propertyFieldErrors.total_floors}
              </span>
            ) : (
              <span
                style={{
                  color: "var(--muted)",
                  fontSize: "0.75rem",
                  marginTop: "0.25rem",
                  display: "block",
                }}
              >
                Positive whole number from 1 to 300.
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
              onClick={() => {
                setIsAddTowerOpen(false);
                setPropertyFieldErrors({});
                setErrorMessage(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Save Tower"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Floor Modal */}
      <Modal
        isOpen={isAddFloorOpen}
        onClose={() => setIsAddFloorOpen(false)}
        title="Add Floor to Tower"
      >
        <form
          noValidate
          onSubmit={handleCreateFloor}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {errorMessage && (
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
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="floor-tower-select"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Tower / Block <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              id="floor-tower-select"
              className="select-field"
              value={floorForm.tower_id || currentTowerId}
              onChange={(e) => setFloorForm({ ...floorForm, tower_id: e.target.value })}
            >
              {towers?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code || "No code"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="floor-number-input"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Floor Number <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="floor-number-input"
              type="number"
              className="input-field"
              placeholder="e.g. 1 (0 for ground, -1 for basement)"
              value={floorForm.floor_number}
              style={{
                borderColor: propertyFieldErrors.floor_number ? "#ef4444" : undefined,
                boxShadow: propertyFieldErrors.floor_number ? "0 0 0 1px #ef4444" : undefined,
              }}
              aria-invalid={!!propertyFieldErrors.floor_number}
              onChange={(e) => {
                setFloorForm({ ...floorForm, floor_number: e.target.value });
                if (propertyFieldErrors.floor_number) {
                  setPropertyFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.floor_number;
                    return next;
                  });
                }
              }}
            />
            {propertyFieldErrors.floor_number ? (
              <span
                style={{
                  color: "#ef4444",
                  fontSize: "0.75rem",
                  marginTop: "0.25rem",
                  display: "block",
                }}
              >
                {propertyFieldErrors.floor_number}
              </span>
            ) : (
              <span
                style={{
                  color: "var(--muted)",
                  fontSize: "0.75rem",
                  marginTop: "0.25rem",
                  display: "block",
                }}
              >
                Whole number between -10 and 300.
              </span>
            )}
          </div>

          <div>
            <label
              htmlFor="floor-label-input"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Floor Label (Optional)
            </label>
            <input
              id="floor-label-input"
              type="text"
              className="input-field"
              placeholder="e.g. 1st Floor / Ground Floor"
              value={floorForm.label}
              style={{
                borderColor: propertyFieldErrors.floor_label ? "#ef4444" : undefined,
                boxShadow: propertyFieldErrors.floor_label ? "0 0 0 1px #ef4444" : undefined,
              }}
              aria-invalid={!!propertyFieldErrors.floor_label}
              onChange={(e) => {
                setFloorForm({ ...floorForm, label: e.target.value });
                if (propertyFieldErrors.floor_label) {
                  setPropertyFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.floor_label;
                    return next;
                  });
                }
              }}
            />
            {propertyFieldErrors.floor_label && (
              <span
                style={{
                  color: "#ef4444",
                  fontSize: "0.75rem",
                  marginTop: "0.25rem",
                  display: "block",
                }}
              >
                {propertyFieldErrors.floor_label}
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
              onClick={() => setIsAddFloorOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Save Floor"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Unit Modal */}
      <Modal
        isOpen={isAddUnitOpen}
        onClose={() => setIsAddUnitOpen(false)}
        title="Add Residential Unit"
      >
        <form
          noValidate
          onSubmit={handleCreateUnit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {errorMessage && (
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
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="unit-floor-select"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Floor <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              id="unit-floor-select"
              className="select-field"
              value={unitForm.floor_id || currentFloorId}
              onChange={(e) => setUnitForm({ ...unitForm, floor_id: e.target.value })}
            >
              {floors?.map((f: any) => (
                <option key={f.id} value={f.id}>
                  Floor {f.floor_number}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                htmlFor="unit-number-input"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Unit Number <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="unit-number-input"
                type="text"
                className="input-field"
                placeholder="e.g. 101 / A-204"
                value={unitForm.unit_number}
                style={{
                  borderColor: propertyFieldErrors.unit_number ? "#ef4444" : undefined,
                  boxShadow: propertyFieldErrors.unit_number ? "0 0 0 1px #ef4444" : undefined,
                }}
                aria-invalid={!!propertyFieldErrors.unit_number}
                onChange={(e) => {
                  setUnitForm({ ...unitForm, unit_number: e.target.value });
                  if (propertyFieldErrors.unit_number) {
                    setPropertyFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.unit_number;
                      return next;
                    });
                  }
                }}
              />
              {propertyFieldErrors.unit_number && (
                <span
                  style={{
                    color: "#ef4444",
                    fontSize: "0.75rem",
                    marginTop: "0.25rem",
                    display: "block",
                  }}
                >
                  {propertyFieldErrors.unit_number}
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="unit-type-select"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Unit Type <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                id="unit-type-select"
                className="select-field"
                value={unitForm.unit_type}
                onChange={(e) => setUnitForm({ ...unitForm, unit_type: e.target.value })}
              >
                <option value="apartment">Apartment</option>
                <option value="penthouse">Penthouse</option>
                <option value="duplex">Duplex</option>
                <option value="studio">Studio</option>
                <option value="villa">Villa</option>
                <option value="shop">Shop</option>
                <option value="office">Office</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                htmlFor="unit-bedrooms-input"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Bedrooms (BHK)
              </label>
              <input
                id="unit-bedrooms-input"
                type="number"
                min={0}
                max={20}
                className="input-field"
                placeholder="e.g. 2 (0-20)"
                value={unitForm.bedrooms}
                style={{
                  borderColor: propertyFieldErrors.bedrooms ? "#ef4444" : undefined,
                  boxShadow: propertyFieldErrors.bedrooms ? "0 0 0 1px #ef4444" : undefined,
                }}
                aria-invalid={!!propertyFieldErrors.bedrooms}
                onChange={(e) => {
                  setUnitForm({ ...unitForm, bedrooms: e.target.value });
                  if (propertyFieldErrors.bedrooms) {
                    setPropertyFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.bedrooms;
                      return next;
                    });
                  }
                }}
              />
              {propertyFieldErrors.bedrooms && (
                <span
                  style={{
                    color: "#ef4444",
                    fontSize: "0.75rem",
                    marginTop: "0.25rem",
                    display: "block",
                  }}
                >
                  {propertyFieldErrors.bedrooms}
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="unit-area-sqft-input"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Area (sq ft)
              </label>
              <input
                id="unit-area-sqft-input"
                type="number"
                min={1}
                max={1000000}
                className="input-field"
                placeholder="e.g. 1200"
                value={unitForm.area_sqft}
                style={{
                  borderColor: propertyFieldErrors.area_sqft ? "#ef4444" : undefined,
                  boxShadow: propertyFieldErrors.area_sqft ? "0 0 0 1px #ef4444" : undefined,
                }}
                aria-invalid={!!propertyFieldErrors.area_sqft}
                onChange={(e) => {
                  setUnitForm({ ...unitForm, area_sqft: e.target.value });
                  if (propertyFieldErrors.area_sqft) {
                    setPropertyFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.area_sqft;
                      return next;
                    });
                  }
                }}
              />
              {propertyFieldErrors.area_sqft && (
                <span
                  style={{
                    color: "#ef4444",
                    fontSize: "0.75rem",
                    marginTop: "0.25rem",
                    display: "block",
                  }}
                >
                  {propertyFieldErrors.area_sqft}
                </span>
              )}
            </div>
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
              onClick={() => setIsAddUnitOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Save Unit"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Gate Modal */}
      <Modal
        isOpen={isAddGateOpen}
        onClose={() => setIsAddGateOpen(false)}
        title="Add Security Gate"
      >
        <form
          noValidate
          onSubmit={handleCreateGate}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {errorMessage && (
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
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="gate-name-input"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Gate Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="gate-name-input"
              type="text"
              className="input-field"
              placeholder="e.g. Main North Entry Gate"
              value={gateForm.name}
              style={{
                borderColor: propertyFieldErrors.gate_name ? "#ef4444" : undefined,
                boxShadow: propertyFieldErrors.gate_name ? "0 0 0 1px #ef4444" : undefined,
              }}
              aria-invalid={!!propertyFieldErrors.gate_name}
              onChange={(e) => {
                setGateForm({ ...gateForm, name: e.target.value });
                if (propertyFieldErrors.gate_name) {
                  setPropertyFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.gate_name;
                    return next;
                  });
                }
              }}
            />
            {propertyFieldErrors.gate_name && (
              <span
                style={{
                  color: "#ef4444",
                  fontSize: "0.75rem",
                  marginTop: "0.25rem",
                  display: "block",
                }}
              >
                {propertyFieldErrors.gate_name}
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                htmlFor="gate-code-input"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Gate Code <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="gate-code-input"
                type="text"
                className="input-field"
                placeholder="e.g. GATE-01"
                value={gateForm.code}
                style={{
                  borderColor: propertyFieldErrors.gate_code ? "#ef4444" : undefined,
                  boxShadow: propertyFieldErrors.gate_code ? "0 0 0 1px #ef4444" : undefined,
                }}
                aria-invalid={!!propertyFieldErrors.gate_code}
                onChange={(e) => {
                  setGateForm({ ...gateForm, code: e.target.value });
                  if (propertyFieldErrors.gate_code) {
                    setPropertyFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.gate_code;
                      return next;
                    });
                  }
                }}
              />
              {propertyFieldErrors.gate_code && (
                <span
                  style={{
                    color: "#ef4444",
                    fontSize: "0.75rem",
                    marginTop: "0.25rem",
                    display: "block",
                  }}
                >
                  {propertyFieldErrors.gate_code}
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="gate-type-select"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Gate Direction / Type <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                id="gate-type-select"
                className="select-field"
                value={gateForm.gate_type}
                onChange={(e) => setGateForm({ ...gateForm, gate_type: e.target.value })}
              >
                <option value="main">Main Gate (Entry & Exit)</option>
                <option value="service">Service Gate</option>
                <option value="visitor">Visitor Gate</option>
                <option value="pedestrian">Pedestrian Gate</option>
                <option value="emergency">Emergency Gate</option>
                <option value="both">Both (Entry & Exit)</option>
                <option value="entry">Entry Only</option>
                <option value="exit">Exit Only</option>
              </select>
            </div>
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
              onClick={() => setIsAddGateOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Save Gate"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* EDIT MODALS                                                               */}
      {/* ========================================================================= */}

      {/* Edit Tower Modal */}
      <Modal
        isOpen={Boolean(editingTower)}
        onClose={() => setEditingTower(null)}
        title="Edit Residential Tower / Block"
      >
        <form
          noValidate
          onSubmit={handleUpdateTower}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {errorMessage && (
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
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="edit-tower-name-input"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Tower Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="edit-tower-name-input"
              type="text"
              className="input-field"
              placeholder="e.g. Tower A"
              value={editTowerForm.name}
              style={{
                borderColor: propertyFieldErrors.tower_name ? "#ef4444" : undefined,
              }}
              onChange={(e) => setEditTowerForm({ ...editTowerForm, name: e.target.value })}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                htmlFor="edit-tower-code-input"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Block / Tower Code <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="edit-tower-code-input"
                type="text"
                className="input-field"
                placeholder="e.g. T-A"
                value={editTowerForm.code}
                style={{
                  borderColor: propertyFieldErrors.tower_code ? "#ef4444" : undefined,
                }}
                onChange={(e) => setEditTowerForm({ ...editTowerForm, code: e.target.value })}
              />
            </div>

            <div>
              <label
                htmlFor="edit-tower-structure-type-select"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Structure Type <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                id="edit-tower-structure-type-select"
                className="select-field"
                value={editTowerForm.structure_type}
                onChange={(e) =>
                  setEditTowerForm({ ...editTowerForm, structure_type: e.target.value })
                }
              >
                <option value="tower">Tower</option>
                <option value="block">Block</option>
                <option value="villa_cluster">Villa Cluster</option>
                <option value="wing">Wing</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="edit-tower-total-floors-input"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Total Floors <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="edit-tower-total-floors-input"
              type="number"
              className="input-field"
              min={1}
              max={300}
              value={editTowerForm.total_floors}
              onChange={(e) =>
                setEditTowerForm({ ...editTowerForm, total_floors: e.target.value })
              }
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
              onClick={() => setEditingTower(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Update Tower"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Floor Modal */}
      <Modal
        isOpen={Boolean(editingFloor)}
        onClose={() => setEditingFloor(null)}
        title="Edit Floor Structure"
      >
        <form
          noValidate
          onSubmit={handleUpdateFloor}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {errorMessage && (
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
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="edit-floor-number-input"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Floor Number <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="edit-floor-number-input"
              type="number"
              className="input-field"
              value={editFloorForm.floor_number}
              onChange={(e) =>
                setEditFloorForm({ ...editFloorForm, floor_number: e.target.value })
              }
            />
          </div>

          <div>
            <label
              htmlFor="edit-floor-label-input"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Floor Label (Optional)
            </label>
            <input
              id="edit-floor-label-input"
              type="text"
              className="input-field"
              placeholder="e.g. 1st Floor / Ground Floor"
              value={editFloorForm.label}
              onChange={(e) => setEditFloorForm({ ...editFloorForm, label: e.target.value })}
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
              onClick={() => setEditingFloor(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Update Floor"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Unit Modal */}
      <Modal
        isOpen={Boolean(editingUnit)}
        onClose={() => setEditingUnit(null)}
        title="Edit Residential Unit"
      >
        <form
          noValidate
          onSubmit={handleUpdateUnit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {errorMessage && (
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
              {errorMessage}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                htmlFor="edit-unit-number-input"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Unit Number <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="edit-unit-number-input"
                type="text"
                className="input-field"
                value={editUnitForm.unit_number}
                onChange={(e) =>
                  setEditUnitForm({ ...editUnitForm, unit_number: e.target.value })
                }
              />
            </div>

            <div>
              <label
                htmlFor="edit-unit-type-select"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Unit Type <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                id="edit-unit-type-select"
                className="select-field"
                value={editUnitForm.unit_type}
                onChange={(e) => setEditUnitForm({ ...editUnitForm, unit_type: e.target.value })}
              >
                <option value="apartment">Apartment</option>
                <option value="penthouse">Penthouse</option>
                <option value="duplex">Duplex</option>
                <option value="studio">Studio</option>
                <option value="villa">Villa</option>
                <option value="shop">Shop</option>
                <option value="office">Office</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                htmlFor="edit-unit-bedrooms-input"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Bedrooms (BHK)
              </label>
              <input
                id="edit-unit-bedrooms-input"
                type="number"
                min={0}
                max={20}
                className="input-field"
                value={editUnitForm.bedrooms}
                onChange={(e) => setEditUnitForm({ ...editUnitForm, bedrooms: e.target.value })}
              />
            </div>

            <div>
              <label
                htmlFor="edit-unit-area-sqft-input"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Area (sq ft)
              </label>
              <input
                id="edit-unit-area-sqft-input"
                type="number"
                min={1}
                max={1000000}
                className="input-field"
                value={editUnitForm.area_sqft}
                onChange={(e) => setEditUnitForm({ ...editUnitForm, area_sqft: e.target.value })}
              />
            </div>
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
              onClick={() => setEditingUnit(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Update Unit"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Gate Modal */}
      <Modal
        isOpen={Boolean(editingGate)}
        onClose={() => setEditingGate(null)}
        title="Edit Security Gate"
      >
        <form
          noValidate
          onSubmit={handleUpdateGate}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {errorMessage && (
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
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="edit-gate-name-input"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Gate Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="edit-gate-name-input"
              type="text"
              className="input-field"
              value={editGateForm.name}
              onChange={(e) => setEditGateForm({ ...editGateForm, name: e.target.value })}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                htmlFor="edit-gate-code-input"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Gate Code
              </label>
              <input
                id="edit-gate-code-input"
                type="text"
                className="input-field"
                value={editGateForm.code}
                readOnly
                disabled
                aria-describedby="edit-gate-code-hint"
              />
              <p
                id="edit-gate-code-hint"
                style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}
              >
                Gate code can&apos;t be changed after the gate is created.
              </p>
            </div>

            <div>
              <label
                htmlFor="edit-gate-type-select"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Gate Direction / Type <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                id="edit-gate-type-select"
                className="select-field"
                value={editGateForm.gate_type}
                onChange={(e) => setEditGateForm({ ...editGateForm, gate_type: e.target.value as Gate["gate_type"] })}
              >
                <option value="main">Main Gate (Entry & Exit)</option>
                <option value="service">Service Gate</option>
                <option value="visitor">Visitor Gate</option>
                <option value="pedestrian">Pedestrian Gate</option>
                <option value="emergency">Emergency Gate</option>
                <option value="both">Both (Entry & Exit)</option>
                <option value="entry">Entry Only</option>
                <option value="exit">Exit Only</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
            <input
              id="edit-gate-is-active"
              type="checkbox"
              checked={editGateForm.is_active}
              onChange={(e) => setEditGateForm({ ...editGateForm, is_active: e.target.checked })}
              style={{ cursor: "pointer", width: 16, height: 16 }}
            />
            <label
              htmlFor="edit-gate-is-active"
              style={{ fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}
            >
              Operational / Active Gate Checkpoint
            </label>
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
              onClick={() => setEditingGate(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Update Gate"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODALS WITH DEPENDENCY SAFEGUARDS                      */}
      {/* ========================================================================= */}

      {/* Delete Tower Modal */}
      <Modal
        isOpen={Boolean(deletingTower)}
        onClose={() => {
          setDeletingTower(null);
          setErrorMessage(null);
        }}
        title="⚠️ Delete Residential Tower"
      >
        {deletingTower && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-sm)",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🏢</span>
                <strong style={{ fontSize: "0.95rem", color: "#991b1b" }}>
                  Permanent Action &amp; Dependency Cascade
                </strong>
              </div>
              <p style={{ fontSize: "0.85rem", color: "#7f1d1d", margin: 0, lineHeight: 1.5 }}>
                You are about to permanently delete tower <strong>{deletingTower.name}</strong>{" "}
                ({deletingTower.code || "No code"}).
              </p>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#991b1b",
                  background: "#fff",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "4px",
                  border: "1px solid #fecaca",
                  marginTop: "0.25rem",
                }}
              >
                <strong>⚠️ Dependency Impact Warning:</strong>
                <ul style={{ margin: "0.3rem 0 0 1.2rem", padding: 0 }}>
                  <li>
                    All <strong>{deletingTower.total_floors ?? 0} floor(s)</strong> and{" "}
                    <strong>{deletingTower.total_units ?? 0} unit(s)</strong> belonging to this
                    tower will be permanently removed.
                  </li>
                  <li>
                    Any linked owner/tenant occupancies, broadcast groups, flat billing entries,
                    and vehicle slot associations will be removed or cascade-deleted.
                  </li>
                </ul>
              </div>
            </div>

            {errorMessage && (
              <div
                style={{
                  padding: "0.6rem 0.85rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "var(--radius-sm)",
                  color: "#b91c1c",
                  fontSize: "0.85rem",
                }}
              >
                {errorMessage}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingTower(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteTower}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Deleting…" : "Yes, Delete Tower"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Floor Modal */}
      <Modal
        isOpen={Boolean(deletingFloor)}
        onClose={() => {
          setDeletingFloor(null);
          setErrorMessage(null);
        }}
        title="⚠️ Delete Floor Structure"
      >
        {deletingFloor && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-sm)",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>📑</span>
                <strong style={{ fontSize: "0.95rem", color: "#991b1b" }}>
                  Permanent Action &amp; Unit Cascade
                </strong>
              </div>
              <p style={{ fontSize: "0.85rem", color: "#7f1d1d", margin: 0, lineHeight: 1.5 }}>
                You are about to permanently delete <strong>Floor {deletingFloor.floor_number}</strong>
                {deletingFloor.label ? ` (${deletingFloor.label})` : ""}.
              </p>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#991b1b",
                  background: "#fff",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "4px",
                  border: "1px solid #fecaca",
                  marginTop: "0.25rem",
                }}
              >
                <strong>⚠️ Dependency Impact Warning:</strong>
                <p style={{ margin: "0.25rem 0 0 0" }}>
                  Deleting this floor will permanently remove all{" "}
                  <strong>{deletingFloor.total_units ?? 0} residential unit(s)</strong> configured on
                  this floor.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div
                style={{
                  padding: "0.6rem 0.85rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "var(--radius-sm)",
                  color: "#b91c1c",
                  fontSize: "0.85rem",
                }}
              >
                {errorMessage}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingFloor(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteFloor}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Deleting…" : "Yes, Delete Floor"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Unit Modal */}
      <Modal
        isOpen={Boolean(deletingUnit)}
        onClose={() => {
          setDeletingUnit(null);
          setErrorMessage(null);
        }}
        title="⚠️ Delete Residential Unit"
      >
        {deletingUnit && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-sm)",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🚪</span>
                <strong style={{ fontSize: "0.95rem", color: "#991b1b" }}>
                  Permanent Action &amp; Tenancy Removal
                </strong>
              </div>
              <p style={{ fontSize: "0.85rem", color: "#7f1d1d", margin: 0, lineHeight: 1.5 }}>
                You are about to permanently delete <strong>Unit {deletingUnit.unit_number}</strong>{" "}
                ({deletingUnit.unit_type || "apartment"}).
              </p>
              {deletingUnit.is_occupied ? (
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#991b1b",
                    background: "#fff",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "4px",
                    border: "2px solid #ef4444",
                    marginTop: "0.25rem",
                  }}
                >
                  <strong>🚨 CRITICAL OCCUPANCY WARNING:</strong>
                  <p style={{ margin: "0.25rem 0 0 0" }}>
                    This unit is currently marked as <strong>OCCUPIED</strong>. Deleting this unit will
                    remove active resident tenancy mappings, revoke owner/tenant app access, and delete
                    associated flat maintenance billing entries.
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: "0.8rem", color: "#991b1b", margin: 0 }}>
                  This vacant unit will be removed from the community hierarchy and floor structure.
                </p>
              )}
            </div>

            {errorMessage && (
              <div
                style={{
                  padding: "0.6rem 0.85rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "var(--radius-sm)",
                  color: "#b91c1c",
                  fontSize: "0.85rem",
                }}
              >
                {errorMessage}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingUnit(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteUnit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Deleting…" : "Yes, Delete Unit"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Gate Modal */}
      <Modal
        isOpen={Boolean(deletingGate)}
        onClose={() => {
          setDeletingGate(null);
          setErrorMessage(null);
        }}
        title="⚠️ Delete Security Gate"
      >
        {deletingGate && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-sm)",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🛡️</span>
                <strong style={{ fontSize: "0.95rem", color: "#991b1b" }}>
                  Permanent Action &amp; Gate De-registration
                </strong>
              </div>
              <p style={{ fontSize: "0.85rem", color: "#7f1d1d", margin: 0, lineHeight: 1.5 }}>
                You are about to permanently delete security gate <strong>{deletingGate.name}</strong>{" "}
                ({deletingGate.code}).
              </p>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#991b1b",
                  background: "#fff",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "4px",
                  border: "1px solid #fecaca",
                  marginTop: "0.25rem",
                }}
              >
                <strong>⚠️ Checkpoint Warning:</strong>
                <p style={{ margin: "0.25rem 0 0 0" }}>
                  This will remove the checkpoint from guard station rosters, QR scanner assignments,
                  and future visitor logging.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div
                style={{
                  padding: "0.6rem 0.85rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "var(--radius-sm)",
                  color: "#b91c1c",
                  fontSize: "0.85rem",
                }}
              >
                {errorMessage}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingGate(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteGate}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Deleting…" : "Yes, Delete Gate"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
