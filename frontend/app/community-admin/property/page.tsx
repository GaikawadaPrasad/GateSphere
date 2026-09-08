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
  useCreateFloor,
  useCreateUnit,
  useCreateGate,
} from "@/hooks/use-communities";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FilterPanel } from "@/components/common/FilterPanel";
import { Modal } from "@/components/common/Modal";
import type { Tower, Floor, Unit, Gate } from "@/types/communities";

export default function CommunityAdminPropertyPage() {
  const { activeCommunityId } = useUiStore();
  const [activeTab, setActiveTab] = useState<"towers" | "floors" | "units" | "gates">("towers");
  const [selectedTowerId, setSelectedTowerId] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // Queries
  const { data: community } = useCommunityDetails(activeCommunityId || undefined);
  const { data: towers, isLoading: towersLoading, refetch: refetchTowers } = useTowers(activeCommunityId || undefined);
  const { data: gates, isLoading: gatesLoading, refetch: refetchGates } = useGates(activeCommunityId || undefined);

  // Set default tower if none selected
  const currentTowerId = selectedTowerId || (towers && towers.length > 0 ? towers[0].id : "");
  const { data: floors, isLoading: floorsLoading, refetch: refetchFloors } = useFloors(currentTowerId || undefined);

  // Set default floor if none selected
  const currentFloorId = selectedFloorId || (floors && floors.length > 0 ? floors[0].id : "");
  const { data: units, isLoading: unitsLoading, refetch: refetchUnits } = useUnits(currentFloorId || undefined);

  // Mutations
  const createTower = useCreateTower();
  const createFloor = useCreateFloor();
  const createUnit = useCreateUnit();
  const createGate = useCreateGate();

  // Create modals state
  const [isAddTowerOpen, setIsAddTowerOpen] = useState(false);
  const [isAddFloorOpen, setIsAddFloorOpen] = useState(false);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [isAddGateOpen, setIsAddGateOpen] = useState(false);

  const [towerForm, setTowerForm] = useState({ name: "", code: "", structure_type: "tower", total_floors: 10 });
  const [floorForm, setFloorForm] = useState({ tower_id: "", floor_number: 1, label: "" });
  const [unitForm, setUnitForm] = useState({ floor_id: "", unit_number: "", unit_type: "apartment", bedrooms: 2, area_sqft: 1200 });
  const [gateForm, setGateForm] = useState({ name: "", code: "", gate_type: "both" });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle Add Tower
  const handleCreateTower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await createTower.mutateAsync({
        communityId: activeCommunityId,
        data: {
          name: towerForm.name.trim(),
          code: towerForm.code.trim().toUpperCase(),
          structure_type: towerForm.structure_type,
          total_floors: Number(towerForm.total_floors) || 0,
        },
      });
      setIsAddTowerOpen(false);
      setTowerForm({ name: "", code: "", structure_type: "tower", total_floors: 10 });
      refetchTowers();
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to create tower");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Floor
  const handleCreateFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    const towerId = floorForm.tower_id || currentTowerId;
    if (!towerId) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await createFloor.mutateAsync({
        tower_id: towerId,
        floor_number: Number(floorForm.floor_number),
        label: floorForm.label ? floorForm.label.trim() : undefined,
      });
      setIsAddFloorOpen(false);
      setFloorForm({ tower_id: "", floor_number: 1, label: "" });
      refetchFloors();
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to create floor");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Unit
  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const floorId = unitForm.floor_id || currentFloorId;
    if (!floorId) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await createUnit.mutateAsync({
        floor_id: floorId,
        unit_number: unitForm.unit_number.trim(),
        unit_type: unitForm.unit_type,
        bedrooms: unitForm.bedrooms ? Number(unitForm.bedrooms) : undefined,
        area_sqft: unitForm.area_sqft ? Number(unitForm.area_sqft) : undefined,
      });
      setIsAddUnitOpen(false);
      setUnitForm({ floor_id: "", unit_number: "", unit_type: "apartment", bedrooms: 2, area_sqft: 1200 });
      refetchUnits();
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to create unit");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Gate
  const handleCreateGate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await createGate.mutateAsync({
        communityId: activeCommunityId,
        data: {
          name: gateForm.name.trim(),
          code: gateForm.code.trim().toUpperCase(),
          gate_type: gateForm.gate_type,
        },
      });
      setIsAddGateOpen(false);
      setGateForm({ name: "", code: "", gate_type: "both" });
      refetchGates();
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to create gate");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Towers Columns
  const towerColumns: Column<Tower>[] = [
    { key: "name", header: "Tower / Block Name", render: (t) => <strong>{t.name}</strong> },
    { key: "code", header: "Code", render: (t) => <span className="badge badge-neutral">{t.code || "–"}</span> },
    { key: "total_floors", header: "Floors", render: (t) => t.total_floors ?? "–" },
    { key: "total_units", header: "Units", render: (t) => t.total_units ?? "–" },
    {
      key: "actions",
      header: "Action",
      render: (t) => (
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
      ),
    },
  ];

  // Floors Columns
  const floorColumns: Column<Floor>[] = [
    { key: "floor_number", header: "Floor #", render: (f) => <strong>Floor {f.floor_number}</strong> },
    { key: "total_units", header: "Total Units", render: (f) => f.total_units ?? "–" },
    {
      key: "actions",
      header: "Action",
      render: (f) => (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedFloorId(f.id);
            setActiveTab("units");
          }}
        >
          View Units →
        </button>
      ),
    },
  ];

  // Units Columns
  const unitColumns: Column<Unit>[] = [
    { key: "unit_number", header: "Unit Number", render: (u) => <strong>Unit {u.unit_number}</strong> },
    { key: "unit_type", header: "Type", render: (u) => <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>{u.unit_type || "Standard"}</span> },
    { key: "sq_ft", header: "Area", render: (u) => (u.sq_ft ? `${u.sq_ft} sq ft` : "–") },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <span className={`badge ${u.is_occupied ? "badge-success" : "badge-neutral"}`}>
          {u.is_occupied ? "Occupied" : "Vacant"}
        </span>
      ),
    },
  ];

  // Gates Columns
  const gateColumns: Column<Gate>[] = [
    { key: "name", header: "Gate Name", render: (g) => <strong>{g.name}</strong> },
    { key: "code", header: "Code", render: (g) => <span className="badge badge-neutral">{g.code || "–"}</span> },
    { key: "gate_type", header: "Gate Type", render: (g) => <span className="badge badge-primary" style={{ textTransform: "capitalize" }}>{g.gate_type}</span> },
    {
      key: "is_active",
      header: "Operational Status",
      render: (g) => <span className={`badge ${g.is_active ? "badge-success" : "badge-danger"}`}>{g.is_active ? "Active" : "Closed"}</span>,
    },
  ];

  const filteredTowers = towers?.filter((t) => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.code?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <PageHeader
        title="Property &amp; Infrastructure"
        description="Community hierarchy, residential blocks, floors, and individual apartment units."
        action={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {activeTab === "towers" && (
              <button type="button" className="btn btn-primary" onClick={() => { setErrorMessage(null); setIsAddTowerOpen(true); }}>
                + Add Tower
              </button>
            )}
            {activeTab === "floors" && (
              <button type="button" className="btn btn-primary" onClick={() => { setErrorMessage(null); setFloorForm(f => ({ ...f, tower_id: currentTowerId })); setIsAddFloorOpen(true); }}>
                + Add Floor
              </button>
            )}
            {activeTab === "units" && (
              <button type="button" className="btn btn-primary" onClick={() => { setErrorMessage(null); setUnitForm(u => ({ ...u, floor_id: currentFloorId })); setIsAddUnitOpen(true); }}>
                + Add Unit
              </button>
            )}
            {activeTab === "gates" && (
              <button type="button" className="btn btn-primary" onClick={() => { setErrorMessage(null); setIsAddGateOpen(true); }}>
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
                {community.city ? `${community.city}, ` : ""}{community.state || "Community Registered"} · Code: <strong>{community.code}</strong>
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
            borderBottom: activeTab === "towers" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          🏢 Towers &amp; Blocks ({towers?.length || 0})
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
            borderBottom: activeTab === "floors" ? "2px solid var(--primary)" : "2px solid transparent",
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
            borderBottom: activeTab === "units" ? "2px solid var(--primary)" : "2px solid transparent",
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
            borderBottom: activeTab === "gates" ? "2px solid var(--primary)" : "2px solid transparent",
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
          />
        </div>
      )}

      {/* Tab: Floors */}
      {activeTab === "floors" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--fg-secondary)" }}>Select Tower:</span>
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
          />
        </div>
      )}

      {/* Tab: Units */}
      {activeTab === "units" && (
        <div>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--fg-secondary)" }}>Tower:</span>
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
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--fg-secondary)" }}>Floor:</span>
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
          />
        </div>
      )}

      {/* Tab: Gates */}
      {activeTab === "gates" && (
        <DataTable
          columns={gateColumns}
          data={gates as (Gate & Record<string, unknown>)[]}
          isLoading={gatesLoading}
          emptyTitle="No gates configured"
          emptyDescription="Security entry and exit gates registered for the community."
        />
      )}

      {/* Add Tower Modal */}
      <Modal
        isOpen={isAddTowerOpen}
        onClose={() => setIsAddTowerOpen(false)}
        title="Add Residential Tower / Block"
      >
        <form onSubmit={handleCreateTower} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {errorMessage && (
            <div style={{ padding: "0.6rem 0.8rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-sm)", color: "#b91c1c", fontSize: "0.85rem" }}>
              {errorMessage}
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Tower Name
            </label>
            <input
              type="text"
              className="input-field"
              required
              placeholder="e.g. Tower A / Block 1"
              value={towerForm.name}
              onChange={(e) => setTowerForm({ ...towerForm, name: e.target.value })}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Block / Tower Code
              </label>
              <input
                type="text"
                className="input-field"
                required
                placeholder="e.g. T-A"
                value={towerForm.code}
                onChange={(e) => setTowerForm({ ...towerForm, code: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Structure Type
              </label>
              <select
                className="select-field"
                value={towerForm.structure_type}
                onChange={(e) => setTowerForm({ ...towerForm, structure_type: e.target.value })}
              >
                <option value="tower">Tower</option>
                <option value="block">Block</option>
                <option value="villa_cluster">Villa Cluster</option>
                <option value="row_house">Row House</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Total Floors
            </label>
            <input
              type="number"
              className="input-field"
              min={1}
              max={150}
              required
              value={towerForm.total_floors}
              onChange={(e) => setTowerForm({ ...towerForm, total_floors: Number(e.target.value) })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddTowerOpen(false)}>
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
        <form onSubmit={handleCreateFloor} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {errorMessage && (
            <div style={{ padding: "0.6rem 0.8rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-sm)", color: "#b91c1c", fontSize: "0.85rem" }}>
              {errorMessage}
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Tower / Block
            </label>
            <select
              className="select-field"
              required
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
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Floor Number
            </label>
            <input
              type="number"
              className="input-field"
              required
              placeholder="e.g. 1 (0 for ground, -1 for basement)"
              value={floorForm.floor_number}
              onChange={(e) => setFloorForm({ ...floorForm, floor_number: Number(e.target.value) })}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Floor Label (Optional)
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. 1st Floor / Ground Floor"
              value={floorForm.label}
              onChange={(e) => setFloorForm({ ...floorForm, label: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddFloorOpen(false)}>
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
        <form onSubmit={handleCreateUnit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {errorMessage && (
            <div style={{ padding: "0.6rem 0.8rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-sm)", color: "#b91c1c", fontSize: "0.85rem" }}>
              {errorMessage}
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Floor
            </label>
            <select
              className="select-field"
              required
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
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Unit Number
              </label>
              <input
                type="text"
                className="input-field"
                required
                placeholder="e.g. 101 / A-204"
                value={unitForm.unit_number}
                onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Unit Type
              </label>
              <select
                className="select-field"
                value={unitForm.unit_type}
                onChange={(e) => setUnitForm({ ...unitForm, unit_type: e.target.value })}
              >
                <option value="apartment">Apartment</option>
                <option value="penthouse">Penthouse</option>
                <option value="duplex">Duplex</option>
                <option value="studio">Studio</option>
                <option value="villa">Villa</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Bedrooms (BHK)
              </label>
              <input
                type="number"
                min={0}
                max={10}
                className="input-field"
                value={unitForm.bedrooms}
                onChange={(e) => setUnitForm({ ...unitForm, bedrooms: Number(e.target.value) })}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Area (sq ft)
              </label>
              <input
                type="number"
                min={100}
                max={50000}
                className="input-field"
                value={unitForm.area_sqft}
                onChange={(e) => setUnitForm({ ...unitForm, area_sqft: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddUnitOpen(false)}>
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
        <form onSubmit={handleCreateGate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {errorMessage && (
            <div style={{ padding: "0.6rem 0.8rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-sm)", color: "#b91c1c", fontSize: "0.85rem" }}>
              {errorMessage}
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Gate Name
            </label>
            <input
              type="text"
              className="input-field"
              required
              placeholder="e.g. Main North Entry Gate"
              value={gateForm.name}
              onChange={(e) => setGateForm({ ...gateForm, name: e.target.value })}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Gate Code
              </label>
              <input
                type="text"
                className="input-field"
                required
                placeholder="e.g. GATE-01"
                value={gateForm.code}
                onChange={(e) => setGateForm({ ...gateForm, code: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Gate Direction / Type
              </label>
              <select
                className="select-field"
                value={gateForm.gate_type}
                onChange={(e) => setGateForm({ ...gateForm, gate_type: e.target.value })}
              >
                <option value="both">Both (Entry &amp; Exit)</option>
                <option value="entry">Entry Only</option>
                <option value="exit">Exit Only</option>
                <option value="pedestrian">Pedestrian Gate</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddGateOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Save Gate"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
