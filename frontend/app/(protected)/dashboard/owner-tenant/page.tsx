"use client";

import { use } from "react";
import { OwnerTenantDashboardView, OwnerTenantTab } from "@/features/dashboards/owner-tenant/OwnerTenantDashboardView";

export default function OwnerTenantPage({ params }: { params?: Promise<{ module?: string[] }> }) {
  const resolvedParams = params ? use(params) : undefined;
  const subModule = resolvedParams?.module?.[0] as OwnerTenantTab | undefined;

  return <OwnerTenantDashboardView initialTab={subModule || "overview"} />;
}
