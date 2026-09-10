"use client";

import React from "react";
import {
  DomesticStaffDashboardView,
  DomesticStaffTab,
} from "@/features/dashboards/domestic-staff/DomesticStaffDashboardView";

export function StaffAppView({ initialTab }: { initialTab?: DomesticStaffTab }) {
  return <DomesticStaffDashboardView initialTab={initialTab || "overview"} />;
}

export default StaffAppView;
