"use client";

import { RoleGuard } from "@/components/common/RoleGuard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function SecuritySupervisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["security_supervisor", "super_admin"]} fallback={null}>
      <DashboardLayout>{children}</DashboardLayout>
    </RoleGuard>
  );
}
