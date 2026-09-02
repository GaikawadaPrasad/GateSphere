"use client";

import { use } from "react";
import { DomesticStaffDashboardView, DomesticStaffTab } from "@/features/dashboards/domestic-staff/DomesticStaffDashboardView";

export default function DomesticStaffPage({ params }: { params?: Promise<{ module?: string[] }> }) {
  const resolvedParams = params ? use(params) : undefined;
  const subModule = resolvedParams?.module?.[0] as DomesticStaffTab | undefined;

  return <DomesticStaffDashboardView initialTab={subModule || "overview"} />;
}
