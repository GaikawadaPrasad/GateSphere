"use client";

import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/common/Modal";
import { toast } from "@/store/toast";
import {
  useCreateCommunity,
  useCreateTower,
  useCreateFloor,
  useCreateUnit,
} from "@/hooks/use-communities";
import {
  INDIAN_STATES_AND_UTS,
  POPULAR_CITIES_BY_STATE,
  getCitiesForState,
  validateCityForState,
  findStateForCity,
  isValidCommunityName,
  isValidCityName,
  isValidPersonName,
} from "@/constants/locations";
import { PasswordField } from "@/components/forms/PasswordField";
import { generateInitialPassword, PHONE_10_DIGIT_RE, toPhoneDigits } from "@/lib/utils";

interface CreateCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (adminInfo?: {
    communityName: string;
    communityCode: string;
    adminName: string;
    adminEmail: string;
    adminPassword?: string;
  }) => void;
  initialName?: string;
  initialCode?: string;
}

type Step = "community" | "towers" | "floors" | "units";

interface TowerEntry {
  id: string;
  name: string;
  code: string;
  total_floors: number;
  units_per_floor: number;
}

interface FloorEntry {
  id: string;
  tower_id: string;
  floor_number: number;
  label: string;
}

interface UnitEntry {
  id: string;
  floor_id: string;
  unit_number: string;
  unit_type?: string;
}

const STEP_LIST: Step[] = ["community", "towers", "floors", "units"];
const STEP_LABELS: Record<Step, string> = {
  community: "1. Community",
  towers: "2. Towers",
  floors: "3. Floors",
  units: "4. Units",
};

const STRUCTURE_TYPES = [
  { value: "tower", label: "Tower" },
  { value: "block", label: "Block" },
  { value: "villa_cluster", label: "Villa Cluster" },
  { value: "wing", label: "Wing" },
];

const UNIT_TYPES = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "penthouse", label: "Penthouse" },
  { value: "studio", label: "Studio" },
  { value: "shop", label: "Shop" },
  { value: "office", label: "Office" },
];

export function generateUnitNumber(
  floorNumber: number,
  unitIndex: number,
  towerCode = "",
  style: "numeric" | "tower_prefix" | "alpha" = "numeric",
): string {
  const paddedUnit = unitIndex < 10 ? `0${unitIndex}` : `${unitIndex}`;
  if (style === "tower_prefix") {
    return `${towerCode ? `${towerCode}-` : ""}${floorNumber}${paddedUnit}`;
  }
  if (style === "alpha") {
    return `${floorNumber}${String.fromCharCode(64 + unitIndex)}`;
  }
  // Default numeric: e.g. Floor 1, unit 1 -> 101; Floor 11, unit 1 -> 1101
  return `${floorNumber}${paddedUnit}`;
}

