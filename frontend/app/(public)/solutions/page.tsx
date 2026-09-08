"use client";

import React from "react";
import PublicLayout from "@/components/public/PublicLayout";
import PageHeroHeader from "@/components/public/PageHeroHeader";
import VisitorManagement from "@/components/public/VisitorManagement";
import ResidentExperience from "@/components/public/ResidentExperience";
import Emergency from "@/components/public/Emergency";
import Communication from "@/components/public/Communication";
import RequestDemo from "@/components/public/RequestDemo";

export default function SolutionsPage() {
  return (
    <PublicLayout>
      <div className="w-full">
        {/* Solutions Hero Banner */}
        <PageHeroHeader
          badge="End-to-End Community Architecture"
          badgeColor="blue"
          titleLead="Modern Solutions for"
          titleHighlight="Gated Ecosystems."
          subtitle="From high-security gate operations and instant visitor credentials to intelligent accounting and resident lifestyle conveniences."
          stats={[
            { label: "Gate Clearance", value: "< 2s", icon: "⚡" },
            { label: "Active Residents", value: "85k+", icon: "👥" },
            { label: "Incident Response", value: "100%", icon: "🛡️" },
            { label: "Uptime SLA", value: "99.99%", icon: "🔒" },
          ]}
          quickLinks={[
            { label: "Visitor Verification", href: "#visitors" },
            { label: "Resident Experience", href: "#resident" },
            { label: "Emergency SOS", href: "#emergency" },
            { label: "Society Comms", href: "#communication" },
          ]}
        />

        {/* 1. Complete Visitor Verification & Management */}
        <div id="visitors">
          <VisitorManagement />
        </div>

        {/* 2. Resident Experience & Daily Living */}
        <div id="resident">
          <ResidentExperience />
        </div>

        {/* 3. Emergency SOS & Siren Protocols */}
        <div id="emergency">
          <Emergency />
        </div>

        {/* 4. Society Broadcast & Communication */}
        <div id="communication">
          <Communication />
        </div>

        {/* 5. Request Demo */}
        <RequestDemo />
      </div>
    </PublicLayout>
  );
}
