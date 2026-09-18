"use client";

import React from "react";
import dynamic from "next/dynamic";
import PublicLayout from "@/components/public/PublicLayout";
import Hero from "@/components/public/Hero";
import TrustStrip from "@/components/public/TrustStrip";

// Lazy-load below-the-fold sections to drastically reduce initial JS bundle size & execution
const EverythingYouNeed = dynamic(() => import("@/components/public/EverythingYouNeed"), {
  ssr: true,
  loading: () => <div className="min-h-[400px] w-full" />,
});
const SecuritySection = dynamic(() => import("@/components/public/SecuritySection"), {
  ssr: true,
  loading: () => <div className="min-h-[400px] w-full" />,
});
const VisitorManagement = dynamic(() => import("@/components/public/VisitorManagement"), {
  ssr: true,
  loading: () => <div className="min-h-[400px] w-full" />,
});
const ResidentExperience = dynamic(() => import("@/components/public/ResidentExperience"), {
  ssr: true,
  loading: () => <div className="min-h-[400px] w-full" />,
});
const MaintenanceTimeline = dynamic(() => import("@/components/public/MaintenanceTimeline"), {
  ssr: true,
  loading: () => <div className="min-h-[400px] w-full" />,
});
const Amenities = dynamic(() => import("@/components/public/Amenities"), {
  ssr: true,
  loading: () => <div className="min-h-[400px] w-full" />,
});
const Testimonials = dynamic(() => import("@/components/public/Testimonials"), {
  ssr: true,
  loading: () => <div className="min-h-[400px] w-full" />,
});
const RequestDemo = dynamic(() => import("@/components/public/RequestDemo"), {
  ssr: true,
  loading: () => <div className="min-h-[400px] w-full" />,
});
const FAQ = dynamic(() => import("@/components/public/FAQ"), {
  ssr: true,
  loading: () => <div className="min-h-[400px] w-full" />,
});

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
