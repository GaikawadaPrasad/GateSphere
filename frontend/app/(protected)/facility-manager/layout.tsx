"use client";

import { RoleGuard } from "@/components/common/RoleGuard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function FacilityManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard fallback={null}>
      <DashboardLayout>{children}</DashboardLayout>
    </RoleGuard>
  );
}
