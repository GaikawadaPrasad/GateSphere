"use client";

import React, { useState, useEffect } from "react";
import { deliveriesApi } from "@/lib/api";
import type { DeliveryItem, DeliveryProtocol } from "@/types/deliveries";

function PackageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function RefreshIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function AlertIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

export function DeliveriesTab() {
  const [protocols, setProtocols] = useState<DeliveryProtocol[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [protosRes, delivsRes] = await Promise.allSettled([
        deliveriesApi.protocols(),
        deliveriesApi.list(),
      ]);

      if (protosRes.status === "fulfilled") {
        setProtocols(protosRes.value || []);
      }
      if (delivsRes.status === "fulfilled") {
        setDeliveries(delivsRes.value || []);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load delivery protocols and items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProtocolChange = async (type: string, newProtocol: string) => {
    try {
      await deliveriesApi.updateProtocol({
        delivery_type: type,
        protocol_type: newProtocol,
      });
      setProtocols((prev) =>
        prev.map((p) =>
          p.delivery_type === type ? { ...p, protocol_type: newProtocol } : p
        )
      );
    } catch (err: any) {
      alert("Failed to update delivery protocol: " + (err?.message || "Unknown error"));
    }
  };

  const filteredDeliveries = deliveries.filter((d) => {
    const matchesSearch =
      !search ||
      (d.provider_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.tracking_reference || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.delivery_type || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header & Protocol Rules */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Active Delivery Rules</h2>
            <p className="text-sm text-slate-500">
              Set default handling rules for incoming parcels, couriers, and food orders.
            </p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <RefreshIcon className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { key: "ecommerce", label: "E-Commerce", defaultProto: "leave_at_gate_desk" },
            { key: "food", label: "Food & Beverage", defaultProto: "allow_at_gate" },
            { key: "grocery", label: "Grocery", defaultProto: "resident_approval_required" },
            { key: "courier", label: "Courier & Parcels", defaultProto: "leave_at_gate_desk" },
          ].map((cat) => {
            const currentProto =
              protocols.find((p) => p.delivery_type === cat.key)?.protocol_type ||
              cat.defaultProto;

            return (
              <div
                key={cat.key}
                className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 font-medium text-slate-900 text-sm mb-1">
                    <PackageIcon className="w-4 h-4 text-emerald-600" />
                    {cat.label}
                  </div>
                  <label className="block text-xs text-slate-500 mb-2">
                    Gate Handling Protocol
                  </label>
                </div>
                <select
                  value={currentProto}
                  onChange={(e) => handleProtocolChange(cat.key, e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-md p-2 font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="allow_at_gate">allow at gate</option>
                  <option value="resident_approval_required">
                    resident approval required
                  </option>
                  <option value="leave_at_gate_desk">leave at gate desk</option>
                  <option value="direct_rejection">direct rejection</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delivery Tracking Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="text-base font-bold text-slate-900">Incoming & Active Parcels</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search provider, tracking..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none w-48 sm:w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Statuses</option>
              <option value="expected">Expected</option>
              <option value="arrived">At Gate</option>
              <option value="delivered">Delivered</option>
              <option value="collected_at_gate">Collected</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Loading delivery records...
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
            <AlertIcon className="w-4 h-4" />
            {error}
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8">
            <PackageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No deliveries found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              There are no active or incoming parcels matching your current filter. New deliveries registered at the gate will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-medium">
                <tr>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Tracking Ref</th>
                  <th className="p-3">Parcels</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDeliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-800">
                      {d.provider_name || "Courier"}
                    </td>
                    <td className="p-3 capitalize">{d.delivery_type}</td>
                    <td className="p-3 font-mono text-slate-500">
                      {d.tracking_reference || "N/A"}
                    </td>
                    <td className="p-3">{d.parcel_count || 1}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[11px] ${
                          d.status === "delivered" || d.status === "collected_at_gate"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : d.status === "arrived"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
