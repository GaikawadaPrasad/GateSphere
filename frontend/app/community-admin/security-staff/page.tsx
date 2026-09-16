"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { OperationalStaffView } from "@/components/community-admin/OperationalStaffView";

export default function SecurityAndFacilityStaffPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Personnel & Committee Management"
        description="View and provision Association Committee Members, Facility Managers, Security Supervisors, and Security Guards for this community."
      />
      <OperationalStaffView />
    </div>
  );
}