export function CreateCommunityModal({
  isOpen,
  onClose,
  onSuccess,
  initialName = "",
  initialCode = "",
}: CreateCommunityModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("community");
  const [createdCommunityId, setCreatedCommunityId] = useState<string>("");

  // Step 1: Community & Admin
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [customCity, setCustomCity] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Step 2: Towers
  const [towerName, setTowerName] = useState("");
  const [towerCode, setTowerCode] = useState("");
  const [towerFloors, setTowerFloors] = useState(11);
  const [unitsPerFloorInput, setUnitsPerFloorInput] = useState(4);
  const [unitTypeInput, setUnitTypeInput] = useState("apartment");
  const [towerType, setTowerType] = useState("tower");
  const [autoGenerateAll, setAutoGenerateAll] = useState(true);
  const [addedTowers, setAddedTowers] = useState<TowerEntry[]>([]);
  const [towerError, setTowerError] = useState("");
  const [towerTouched, setTowerTouched] = useState<Record<string, boolean>>({});
  const [isProcessingTower, setIsProcessingTower] = useState(false);
  const [creationProgressText, setCreationProgressText] = useState("");

  // Step 3: Floors
  const [selectedTowerId, setSelectedTowerId] = useState("");
  const [floorNumber, setFloorNumber] = useState(1);
  const [floorLabel, setFloorLabel] = useState("");
  const [floorUnitsCount, setFloorUnitsCount] = useState(4);
  const [addedFloors, setAddedFloors] = useState<FloorEntry[]>([]);
  const [floorError, setFloorError] = useState("");
  const [isAddingFloorUnits, setIsAddingFloorUnits] = useState(false);

  // Step 4: Units
  const [unitFormatStyle, setUnitFormatStyle] = useState<"numeric" | "tower_prefix" | "alpha">(
    "numeric",
  );
  const [defaultUnitType, setDefaultUnitType] = useState("apartment");
  const [defaultBedrooms, setDefaultBedrooms] = useState(2);
  const [defaultSqft, setDefaultSqft] = useState(1200);
  const [addedUnits, setAddedUnits] = useState<UnitEntry[]>([]);
  const [unitError, setUnitError] = useState("");

  // Manual Unit Entry in Step 4
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [manualUnitNumber, setManualUnitNumber] = useState("");
  const [manualUnitType, setManualUnitType] = useState("apartment");
  const [manualBedrooms, setManualBedrooms] = useState(2);
  const [manualSqft, setManualSqft] = useState(1200);

  const createCommunityMutation = useCreateCommunity();
  const createTowerMutation = useCreateTower();
  const createFloorMutation = useCreateFloor();
  const createUnitMutation = useCreateUnit();

  useEffect(() => {
    if (isOpen) {
      setStep("community");
      setCreatedCommunityId("");
      setName(initialName);
      setCode(initialCode);
      setCity(initialName ? "Bengaluru" : "");
      setState(initialName ? "Karnataka" : "");
      setIsCustomCity(false);
      setCustomCity("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword(generateInitialPassword("Admin"));
      setAdminPhone("");
      setFormError("");
      setTouched({});
      setAddedTowers([]);
      setAddedFloors([]);
      setAddedUnits([]);
      setTowerName("");
      setTowerCode("");
      setTowerFloors(11);
      setUnitsPerFloorInput(4);
      setUnitTypeInput("apartment");
      setTowerType("tower");
      setAutoGenerateAll(true);
      setTowerError("");
      setTowerTouched({});
      setSelectedTowerId("");
      setFloorNumber(1);
      setFloorLabel("");
      setFloorUnitsCount(4);
      setFloorError("");
      setSelectedFloorId("");
      setUnitFormatStyle("numeric");
      setDefaultUnitType("apartment");
      setDefaultBedrooms(2);
      setDefaultSqft(1200);
      setManualUnitNumber("");
      setManualUnitType("apartment");
      setManualBedrooms(2);
      setManualSqft(1200);
      setUnitError("");
      setIsProcessingTower(false);
      setCreationProgressText("");
      setIsAddingFloorUnits(false);
    }
  }, [isOpen, initialName, initialCode]);

  const createErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const trimmedName = name.trim();
    if (!trimmedName) errs.name = "Community name is required";
    else if (trimmedName.length < 2) errs.name = "Community name must be at least 2 characters";
    else if (trimmedName.length > 255) errs.name = "Community name cannot exceed 255 characters";
    else if (!isValidCommunityName(trimmedName))
      errs.name = "Community name contains invalid characters";

    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) errs.code = "Community code is required";
    else if (trimmedCode.length < 2 || trimmedCode.length > 32)
      errs.code = "Code must be between 2 and 32 characters";
    else if (!/^[A-Z0-9][A-Z0-9_\-\/]*$/.test(trimmedCode))
      errs.code =
        "Code must start with alphanumeric and only contain letters, numbers, hyphens or underscores";

    const trimmedState = state.trim();
    if (!trimmedState) {
      errs.state = "State / UT is required";
    } else if (trimmedState.length > 120) {
      errs.state = "State cannot exceed 120 characters";
    }

    const trimmedCity = city.trim();
    if (!trimmedCity) {
      errs.city = "City is required";
    } else if (trimmedCity.length > 120) {
      errs.city = "City cannot exceed 120 characters";
    } else if (!isValidCityName(trimmedCity)) {
      errs.city = "City must contain only alphabetical letters and spaces";
    } else if (trimmedState) {
      const stateMismatch = validateCityForState(trimmedCity, trimmedState);
      if (stateMismatch) {
        errs.city = stateMismatch;
      }
    }

    // Community Admin Account is REQUIRED
    const trimmedAdminName = adminName.trim();
    if (!trimmedAdminName) {
      errs.adminName = "Admin full name is required";
    } else if (trimmedAdminName.length < 2) {
      errs.adminName = "Admin name must be at least 2 characters";
    } else if (!isValidPersonName(trimmedAdminName)) {
      errs.adminName = "Admin name must contain only alphabetic letters and spaces";
    }

    const trimmedAdminEmail = adminEmail.trim();
    if (!trimmedAdminEmail) {
      errs.adminEmail = "Admin email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedAdminEmail)) {
      errs.adminEmail = "Please enter a valid email address";
    }

    if (!adminPassword) {
      errs.adminPassword = "Password is required for admin account";
    } else if (adminPassword.length < 10) {
      errs.adminPassword = "Password must be at least 10 characters";
    } else if (adminPassword.length > 200) {
      errs.adminPassword = "Password cannot exceed 200 characters";
    }

    const trimmedAdminPhone = adminPhone.trim();
    if (trimmedAdminPhone && !PHONE_10_DIGIT_RE.test(trimmedAdminPhone)) {
      errs.adminPhone = "Admin phone must be exactly 10 digits";
    }

    return errs;
  }, [name, code, city, state, adminEmail, adminName, adminPassword, adminPhone]);

  const isCreateFormValid = Object.keys(createErrors).length === 0;

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setTouched({
      name: true,
      code: true,
      city: true,
      state: true,
      adminName: true,
      adminEmail: true,
      adminPassword: true,
      adminPhone: true,
    });
    if (!isCreateFormValid) {
      setFormError(Object.values(createErrors)[0] || "Please fix validation errors.");
      return;
    }
    try {
      const result = await createCommunityMutation.mutateAsync({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        admin_name: adminName.trim() || undefined,
        admin_email: adminEmail.trim() || undefined,
        admin_password: adminPassword || undefined,
        admin_phone: adminPhone.trim() || undefined,
      });
      setCreatedCommunityId(result.id);
      toast.success(`Community "${name.trim()}" created successfully!`);
      // Immediately invalidate queries so dashboard shows it without reload
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["communities"], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" }),
      ]);
      setStep("towers");
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create community. Ensure code is unique.",
      );
    }
  };

  // Helper: batch create floors and auto-generate units for each floor
  const autoCreateFloorsAndUnits = async (
    towerId: string,
    tCode: string,
    totalFloorsCount: number,
    unitsEachFloor: number,
    uType: string,
  ): Promise<{ floors: FloorEntry[]; units: UnitEntry[] }> => {
    const createdFloors: FloorEntry[] = [];
    const createdUnits: UnitEntry[] = [];
    const validUnitType = ["apartment", "villa", "penthouse", "studio", "shop", "office"].includes(
      uType,
    )
      ? uType
      : "apartment";

    for (let f = 1; f <= totalFloorsCount; f++) {
      setCreationProgressText(`Creating Floor ${f} & Units for Floor ${f}…`);
      try {
        const floorRes = await createFloorMutation.mutateAsync({
          tower_id: towerId,
          floor_number: f,
          label:
            f === 1 ? "1st Floor" : f === 2 ? "2nd Floor" : f === 3 ? "3rd Floor" : `Floor ${f}`,
        });

        const floorEntry: FloorEntry = {
          id: floorRes.id,
          tower_id: towerId,
          floor_number: f,
          label: `Floor ${f}`,
        };
        createdFloors.push(floorEntry);

        // Auto-generate unit numbers for this floor
        if (unitsEachFloor > 0) {
          const unitPromises = Array.from({ length: unitsEachFloor }, async (_, uIdx) => {
            const uNum = generateUnitNumber(f, uIdx + 1, tCode, unitFormatStyle);
            try {
              const uRes = await createUnitMutation.mutateAsync({
                floor_id: floorRes.id,
                unit_number: uNum,
                unit_type: validUnitType,
                bedrooms: 2,
                area_sqft: 1200,
              });
              return {
                id: uRes.id,
                floor_id: floorRes.id,
                unit_number: uNum,
                unit_type: validUnitType,
              };
            } catch (err) {
              console.error(`Error creating unit ${uNum}:`, err);
              return null;
            }
          });

          const unitResults = await Promise.all(unitPromises);
          unitResults.forEach((u) => {
            if (u) createdUnits.push(u);
          });
        }
      } catch (err) {
        console.error(`Error generating floor ${f}`, err);
      }
    }
    return { floors: createdFloors, units: createdUnits };
  };

  const towerValidationErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const tName = towerName.trim();
    if (!tName) errs.name = "Tower name is required";
    else if (tName.length < 1 || tName.length > 100)
      errs.name = "Tower name must be between 1 and 100 characters";

    const tCode = towerCode.trim().toUpperCase();
    if (!tCode) errs.code = "Tower code is required";
    else if (tCode.length < 1 || tCode.length > 20)
      errs.code = "Tower code must be between 1 and 20 characters";

    if (!towerFloors || towerFloors < 1 || towerFloors > 150) {
      errs.floors = "Total floors must be between 1 and 150";
    }

    if (!unitsPerFloorInput || unitsPerFloorInput < 1 || unitsPerFloorInput > 50) {
      errs.units = "Units per floor must be between 1 and 50";
    }

    return errs;
  }, [towerName, towerCode, towerFloors, unitsPerFloorInput]);

  // Add Tower + Auto Generate Floors & Units
  const handleAddTower = async (e?: React.FormEvent): Promise<TowerEntry | null> => {
    if (e) e.preventDefault();
    setTowerTouched({ name: true, code: true, floors: true, units: true });
    if (Object.keys(towerValidationErrors).length > 0) {
      setTowerError(Object.values(towerValidationErrors)[0]);
      return null;
    }
    setTowerError("");
    setIsProcessingTower(true);

    try {
      const floorsCount = Math.max(1, Number(towerFloors) || 1);
      const unitsCount = Math.max(1, Number(unitsPerFloorInput) || 4);
      const tCode = towerCode.trim().toUpperCase();

      setCreationProgressText(`Creating Tower "${towerName.trim()}"…`);
      const towerRes = await createTowerMutation.mutateAsync({
        communityId: createdCommunityId,
        data: {
          name: towerName.trim(),
          code: tCode,
          structure_type: towerType,
          total_floors: floorsCount,
        },
      });

      const newTower: TowerEntry = {
        id: towerRes.id,
        name: towerName.trim(),
        code: tCode,
        total_floors: floorsCount,
        units_per_floor: unitsCount,
      };

      setAddedTowers((prev) => [...prev, newTower]);
      if (!selectedTowerId) setSelectedTowerId(towerRes.id);

      // Auto generate all floors and their unit numbers!
      if (autoGenerateAll && floorsCount > 0) {
        const { floors: genFloors, units: genUnits } = await autoCreateFloorsAndUnits(
          towerRes.id,
          tCode,
          floorsCount,
          unitsCount,
          unitTypeInput,
        );
        setAddedFloors((prev) => [...prev, ...genFloors]);
        setAddedUnits((prev) => [...prev, ...genUnits]);
        if (!selectedFloorId && genFloors.length > 0) {
          setSelectedFloorId(genFloors[0].id);
        }
      }

      toast.success(`Tower "${newTower.name}" created successfully!`);
      setTowerName("");
      setTowerCode("");
      setTowerFloors(11);
      setUnitsPerFloorInput(4);
      setTowerTouched({});
      setIsProcessingTower(false);
      setCreationProgressText("");
      return newTower;
    } catch (err: unknown) {
      setIsProcessingTower(false);
      setCreationProgressText("");
      setTowerError(err instanceof Error ? err.message : "Failed to add tower.");
      return null;
    }
  };

  // Next from Towers step
  const handleNextFromTowers = async () => {
    if (towerName.trim() && towerCode.trim()) {
      const created = await handleAddTower();
      if (!created) return;
    }
    setStep("floors");
  };

  // Step 3: Add additional custom floor with auto-generated units
  const handleAddCustomFloorWithUnits = async (e: React.FormEvent) => {
    e.preventDefault();
    const towerIdToUse = selectedTowerId || addedTowers[0]?.id;
    if (!towerIdToUse) {
      setFloorError("Please select a tower first.");
      return;
    }
    setFloorError("");
    setIsAddingFloorUnits(true);

    try {
      const targetTower = addedTowers.find((t) => t.id === towerIdToUse);
      const tCode = targetTower?.code || "";
      const fNum = Number(floorNumber);

      const floorRes = await createFloorMutation.mutateAsync({
        tower_id: towerIdToUse,
        floor_number: fNum,
        label: floorLabel.trim() || `Floor ${fNum}`,
      });

      const newFloor: FloorEntry = {
        id: floorRes.id,
        tower_id: towerIdToUse,
        floor_number: fNum,
        label: floorLabel.trim() || `Floor ${fNum}`,
      };
      setAddedFloors((prev) => [...prev, newFloor]);

      // Auto generate units for this newly added floor!
      const count = Math.max(0, Number(floorUnitsCount) || 0);
      if (count > 0) {
        const validUnitType = [
          "apartment",
          "villa",
          "penthouse",
          "studio",
          "shop",
          "office",
        ].includes(defaultUnitType)
          ? defaultUnitType
          : "apartment";

        const unitPromises = Array.from({ length: count }, async (_, uIdx) => {
          const uNum = generateUnitNumber(fNum, uIdx + 1, tCode, unitFormatStyle);
          try {
            const uRes = await createUnitMutation.mutateAsync({
              floor_id: floorRes.id,
              unit_number: uNum,
              unit_type: validUnitType,
              bedrooms: defaultBedrooms || undefined,
              area_sqft: defaultSqft || undefined,
            });
            return {
              id: uRes.id,
              floor_id: floorRes.id,
              unit_number: uNum,
              unit_type: validUnitType,
            };
          } catch (err) {
            console.error(`Error creating unit ${uNum}:`, err);
            return null;
          }
        });

        const unitResults = await Promise.all(unitPromises);
        const newUnits: UnitEntry[] = [];
        unitResults.forEach((u) => {
          if (u) newUnits.push(u);
        });
        setAddedUnits((prev) => [...prev, ...newUnits]);
      }

      setIsAddingFloorUnits(false);
      setFloorNumber((prev) => prev + 1);
      setFloorLabel("");
    } catch (err: unknown) {
      setIsAddingFloorUnits(false);
      setFloorError(err instanceof Error ? err.message : "Failed to add floor.");
    }
  };

  // Step 4: Add single manual unit
  const handleAddManualUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const floorIdToUse = selectedFloorId || addedFloors[0]?.id;
    if (!floorIdToUse) {
      setUnitError("Please select a floor first.");
      return;
    }
    if (!manualUnitNumber.trim()) {
      setUnitError("Unit number is required.");
      return;
    }
    setUnitError("");
    try {
      const validUnitType = [
        "apartment",
        "villa",
        "penthouse",
        "studio",
        "shop",
        "office",
      ].includes(manualUnitType)
        ? manualUnitType
        : "apartment";

      const result = await createUnitMutation.mutateAsync({
        floor_id: floorIdToUse,
        unit_number: manualUnitNumber.trim(),
        unit_type: validUnitType,
        bedrooms: manualBedrooms || undefined,
        area_sqft: manualSqft || undefined,
      });
      setAddedUnits((prev) => [
        ...prev,
        {
          id: result.id,
          unit_number: manualUnitNumber.trim(),
          floor_id: floorIdToUse,
          unit_type: validUnitType,
        },
      ]);
      setManualUnitNumber("");
    } catch (err: unknown) {
      setUnitError(err instanceof Error ? err.message : "Failed to add unit.");
    }
  };

  const handleFinish = async () => {
    const adminInfo = adminEmail
      ? {
          communityName: name.trim(),
          communityCode: code.trim().toUpperCase(),
          adminName: adminName.trim() || `Admin (${name.trim()})`,
          adminEmail: adminEmail.trim(),
          adminPassword: adminPassword,
        }
      : undefined;

    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["communities"], refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: ["towers"], refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: ["units"], refetchType: "all" }),
    ]);

    toast.success("Community setup completed successfully!");
    onSuccess?.(adminInfo);
    onClose();
  };

  const handleCloseModal = () => {
    if (createdCommunityId) {
      handleFinish();
    } else {
      onClose();
    }
  };

  const stepIndex = STEP_LIST.indexOf(step);
  const stateCitySuggestions = state ? POPULAR_CITIES_BY_STATE[state] || [] : [];

  const StepIndicator = () => (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5rem" }}>
      {STEP_LIST.map((s, i) => {
        const isCurrent = s === step;
        const isDone = stepIndex > i;
        return (
          <div
            key={s}
            style={{
              display: "flex",
              alignItems: "center",
              flex: i < STEP_LIST.length - 1 ? 1 : 0,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  background: isDone
                    ? "#16a34a"
                    : isCurrent
                      ? "var(--primary, #0ea5e9)"
                      : "#e2e8f0",
                  color: isDone || isCurrent ? "#fff" : "#64748b",
                  flexShrink: 0,
                }}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? "var(--primary, #0ea5e9)" : isDone ? "#16a34a" : "#94a3b8",
                  whiteSpace: "nowrap",
                }}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < STEP_LIST.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: isDone ? "#16a34a" : "#e2e8f0",
                  margin: "0 6px",
                  marginBottom: "1rem",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const CountBadge = ({ count, label }: { count: number; label: string }) =>
    count > 0 ? (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
          background: "#dcfce7",
          color: "#16a34a",
          borderRadius: 999,
          padding: "0.15rem 0.6rem",
          fontSize: "0.72rem",
          fontWeight: 700,
          marginBottom: "0.5rem",
        }}
      >
        ✓ {count} {label}
        {count > 1 ? "s" : ""} added
      </span>
    ) : null;

  const titles: Record<Step, string> = {
    community: "Step 1: Add New Community",
    towers: "Step 2: Add Towers & Configure Floors/Units",
    floors: "Step 3: Floor Levels & Auto-Generated Units",
    units: "Step 4: Review All Units & Flats",
  };

  const renderFooter = () => {
    if (step === "community")
      return (
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-community-modal-form"
            className="btn btn-primary"
            disabled={createCommunityMutation.isPending}
          >
            {createCommunityMutation.isPending ? "Creating…" : "Save & Continue to Towers →"}
          </button>
        </>
      );
    if (step === "towers")
      return (
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (addedTowers.length === 0 && (!towerName.trim() || !towerCode.trim())) {
                setStep("floors");
              } else {
                handleNextFromTowers();
              }
            }}
          >
            {addedTowers.length === 0 && !towerName.trim() ? "Skip Towers →" : "Next: Floors →"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
            Finish & Close
          </button>
          {(addedTowers.length > 0 || (towerName.trim() && towerCode.trim())) && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={isProcessingTower}
              onClick={handleNextFromTowers}
            >
              {isProcessingTower
                ? creationProgressText || "Generating Floors & Units…"
                : addedTowers.length > 0 && !towerName.trim()
                  ? `Continue to Floors (${addedFloors.length} Floors · ${addedUnits.length} Units) →`
                  : `Save & Auto-Generate ${towerFloors} Floors (${towerFloors * unitsPerFloorInput} Units) →`}
            </button>
          )}
        </>
      );
    if (step === "floors")
      return (
        <>
          <button type="button" className="btn btn-secondary" onClick={() => setStep("towers")}>
            ← Back to Towers
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
            Finish & Close
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSelectedFloorId(addedFloors[0]?.id || "");
              setStep("units");
            }}
          >
            {addedFloors.length === 0
              ? "Skip Floors →"
              : `Continue to Units (${addedUnits.length} Units Generated) →`}
          </button>
        </>
      );
    if (step === "units")
      return (
        <>
          <button type="button" className="btn btn-secondary" onClick={() => setStep("floors")}>
            ← Back to Floors
          </button>
          <button type="button" className="btn btn-primary" onClick={handleFinish}>
            {addedUnits.length > 0 ? `Complete & Finish (${addedUnits.length} Units) ✓` : "Finish"}
          </button>
        </>
      );
    return null;
  };

  const inputLabel = (text: string, required = false, optional = false) => (
    <label
      style={{
        fontWeight: 600,
        fontSize: "0.82rem",
        display: "block",
        marginBottom: "0.25rem",
        color: "var(--fg)",
      }}
    >
      {text}
      {required && <span style={{ color: "var(--danger, #ef4444)" }}> *</span>}
      {optional && <span style={{ color: "var(--muted)", fontWeight: 400 }}> (optional)</span>}
    </label>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseModal}
      title={titles[step]}
      footer={renderFooter()}
      maxWidth={680}
    >
      <StepIndicator />

      {/* STEP 1: Community & Admin */}
      {step === "community" && (
        <form id="create-community-modal-form" onSubmit={handleCreateCommunity} noValidate>
          {formError && (
            <div
              className="badge badge-danger"
              style={{
                display: "block",
                marginBottom: "1.25rem",
                padding: "0.6rem 0.75rem",
                textAlign: "left",
              }}
            >
              ⚠️ {formError}
            </div>
          )}
          <div style={{ marginBottom: "1rem" }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}
            >
              <label
                htmlFor="modal-comm-name"
                style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}
              >
                Community Name <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </label>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: name.length > 255 ? "var(--danger, #ef4444)" : "var(--muted)",
                }}
              >
                {name.length}/255
              </span>
            </div>
            <input
              id="modal-comm-name"
              type="text"
              className="input-field"
              placeholder="e.g. Palm Meadows Heights"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!touched.name) setTouched((t) => ({ ...t, name: true }));
              }}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              style={{
                borderColor:
                  touched.name && createErrors.name ? "var(--danger, #ef4444)" : undefined,
              }}
              required
            />
            {touched.name && createErrors.name && (
              <p
                style={{
                  color: "var(--danger, #ef4444)",
                  fontSize: "0.75rem",
                  marginTop: "0.3rem",
                  fontWeight: 500,
                }}
              >
                ✕ {createErrors.name}
              </p>
            )}
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}
            >
              <label
                htmlFor="modal-comm-code"
                style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}
              >
                Community Code (Unique Slug){" "}
                <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </label>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: code.length > 32 ? "var(--danger, #ef4444)" : "var(--muted)",
                }}
              >
                {code.length}/32
              </span>
            </div>
            <input
              id="modal-comm-code"
              type="text"
              className="input-field"
              placeholder="e.g. PMH-01"
              value={code}
              onChange={(e) => {
                const upper = e.target.value.toUpperCase();
                setCode(upper);
                if (!touched.code) setTouched((t) => ({ ...t, code: true }));
              }}
              onBlur={() => setTouched((t) => ({ ...t, code: true }))}
              style={{
                borderColor:
                  touched.code && createErrors.code ? "var(--danger, #ef4444)" : undefined,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}
              required
            />
            {touched.code && createErrors.code ? (
              <p
                style={{
                  color: "var(--danger, #ef4444)",
                  fontSize: "0.75rem",
                  marginTop: "0.3rem",
                  fontWeight: 500,
                }}
              >
                ✕ {createErrors.code}
              </p>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
                Use uppercase letters, numbers, and hyphens (e.g. <code>PMH-01</code>).
              </p>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <label
                htmlFor="modal-comm-state"
                style={{
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  color: "var(--fg)",
                  display: "block",
                  marginBottom: "0.35rem",
                }}
              >
                State / UT <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </label>
              <select
                id="modal-comm-state"
                className="select-field"
                value={state}
                onChange={(e) => {
                  const newState = e.target.value;
                  setState(newState);
                  if (!touched.state) setTouched((t) => ({ ...t, state: true }));
                  // Clear city if not in new state
                  const newCities = getCitiesForState(newState);
                  if (
                    city &&
                    !newCities.some((c) => c.toLowerCase() === city.trim().toLowerCase())
                  ) {
                    setCity("");
                    setCustomCity("");
                    setIsCustomCity(false);
                  }
                }}
                onBlur={() => setTouched((t) => ({ ...t, state: true }))}
                style={{
                  borderColor:
                    touched.state && createErrors.state ? "var(--danger, #ef4444)" : undefined,
                }}
                required
              >
                <option value="">Select State / UT…</option>
                {INDIAN_STATES_AND_UTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {touched.state && createErrors.state && (
                <p
                  style={{
                    color: "var(--danger, #ef4444)",
                    fontSize: "0.75rem",
                    marginTop: "0.3rem",
                    fontWeight: 500,
                  }}
                >
                  ✕ {createErrors.state}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="modal-comm-city"
                style={{
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  color: "var(--fg)",
                  display: "block",
                  marginBottom: "0.35rem",
                }}
              >
                City <span style={{ color: "var(--danger, #ef4444)" }}>*</span>
              </label>
              <select
                id="modal-comm-city"
                className="select-field"
                value={isCustomCity ? "__custom__" : city}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__custom__") {
                    setIsCustomCity(true);
                    setCity(customCity || "");
                  } else {
                    setIsCustomCity(false);
                    setCity(val);
                  }
                  if (!touched.city) setTouched((t) => ({ ...t, city: true }));
                }}
                onBlur={() => setTouched((t) => ({ ...t, city: true }))}
                style={{
                  borderColor:
                    touched.city && createErrors.city ? "var(--danger, #ef4444)" : undefined,
                }}
                disabled={!state}
                required
              >
                <option value="">
                  {state ? `Select city in ${state}…` : "Select State / UT first…"}
                </option>
                {getCitiesForState(state).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                {state && <option value="__custom__">Other City / Town in {state}…</option>}
              </select>
              {isCustomCity && (
                <input
                  type="text"
                  className="input-field"
                  placeholder={`Enter city / town in ${state}`}
                  value={customCity}
                  onChange={(e) => {
                    setCustomCity(e.target.value);
                    setCity(e.target.value);
                    if (!touched.city) setTouched((t) => ({ ...t, city: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, city: true }))}
                  style={{
                    marginTop: "0.4rem",
                    borderColor:
                      touched.city && createErrors.city ? "var(--danger, #ef4444)" : undefined,
                  }}
                  required
                />
              )}
              {touched.city && createErrors.city && (
                <p
                  style={{
                    color: "var(--danger, #ef4444)",
                    fontSize: "0.75rem",
                    marginTop: "0.3rem",
                    fontWeight: 500,
                  }}
                >
                  ✕ {createErrors.city}
                </p>
              )}
            </div>
          </div>

          {/* Admin Setup - REQUIRED */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem", marginTop: "0.5rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <div>
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--fg)" }}>
                  👤 Community Admin Account
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block" }}>
                  Required: Primary administrator credentials for this community
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                onClick={() =>
                  setAdminPassword(generateInitialPassword(adminName || name || "Admin"))
                }
              >
                ⚡ Generate Password
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <div>
                {inputLabel("Admin Full Name", true)}
                <input
                  className="input-field"
                  placeholder="e.g. Ramesh Sharma"
                  value={adminName}
                  onChange={(e) => {
                    setAdminName(e.target.value);
                    if (!touched.adminName) setTouched((t) => ({ ...t, adminName: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, adminName: true }))}
                  style={{
                    borderColor:
                      touched.adminName && createErrors.adminName
                        ? "var(--danger, #ef4444)"
                        : undefined,
                  }}
                  required
                />
                {touched.adminName && createErrors.adminName && (
                  <p
                    style={{
                      color: "var(--danger, #ef4444)",
                      fontSize: "0.75rem",
                      marginTop: "0.3rem",
                      fontWeight: 500,
                    }}
                  >
                    ✕ {createErrors.adminName}
                  </p>
                )}
              </div>
              <div>
                {inputLabel("Admin Email", true)}
                <input
                  type="email"
                  className="input-field"
                  placeholder="e.g. admin@example.com"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value);
                    if (!touched.adminEmail) setTouched((t) => ({ ...t, adminEmail: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, adminEmail: true }))}
                  style={{
                    borderColor:
                      touched.adminEmail && createErrors.adminEmail
                        ? "var(--danger, #ef4444)"
                        : undefined,
                  }}
                  required
                />
                {touched.adminEmail && createErrors.adminEmail && (
                  <p
                    style={{
                      color: "var(--danger, #ef4444)",
                      fontSize: "0.75rem",
                      marginTop: "0.3rem",
                      fontWeight: 500,
                    }}
                  >
                    ✕ {createErrors.adminEmail}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <PasswordField
                  id="modal-admin-pw"
                  label="Password"
                  value={adminPassword}
                  onChange={(val) => {
                    setAdminPassword(val);
                    if (!touched.adminPassword) setTouched((t) => ({ ...t, adminPassword: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, adminPassword: true }))}
                  placeholder="e.g. Admin@2026!"
                  required={true}
                  error={touched.adminPassword ? createErrors.adminPassword : undefined}
                />
              </div>
              <div>
                {inputLabel("Admin Phone", false, true)}
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  className="input-field"
                  placeholder="e.g. 9876543210"
                  value={adminPhone}
                  onChange={(e) => {
                    setAdminPhone(toPhoneDigits(e.target.value));
                    if (!touched.adminPhone) setTouched((t) => ({ ...t, adminPhone: true }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, adminPhone: true }))}
                  style={{
                    borderColor:
                      touched.adminPhone && createErrors.adminPhone
                        ? "var(--danger, #ef4444)"
                        : undefined,
                  }}
                />
                {touched.adminPhone && createErrors.adminPhone && (
                  <p
                    style={{
                      color: "var(--danger, #ef4444)",
                      fontSize: "0.75rem",
                      marginTop: "0.3rem",
                      fontWeight: 500,
                    }}
                  >
                    ✕ {createErrors.adminPhone}
                  </p>
                )}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* STEP 2: Towers */}
      {step === "towers" && (
        <div>
          <div style={{ marginBottom: "1rem" }}>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--fg)",
                fontWeight: 600,
                margin: "0 0 0.25rem 0",
              }}
            >
              🏢 Towers & Blocks for {name}
            </p>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: 0 }}>
              Specify the total floors & units per floor. All floors & unit numbers (e.g. 101–104,
              201–204) will be automatically generated!
            </p>
          </div>

          {towerError && (
            <div
              className="badge badge-danger"
              style={{ display: "block", marginBottom: "1rem", padding: "0.5rem 0.75rem" }}
            >
              ⚠️ {towerError}
            </div>
          )}

          {addedTowers.length > 0 && (
            <div
              style={{
                marginBottom: "1.25rem",
                padding: "0.75rem",
                background: "#f0fdf4",
                borderRadius: 8,
                border: "1px solid #bbf7d0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.4rem",
                }}
              >
                <CountBadge count={addedTowers.length} label="Tower" />
                <span style={{ fontSize: "0.72rem", color: "#16a34a", fontWeight: 700 }}>
                  ✓ {addedFloors.length} Floors · {addedUnits.length} Units Generated
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {addedTowers.map((t) => {
                  const tFloors = addedFloors.filter((f) => f.tower_id === t.id).length;
                  const tUnits = addedUnits.filter((u) =>
                    addedFloors.some((f) => f.tower_id === t.id && f.id === u.floor_id),
                  ).length;
                  return (
                    <span
                      key={t.id}
                      style={{
                        background: "#fff",
                        border: "1px solid #86efac",
                        borderRadius: 6,
                        padding: "0.25rem 0.6rem",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      🏢 {t.name}{" "}
                      <span style={{ opacity: 0.7, fontSize: "0.72rem" }}>({t.code})</span>
                      <span
                        style={{
                          background: "#dcfce7",
                          color: "#166534",
                          borderRadius: 4,
                          padding: "0 4px",
                          fontSize: "0.68rem",
                        }}
                      >
                        {tFloors} Floors · {tUnits} Units
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <form
            onSubmit={handleAddTower}
            style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                {inputLabel("Tower Name", true)}
                <input
                  className="input-field"
                  placeholder="e.g. 2 or Tower A"
                  value={towerName}
                  onChange={(e) => {
                    setTowerName(e.target.value);
                    if (!towerTouched.name) setTowerTouched((t) => ({ ...t, name: true }));
                  }}
                  onBlur={() => setTowerTouched((t) => ({ ...t, name: true }))}
                  style={{
                    borderColor:
                      towerTouched.name && towerValidationErrors.name
                        ? "var(--danger, #ef4444)"
                        : undefined,
                  }}
                  required
                />
                {towerTouched.name && towerValidationErrors.name && (
                  <p
                    style={{
                      color: "var(--danger, #ef4444)",
                      fontSize: "0.75rem",
                      marginTop: "0.3rem",
                      fontWeight: 500,
                    }}
                  >
                    ✕ {towerValidationErrors.name}
                  </p>
                )}
              </div>
              <div>
                {inputLabel("Tower Code", true)}
                <input
                  className="input-field"
                  placeholder="e.g. 87 or TWR-A"
                  value={towerCode}
                  onChange={(e) => {
                    setTowerCode(e.target.value.toUpperCase());
                    if (!towerTouched.code) setTowerTouched((t) => ({ ...t, code: true }));
                  }}
                  onBlur={() => setTowerTouched((t) => ({ ...t, code: true }))}
                  style={{
                    borderColor:
                      towerTouched.code && towerValidationErrors.code
                        ? "var(--danger, #ef4444)"
                        : undefined,
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                  required
                />
                {towerTouched.code && towerValidationErrors.code && (
                  <p
                    style={{
                      color: "var(--danger, #ef4444)",
                      fontSize: "0.75rem",
                      marginTop: "0.3rem",
                      fontWeight: 500,
                    }}
                  >
                    ✕ {towerValidationErrors.code}
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                {inputLabel("Structure Type")}
                <select
                  className="select-field"
                  value={towerType}
                  onChange={(e) => setTowerType(e.target.value)}
                >
                  {STRUCTURE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {inputLabel("Total Floors", true)}
                <input
                  type="number"
                  className="input-field"
                  min={1}
                  max={150}
                  value={towerFloors}
                  onChange={(e) => {
                    setTowerFloors(Number(e.target.value));
                    if (!towerTouched.floors) setTowerTouched((t) => ({ ...t, floors: true }));
                  }}
                  onBlur={() => setTowerTouched((t) => ({ ...t, floors: true }))}
                  style={{
                    borderColor:
                      towerTouched.floors && towerValidationErrors.floors
                        ? "var(--danger, #ef4444)"
                        : undefined,
                  }}
                  required
                />
                {towerTouched.floors && towerValidationErrors.floors && (
                  <p
                    style={{
                      color: "var(--danger, #ef4444)",
                      fontSize: "0.75rem",
                      marginTop: "0.3rem",
                      fontWeight: 500,
                    }}
                  >
                    ✕ {towerValidationErrors.floors}
                  </p>
                )}
              </div>
            </div>

            {/* Units Per Floor Config */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                {inputLabel("Units on Each Floor", true)}
                <input
                  type="number"
                  className="input-field"
                  min={1}
                  max={50}
                  value={unitsPerFloorInput}
                  onChange={(e) => {
                    setUnitsPerFloorInput(Math.max(1, Number(e.target.value)));
                    if (!towerTouched.units) setTowerTouched((t) => ({ ...t, units: true }));
                  }}
                  onBlur={() => setTowerTouched((t) => ({ ...t, units: true }))}
                  style={{
                    borderColor:
                      towerTouched.units && towerValidationErrors.units
                        ? "var(--danger, #ef4444)"
                        : undefined,
                  }}
                  required
                />
                {towerTouched.units && towerValidationErrors.units && (
                  <p
                    style={{
                      color: "var(--danger, #ef4444)",
                      fontSize: "0.75rem",
                      marginTop: "0.3rem",
                      fontWeight: 500,
                    }}
                  >
                    ✕ {towerValidationErrors.units}
                  </p>
                )}
              </div>
              <div>
                {inputLabel("Unit Type")}
                <select
                  className="select-field"
                  value={unitTypeInput}
                  onChange={(e) => setUnitTypeInput(e.target.value)}
                >
                  {UNIT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Auto generation info box */}
            <div
              style={{
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: 8,
                padding: "0.75rem 0.9rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  id="auto-gen-all-chk"
                  type="checkbox"
                  checked={autoGenerateAll}
                  onChange={(e) => setAutoGenerateAll(e.target.checked)}
                  style={{
                    width: 16,
                    height: 16,
                    accentColor: "var(--primary, #0ea5e9)",
                    cursor: "pointer",
                  }}
                />
                <label
                  htmlFor="auto-gen-all-chk"
                  style={{
                    fontSize: "0.82rem",
                    color: "#0369a1",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  ⚡ Auto-generate {towerFloors || 11} Floors &{" "}
                  {(towerFloors || 11) * (unitsPerFloorInput || 4)} Unit Numbers
                </label>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#0284c7", paddingLeft: "1.5rem" }}>
                Generates Floor 1 ({generateUnitNumber(1, 1)}–
                {generateUnitNumber(1, unitsPerFloorInput)}) through Floor {towerFloors} (
                {generateUnitNumber(towerFloors, 1)}–
                {generateUnitNumber(towerFloors, unitsPerFloorInput)}).
              </span>
            </div>

            {isProcessingTower && (
              <div
                style={{
                  padding: "0.5rem 0.75rem",
                  background: "#fef3c7",
                  color: "#92400e",
                  borderRadius: 6,
                  fontSize: "0.78rem",
                  fontWeight: 600,
                }}
              >
                ⏳ {creationProgressText || "Processing…"}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={isProcessingTower}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
              >
                ➕ Add Another Tower
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 3: Floors with Auto-Generated Unit Numbers */}
      {step === "floors" && (
        <div>
          <div style={{ marginBottom: "1rem" }}>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--fg)",
                fontWeight: 600,
                margin: "0 0 0.25rem 0",
              }}
            >
              🏗 Floor Levels & Unit Numbers
            </p>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: 0 }}>
              Unit numbers are automatically mapped to each floor level based on the number of
              units.
            </p>
          </div>

          {floorError && (
            <div
              className="badge badge-danger"
              style={{ display: "block", marginBottom: "1rem", padding: "0.5rem 0.75rem" }}
            >
              ⚠️ {floorError}
            </div>
          )}

          {/* Tower Floor Cards with unit pills */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
              maxHeight: 280,
              overflowY: "auto",
              paddingRight: "0.25rem",
            }}
          >
            {addedTowers.map((tower) => {
              const towerFloorsList = addedFloors.filter((f) => f.tower_id === tower.id);
              return (
                <div
                  key={tower.id}
                  style={{
                    padding: "0.85rem",
                    background: "var(--surface-alt, #f8fafc)",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.6rem",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--fg)" }}>
                      🏢 {tower.name} ({tower.code})
                    </span>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        background: "#dcfce7",
                        color: "#166534",
                        padding: "0.15rem 0.5rem",
                        borderRadius: 999,
                        fontWeight: 700,
                      }}
                    >
                      {towerFloorsList.length} Floors ·{" "}
                      {
                        addedUnits.filter((u) => towerFloorsList.some((f) => f.id === u.floor_id))
                          .length
                      }{" "}
                      Units
                    </span>
                  </div>

                  {towerFloorsList.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {towerFloorsList.map((f) => {
                        const floorUnits = addedUnits.filter((u) => u.floor_id === f.id);
                        return (
                          <div
                            key={f.id}
                            style={{
                              background: "#fff",
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                              padding: "0.4rem 0.6rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "0.5rem",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: "0.78rem",
                                color: "var(--fg)",
                                minWidth: 70,
                              }}
                            >
                              Floor {f.floor_number}:
                            </span>
                            <div
                              style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", flex: 1 }}
                            >
                              {floorUnits.length > 0 ? (
                                floorUnits.map((u) => (
                                  <span
                                    key={u.id}
                                    style={{
                                      background: "#f0fdf4",
                                      border: "1px solid #bbf7d0",
                                      color: "#166534",
                                      borderRadius: 4,
                                      padding: "0.1rem 0.4rem",
                                      fontSize: "0.72rem",
                                      fontWeight: 600,
                                    }}
                                  >
                                    🚪 {u.unit_number}
                                  </span>
                                ))
                              ) : (
                                <span
                                  style={{
                                    fontSize: "0.72rem",
                                    color: "var(--muted)",
                                    fontStyle: "italic",
                                  }}
                                >
                                  No units yet
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                              {floorUnits.length} units
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: 0 }}>
                      No floors generated yet.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add custom floor with auto unit generation */}
          <details
            style={{
              marginTop: "1rem",
              background: "#f8fafc",
              borderRadius: 8,
              padding: "0.5rem 0.75rem",
              border: "1px solid #e2e8f0",
            }}
          >
            <summary
              style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg)", cursor: "pointer" }}
            >
              ➕ Add Additional Custom Floor (with Auto Units)
            </summary>
            <form
              onSubmit={handleAddCustomFloorWithUnits}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                marginTop: "0.75rem",
              }}
            >
              <div>
                {inputLabel("Select Tower", true)}
                <select
                  className="select-field"
                  value={selectedTowerId}
                  onChange={(e) => setSelectedTowerId(e.target.value)}
                  required
                >
                  <option value="">Choose a tower…</option>
                  {addedTowers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <div>
                  {inputLabel("Floor Number", true)}
                  <input
                    type="number"
                    className="input-field"
                    min={-5}
                    max={200}
                    value={floorNumber}
                    onChange={(e) => setFloorNumber(Number(e.target.value))}
                    required
                  />
                </div>
                <div>
                  {inputLabel("Number of Units", true)}
                  <input
                    type="number"
                    className="input-field"
                    min={1}
                    max={50}
                    value={floorUnitsCount}
                    onChange={(e) => setFloorUnitsCount(Number(e.target.value))}
                    required
                  />
                </div>
                <div>
                  {inputLabel("Label", false, true)}
                  <input
                    className="input-field"
                    placeholder="e.g. Penthouse"
                    value={floorLabel}
                    onChange={(e) => setFloorLabel(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={isAddingFloorUnits || (!selectedTowerId && addedTowers.length === 0)}
                style={{ alignSelf: "flex-start" }}
              >
                {isAddingFloorUnits ? "Adding Floor & Units…" : "➕ Add Floor with Auto Units"}
              </button>
            </form>
          </details>
        </div>
      )}

      {/* STEP 4: Review All Units */}
      {step === "units" && (
        <div>
          <div style={{ marginBottom: "1rem" }}>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--fg)",
                fontWeight: 600,
                margin: "0 0 0.25rem 0",
              }}
            >
              🚪 Generated Units & Flats Summary
            </p>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: 0 }}>
              All units have been automatically numbered and mapped to their respective floors.
            </p>
          </div>

          {unitError && (
            <div
              className="badge badge-danger"
              style={{ display: "block", marginBottom: "1rem", padding: "0.5rem 0.75rem" }}
            >
              ⚠️ {unitError}
            </div>
          )}

          {/* Unit Stats Card */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "0.75rem",
              marginBottom: "1rem",
              padding: "0.75rem",
              background: "#f0f9ff",
              borderRadius: 8,
              border: "1px solid #bae6fd",
            }}
          >
            <div>
              <span style={{ fontSize: "0.72rem", color: "#0369a1", display: "block" }}>
                Total Towers
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0284c7" }}>
                {addedTowers.length}
              </span>
            </div>
            <div>
              <span style={{ fontSize: "0.72rem", color: "#0369a1", display: "block" }}>
                Total Floors
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0284c7" }}>
                {addedFloors.length}
              </span>
            </div>
            <div>
              <span style={{ fontSize: "0.72rem", color: "#0369a1", display: "block" }}>
                Total Units
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#16a34a" }}>
                {addedUnits.length}
              </span>
            </div>
          </div>

          {/* Units Pill Grid */}
          {addedUnits.length > 0 ? (
            <div
              style={{
                marginBottom: "1.25rem",
                padding: "0.75rem",
                background: "var(--surface-alt, #f8fafc)",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--fg)" }}>
                  All Generated Units ({addedUnits.length})
                </span>
                <span style={{ fontSize: "0.72rem", color: "#16a34a", fontWeight: 700 }}>
                  ✓ Ready to Save
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.35rem",
                  maxHeight: 150,
                  overflowY: "auto",
                }}
              >
                {addedUnits.map((u) => {
                  const floor = addedFloors.find((f) => f.id === u.floor_id);
                  return (
                    <span
                      key={u.id}
                      style={{
                        background: "#fff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                        padding: "0.2rem 0.5rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      🚪 {u.unit_number}
                      <span style={{ opacity: 0.5, fontSize: "0.68rem" }}>
                        (F{floor?.floor_number})
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "1.5rem",
                textAlign: "center",
                background: "#fef3c7",
                borderRadius: 8,
                color: "#92400e",
                fontSize: "0.85rem",
                marginBottom: "1rem",
              }}
            >
              ⚠️ No units generated. Go back to Step 2 or 3 to add floors and units.
            </div>
          )}

          {/* Add Single Custom Unit */}
          <details
            style={{
              background: "#f8fafc",
              borderRadius: 8,
              padding: "0.5rem 0.75rem",
              border: "1px solid #e2e8f0",
            }}
          >
            <summary
              style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg)", cursor: "pointer" }}
            >
              ➕ Add Single Custom Unit
            </summary>
            <form
              onSubmit={handleAddManualUnit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                marginTop: "0.75rem",
              }}
            >
              {addedFloors.length > 0 && (
                <div>
                  {inputLabel("Select Floor", true)}
                  <select
                    className="select-field"
                    value={selectedFloorId}
                    onChange={(e) => setSelectedFloorId(e.target.value)}
                    required
                  >
                    <option value="">Choose a floor…</option>
                    {addedFloors.map((f) => {
                      const tn = addedTowers.find((t) => t.id === f.tower_id)?.name || "Tower";
                      return (
                        <option key={f.id} value={f.id}>
                          {tn} · Floor {f.floor_number}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  {inputLabel("Unit Number", true)}
                  <input
                    className="input-field"
                    placeholder="e.g. Villa-1, Studio-A"
                    value={manualUnitNumber}
                    onChange={(e) => setManualUnitNumber(e.target.value)}
                    required
                  />
                </div>
                <div>
                  {inputLabel("Unit Type")}
                  <select
                    className="select-field"
                    value={manualUnitType}
                    onChange={(e) => setManualUnitType(e.target.value)}
                  >
                    {UNIT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={
                  createUnitMutation.isPending || (!selectedFloorId && addedFloors.length === 0)
                }
                style={{ alignSelf: "flex-start" }}
              >
                {createUnitMutation.isPending ? "Adding…" : "➕ Add Custom Unit"}
              </button>
            </form>
          </details>
        </div>
      )}
    </Modal>
  );
}
