"use client";

import React from "react";
import { OwnerTenantDashboardView, OwnerTenantTab } from "@/features/dashboards/owner-tenant/OwnerTenantDashboardView";

export function ResidentAppView({ initialTab }: { initialTab?: OwnerTenantTab }) {
  return <OwnerTenantDashboardView initialTab={initialTab || "overview"} />;
}

export default ResidentAppView;
