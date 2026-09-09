"use client";

import { RoleGuard } from "@/components/common/RoleGuard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function VendorTechnicianLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["vendor_technician", "super_admin"]} fallback={null}>
      <DashboardLayout>{children}</DashboardLayout>
    </RoleGuard>
  );
}
