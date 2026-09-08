"use client";

import React from "react";
import PublicLayout from "@/components/public/PublicLayout";
import PageHeroHeader from "@/components/public/PageHeroHeader";
import ProductEcosystem from "@/components/public/ProductEcosystem";
import WhyGateSphere from "@/components/public/WhyGateSphere";
import PaymentsFinance from "@/components/public/PaymentsFinance";
import RequestDemo from "@/components/public/RequestDemo";

export default function PlatformPage() {
  return (
    <PublicLayout>
      <div className="w-full">
        {/* Platform Hero Banner */}
        <PageHeroHeader
          badge="Enterprise Township OS"
          badgeColor="indigo"
          titleLead="The Unified Architecture for"
          titleHighlight="Smart Gated Communities."
          subtitle="A single cloud-native engine synchronizing physical gate terminals, resident mobile apps, maintenance SLA desks, and financial ledgers."
          stats={[
            { label: "Core Modules", value: "10+", icon: "🧩" },
            { label: "Sync Latency", value: "< 20ms", icon: "⚡" },
            { label: "Monthly Logins", value: "1.2M", icon: "📱" },
            { label: "Cloud Uptime", value: "99.99%", icon: "☁️" },
          ]}
          quickLinks={[
            { label: "Orbital Topology", href: "#ecosystem" },
            { label: "Strategic Pillars", href: "#why" },
            { label: "Billing & Ledger", href: "#finance" },
            { label: "Book Platform Tour", href: "#demo" },
          ]}
        />

        {/* 1. Product Ecosystem Platform Architecture */}
        <div id="ecosystem">
          <ProductEcosystem />
        </div>

        {/* 2. Why GateSphere Foundation & Strategic Pillars */}
        <div id="why">
          <WhyGateSphere />
        </div>

        {/* 3. Integrated Financial & Payment Engine */}
        <div id="finance">
          <PaymentsFinance />
        </div>

        {/* 4. Request Live Demo */}
        <div id="demo">
          <RequestDemo />
        </div>
      </div>
    </PublicLayout>
  );
}
