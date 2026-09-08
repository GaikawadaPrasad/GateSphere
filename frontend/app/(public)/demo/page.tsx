"use client";

import React from "react";
import PublicLayout from "@/components/public/PublicLayout";
import PageHeroHeader from "@/components/public/PageHeroHeader";
import RequestDemo from "@/components/public/RequestDemo";
import FAQ from "@/components/public/FAQ";

export default function DemoPage() {
  return (
    <PublicLayout>
      <div className="w-full">
        {/* Demo Hero Banner */}
        <PageHeroHeader
          badge="Live Interactive Experience"
          badgeColor="blue"
          titleLead="Schedule Your Personalized"
          titleHighlight="GateSphere Walkthrough."
          subtitle="Experience live ANPR gate automation, resident super-app approvals, ERP accounting, and multi-tower emergency protocols configured for your township."
          stats={[
            { label: "Demo Duration", value: "30 Mins", icon: "⏱️" },
            { label: "Pilot Deployment", value: "48 Hours", icon: "🚀" },
            { label: "Hardware Support", value: "Turnkey", icon: "🛠️" },
            { label: "Township Scale", value: "10k+ Flats", icon: "🏙️" },
          ]}
          quickLinks={[
            { label: "Book Slot", href: "#booking" },
            { label: "Frequently Asked Questions", href: "#faq" },
          ]}
        />

        {/* 1. Request Demo Full Section */}
        <div id="booking">
          <RequestDemo />
        </div>

        {/* 2. FAQ Section */}
        <div id="faq">
          <FAQ />
        </div>
      </div>
    </PublicLayout>
  );
}
