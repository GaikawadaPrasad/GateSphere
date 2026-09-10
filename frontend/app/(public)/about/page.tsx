"use client";

import React from "react";
import PublicLayout from "@/components/public/PublicLayout";
import WhyGateSphere from "@/components/public/WhyGateSphere";
import TrustStrip from "@/components/public/TrustStrip";
import Testimonials from "@/components/public/Testimonials";
import FAQ from "@/components/public/FAQ";
import RequestDemo from "@/components/public/RequestDemo";

export default function AboutPage() {
  return (
    <PublicLayout>
      <div className="w-full pt-0 sm:pt-24">
        {/* 1. Why GateSphere Foundation */}
        <WhyGateSphere />

        {/* 2. Trust Strip & Verified Stats */}
        <TrustStrip />

        {/* 3. Real Township Testimonials */}
        <Testimonials />

        {/* 4. Frequently Asked Questions */}
        <FAQ />

        {/* 5. Request Demo */}
        <RequestDemo />
      </div>
    </PublicLayout>
  );
}
