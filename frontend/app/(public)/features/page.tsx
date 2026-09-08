"use client";

import React from "react";
import PublicLayout from "@/components/public/PublicLayout";
import PageHeroHeader from "@/components/public/PageHeroHeader";
import EverythingYouNeed from "@/components/public/EverythingYouNeed";
import MaintenanceTimeline from "@/components/public/MaintenanceTimeline";
import Amenities from "@/components/public/Amenities";
import RequestDemo from "@/components/public/RequestDemo";

export default function FeaturesPage() {
  return (
    <PublicLayout>
      <div className="w-full">
        {/* Features Hero Banner */}
        <PageHeroHeader
          badge="Product Capabilities"
          badgeColor="sky"
          titleLead="Every Tool Built to"
          titleHighlight="Empower Societies."
          subtitle="Discover the deep interactive suite of security controls, resident living conveniences, technician SLA management, and amenity bookings."
          stats={[
            { label: "SLA Resolution", value: "2.4h", icon: "⏱️" },
            { label: "Features Included", value: "45+", icon: "✨" },
            { label: "Paperless Rate", value: "100%", icon: "🌱" },
            { label: "Resident Rating", value: "4.9 ★", icon: "⭐" },
          ]}
          quickLinks={[
            { label: "Core 3D Matrix", href: "#matrix" },
            { label: "Helpdesk SLA", href: "#sla" },
            { label: "Clubhouse Booking", href: "#amenities" },
            { label: "Explore Demo", href: "#demo" },
          ]}
        />

        {/* 1. Interactive Core Architecture Grid */}
        <div id="matrix">
          <EverythingYouNeed />
        </div>

        {/* 2. Helpdesk SLA & Maintenance Timeline */}
        <div id="sla">
          <MaintenanceTimeline />
        </div>

        {/* 3. Amenities & Clubhouse Booking Hub */}
        <div id="amenities">
          <Amenities />
        </div>

        {/* 4. Request Demo */}
        <div id="demo">
          <RequestDemo />
        </div>
      </div>
    </PublicLayout>
  );
}
