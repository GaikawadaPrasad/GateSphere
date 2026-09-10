"use client";

import { RoleGuard } from "@/components/common/RoleGuard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function SecurityGuardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["security_guard", "super_admin"]} fallback={null}>
      <DashboardLayout>{children}</DashboardLayout>
    </RoleGuard>
  );
}
