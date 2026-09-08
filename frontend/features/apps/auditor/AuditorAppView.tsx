"use client";

import React, { useState } from "react";
import { AuditorDashboardView, AuditorTab } from "@/features/dashboards/auditor/AuditorDashboardView";

export function AuditorAppView({ initialTab }: { initialTab?: AuditorTab }) {
  return <AuditorDashboardView initialTab={initialTab || "overview"} />;
}

export default AuditorAppView;
