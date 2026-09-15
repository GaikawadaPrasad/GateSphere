"use client";

import React, { useEffect, useState } from "react";
import { vehiclesApi } from "@/lib/api";
import { Modal } from "@/components/common/Modal";
import { toast } from "@/store/toast";

interface Vehicle {
  id: string;
  plate_number: string;
  make_model?: string;
  vehicle_type: string;
  unit_id?: string;
  sticker_number?: string;
  is_active: boolean;
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [plateNumber, setPlateNumber] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [vehicleType, setVehicleType] = useState("four_wheeler");
  const [stickerNumber, setStickerNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await vehiclesApi.list();
      const list = Array.isArray(res) ? res : [];
      setVehicles(list as unknown as Vehicle[]);
    } catch (err: any) {
      setError(err?.message || "Failed to load vehicles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await vehiclesApi.register({
        plate_number: plateNumber.toUpperCase().trim(),
        make_model: makeModel.trim(),
        vehicle_type: vehicleType,
        sticker_number: stickerNumber.trim() || undefined,
      });
      setShowModal(false);
      setPlateNumber("");
      setMakeModel("");
      setStickerNumber("");
      toast.success("Vehicle registered successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vehicle Registry</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage registered resident and staff vehicles</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
        >
          + Register Vehicle
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">Loading vehicles...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      ) : vehicles.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-500">
          No vehicles registered yet. Click &quot;Register Vehicle&quot; to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <div key={v.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-lg px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-900 dark:text-white">
                  {v.plate_number}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${v.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
                  {v.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{v.make_model || "Vehicle"}</p>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
                <span>Type: {v.vehicle_type?.replace("_", " ")}</span>
                {v.sticker_number && <span>Sticker: #{v.sticker_number}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Register New Vehicle">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Plate Number *</label>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="e.g. KA01AB1234"
                className="w-full mt-1 p-2 border rounded-md uppercase font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Make & Model</label>
              <input
                type="text"
                value={makeModel}
                onChange={(e) => setMakeModel(e.target.value)}
                placeholder="e.g. Honda City (White)"
                className="w-full mt-1 p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Vehicle Type</label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full mt-1 p-2 border rounded-md bg-white dark:bg-slate-800"
              >
                <option value="four_wheeler">Four Wheeler (Car)</option>
                <option value="two_wheeler">Two Wheeler (Bike/Scooter)</option>
                <option value="commercial">Commercial / EV</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Sticker / Pass Number</label>
              <input
                type="text"
                value={stickerNumber}
                onChange={(e) => setStickerNumber(e.target.value)}
                placeholder="e.g. STK-2026-99"
                className="w-full mt-1 p-2 border rounded-md"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-md text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Registering..." : "Register"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
