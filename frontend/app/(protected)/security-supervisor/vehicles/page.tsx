"use client";

import { Suspense } from "react";
import { VehicleOversightView } from "@/components/vehicles/VehicleOversightView";

/** Security Supervisor — vehicle & parking oversight (FR-08): gate log, flagged plates,
 *  violation lifecycle, registry and slot occupancy. */
export default function SecuritySupervisorVehiclesPage() {
  return (
    <Suspense fallback={null}>
      <VehicleOversightView
        readOnly={false}
        title="Vehicle & Parking Oversight"
        subtitle="Monitor vehicle gate movements, follow up flagged plates, and manage parking violations"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Vehicles & Parking" },
        ]}
      />
    </Suspense>
  );
}
