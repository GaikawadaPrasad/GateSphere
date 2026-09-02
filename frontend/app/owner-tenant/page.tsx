"use client";

import { OwnerTenantDashboardView } from "@/features/dashboards/owner-tenant/OwnerTenantDashboardView";

export default function OwnerTenantRootPage() {
  return <OwnerTenantDashboardView initialTab="overview" />;
}
