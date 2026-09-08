"use client";

import React from "react";
import PublicLayout from "@/components/public/PublicLayout";
import Hero from "@/components/public/Hero";
import TrustStrip from "@/components/public/TrustStrip";
import EverythingYouNeed from "@/components/public/EverythingYouNeed";
import SecuritySection from "@/components/public/SecuritySection";
import VisitorManagement from "@/components/public/VisitorManagement";
import ResidentExperience from "@/components/public/ResidentExperience";
import MaintenanceTimeline from "@/components/public/MaintenanceTimeline";
import Amenities from "@/components/public/Amenities";
import Testimonials from "@/components/public/Testimonials";
import RequestDemo from "@/components/public/RequestDemo";
import FAQ from "@/components/public/FAQ";

export default function HomePage() {
  return (
    <PublicLayout>
      <div className="w-full">
        {/* 1. Hero Fullscreen Cinematic Video */}
        <Hero />

        {/* 2. Trust Strip & Verified Stats */}
        <TrustStrip />

        {/* 3. Core Architecture 3D Interactive Grid */}
        <EverythingYouNeed />

        {/* 4. Gate Security & Surveillance Deep Dive */}
        <SecuritySection />

        {/* 5. Visitor Verification & Management */}
        <VisitorManagement />

        {/* 6. Resident Super-App Experience */}
        <ResidentExperience />

        {/* 7. Helpdesk & 2-Hour SLA Maintenance Timeline */}
        <MaintenanceTimeline />

        {/* 8. Clubhouse & Amenities Infinite Carousel */}
        <Amenities />

        {/* 9. Verified RWA & Leadership Testimonials */}
        <Testimonials />

        {/* 10. Live Demo Booking Form */}
        <RequestDemo />

        {/* 11. Frequently Asked Questions */}
        <FAQ />
      </div>
    </PublicLayout>
  );
}
