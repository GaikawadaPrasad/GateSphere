"use client";

import { AssociationCommitteeScopeGuard } from "@/components/common/AssociationCommitteeScopeGuard";
import { AssociationCommitteeSidebar } from "@/components/layout/AssociationCommitteeSidebar";
import { AssociationCommitteeHeader } from "@/components/layout/AssociationCommitteeHeader";

export default function AssociationCommitteeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AssociationCommitteeScopeGuard>
      <div className="app-container">
        <AssociationCommitteeSidebar />
        <div className="main-content">
          <AssociationCommitteeHeader />
          <main className="page-body">{children}</main>
        </div>
      </div>
    </AssociationCommitteeScopeGuard>
  );
}
