"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { deliveriesApi } from "@/lib/api";

interface DeliveryItem {
  id: string;
  gate_time: string;
  company: string;
  courier: string;
  category: string;
  unit: string;
  protocol: string;
  status: string;
}

export default function SecuritySupervisorDeliveryManagementPage() {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await deliveriesApi.list();
      setDeliveries(
        (data || []).map((d: any) => ({
          id: d.id,
          gate_time: d.arrived_at
            ? new Date(d.arrived_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "Expected",
          company: d.provider_name || "Commercial Courier",
          courier:
            d.executive_name ||
            (d.executive_phone ? `Phone: ${d.executive_phone}` : "Courier Executive"),
          category: d.delivery_type
            ? d.delivery_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
            : "Package",
          unit: `Unit ${d.unit_id ? d.unit_id.slice(0, 6) : "Direct"}`,
          protocol: d.approval_status
            ? d.approval_status.replace(/_/g, " ").toUpperCase()
            : "STANDARD",
          status: d.status
            ? d.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
            : "Expected",
        })),
      );
    } catch {
      setDeliveries([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredDeliveries = deliveries.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      (d.company && d.company.toLowerCase().includes(q)) ||
      (d.courier && d.courier.toLowerCase().includes(q)) ||
      (d.unit && d.unit.toLowerCase().includes(q));
    const matchCategory =
      categoryFilter === "all" || (d.category && d.category.toLowerCase().includes(categoryFilter.toLowerCase()));
    return matchSearch && matchCategory;
  });

  const columns: Column<DeliveryItem>[] = [
    {
      key: "gate_time",
      header: "Gate Time",
      sortable: true,
      render: (d) => <span>⏱️ {d.gate_time}</span>,
    },
    {
      key: "company",
      header: "Delivery Provider",
      sortable: true,
      render: (d) => <span style={{ fontWeight: 600, color: "var(--fg)" }}>📦 {d.company}</span>,
    },
    {
      key: "courier",
      header: "Courier Personnel",
      sortable: true,
      render: (d) => <span>{d.courier}</span>,
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      render: (d) => <span>{d.category}</span>,
    },
    {
      key: "unit",
      header: "Destination Unit",
      sortable: true,
      render: (d) => <span>{d.unit}</span>,
    },
    {
      key: "protocol",
      header: "Protocol Decision",
      sortable: true,
      render: (d) => (
        <span style={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "monospace" }}>
          {d.protocol}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (d) => <StatusBadge status={d.status} />,
    },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Delivery Management & Protocol Oversight"
        subtitle="Monitor commercial delivery gate activity, courier verification, and resident delivery protocol decisions"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Delivery Management" },
        ]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Delivery Gate Logs</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredDeliveries.length} deliveries logged today
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: "100%", maxWidth: 220 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search courier/company/unit…"
              />
            </div>

            <select
              className="select-field"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Categories</option>
              <option value="Food">Food (Swiggy/Zomato)</option>
              <option value="E-Commerce">E-Commerce (Amazon/Flipkart)</option>
              <option value="Grocery">Grocery (Blinkit/Instamart)</option>
              <option value="Courier">Courier / Package</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredDeliveries}
          isLoading={isLoading}
          enableClientPagination={true}
          pageSize={10}
          emptyTitle="No Delivery Records Found"
          emptyDescription="There are no delivery gate logs matching your search or category filter."
          emptyIcon="📦"
        />
      </div>
    </div>
  );
}
