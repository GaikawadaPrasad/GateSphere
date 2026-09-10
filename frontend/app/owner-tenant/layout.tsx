"use client";

import { RoleGuard } from "@/components/common/RoleGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function OwnerTenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["resident", "owner", "tenant", "super_admin"]}>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Header />
          <main className="page-body">{children}</main>
        </div>
      </div>
    </RoleGuard>
  );
}
