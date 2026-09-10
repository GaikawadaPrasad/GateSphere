"use client";

import React from "react";
import PublicLayout from "@/components/public/PublicLayout";
import VisitorManagement from "@/components/public/VisitorManagement";
import ResidentExperience from "@/components/public/ResidentExperience";
import Emergency from "@/components/public/Emergency";
import Communication from "@/components/public/Communication";
import RequestDemo from "@/components/public/RequestDemo";

export default function SolutionsPage() {
  return (
    <PublicLayout>
      <div className="w-full pt-0 sm:pt-24">
        {/* 1. Complete Visitor Verification & Management */}
        <VisitorManagement />

        {/* 2. Resident Experience & Daily Living */}
        <ResidentExperience />

        {/* 3. Emergency SOS & Siren Protocols */}
        <Emergency />

        {/* 4. Society Broadcast & Communication */}
        <Communication />

        {/* 5. Request Demo */}
        <RequestDemo />
      </div>
    </PublicLayout>
  );
}
