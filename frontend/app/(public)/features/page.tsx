"use client";

import React from "react";
import PublicLayout from "@/components/public/PublicLayout";
import EverythingYouNeed from "@/components/public/EverythingYouNeed";
import MaintenanceTimeline from "@/components/public/MaintenanceTimeline";
import Amenities from "@/components/public/Amenities";
import RequestDemo from "@/components/public/RequestDemo";

export default function FeaturesPage() {
  return (
    <PublicLayout>
      <div className="w-full pt-0 sm:pt-24">
        {/* 1. Interactive Core Architecture Grid */}
        <EverythingYouNeed />

        {/* 2. Helpdesk SLA & Maintenance Timeline */}
        <MaintenanceTimeline />

        {/* 3. Amenities & Clubhouse Booking Hub */}
        <Amenities />

        {/* 4. Request Demo */}
        <RequestDemo />
      </div>
    </PublicLayout>
  );
}
