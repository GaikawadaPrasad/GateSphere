"use client";

import type { ReactNode } from "react";
import { RoleBasedSidebar } from "@/components/layout/RoleBasedSidebar";
import { Header } from "@/components/layout/Header";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="app-container">
      <RoleBasedSidebar />
      <div className="main-content">
        <Header />
        <main className="page-body">{children}</main>
      </div>
    </div>
  );
}
