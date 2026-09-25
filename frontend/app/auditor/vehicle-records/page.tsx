"use client";

import { Suspense } from "react";
import { VehicleOversightView } from "@/components/vehicles/VehicleOversightView";

/** Auditor — read-only vehicle & parking records (FR-08, NFR-COMP-02: GET-only). */
export default function AuditorVehicleRecordsPage() {
  return (
    <Suspense fallback={null}>
      <VehicleOversightView
        readOnly
        title="Vehicle & Parking Records"
        subtitle="Read-only compliance view of vehicle gate movements, parking violations, registry and slots"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Auditor" }, { label: "Vehicle Records" }]}
      />
    </Suspense>
  );
}
