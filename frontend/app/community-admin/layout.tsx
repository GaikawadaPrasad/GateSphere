"use client";

import { CommunityScopeGuard } from "@/components/common/CommunityScopeGuard";
import { CommunityAdminSidebar } from "@/components/layout/CommunityAdminSidebar";
import { CommunityAdminHeader } from "@/components/layout/CommunityAdminHeader";

export default function CommunityAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommunityScopeGuard>
      <div className="app-container">
        <CommunityAdminSidebar />
        <div className="main-content">
          <CommunityAdminHeader />
          <main className="page-body">{children}</main>
        </div>
      </div>
    </CommunityScopeGuard>
  );
}
