"use client";

import { use } from "react";
import { AuditorDashboardView, AuditorTab } from "@/features/dashboards/auditor/AuditorDashboardView";

export default function AuditorDashboardPage({ params }: { params?: Promise<{ module?: string[] }> }) {
  const resolvedParams = params ? use(params) : undefined;
  const subModule = resolvedParams?.module?.[0] as AuditorTab | undefined;

  return <AuditorDashboardView initialTab={subModule || "overview"} />;
}
