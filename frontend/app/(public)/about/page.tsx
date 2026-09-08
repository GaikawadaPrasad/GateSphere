"use client";

import React from "react";
import PublicLayout from "@/components/public/PublicLayout";
import PageHeroHeader from "@/components/public/PageHeroHeader";
import WhyGateSphere from "@/components/public/WhyGateSphere";
import TrustStrip from "@/components/public/TrustStrip";
import Testimonials from "@/components/public/Testimonials";
import FAQ from "@/components/public/FAQ";
import RequestDemo from "@/components/public/RequestDemo";

export default function AboutPage() {
  return (
    <PublicLayout>
      <div className="w-full">
        {/* About Hero Banner */}
        <PageHeroHeader
          badge="Mission & Reliability"
          badgeColor="emerald"
          titleLead="Building the Trust Infrastructure for"
          titleHighlight="Modern Gated Living."
          subtitle="GateSphere was founded with a singular purpose: replace obsolete paperwork, slow boom barriers, and siloed spreadsheets with an enterprise-grade community operating system."
          stats={[
            { label: "Communities Live", value: "350+", icon: "🏙️" },
            { label: "Daily Gate Passes", value: "45,000+", icon: "🎫" },
            { label: "Active Residents", value: "85,000+", icon: "👥" },
            { label: "Satisfaction SLA", value: "99.8%", icon: "🏆" },
          ]}
          quickLinks={[
            { label: "Strategic Pillars", href: "#pillars" },
            { label: "Trust & Stats", href: "#trust" },
            { label: "RWA Reviews", href: "#testimonials" },
            { label: "FAQ", href: "#faq" },
          ]}
        />

        {/* 1. Why GateSphere Foundation */}
        <div id="pillars">
          <WhyGateSphere />
        </div>

        {/* 2. Trust Strip & Verified Stats */}
        <div id="trust">
          <TrustStrip />
        </div>

        {/* 3. Real Township Testimonials */}
        <div id="testimonials">
          <Testimonials />
        </div>

        {/* 4. Frequently Asked Questions */}
        <div id="faq">
          <FAQ />
        </div>

        {/* 5. Request Demo */}
        <RequestDemo />
      </div>
    </PublicLayout>
  );
}
