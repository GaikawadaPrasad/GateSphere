"use client";

import React from "react";
import PublicLayout from "@/components/public/PublicLayout";
import PageHeroHeader from "@/components/public/PageHeroHeader";
import SecuritySection from "@/components/public/SecuritySection";
import Emergency from "@/components/public/Emergency";
import RequestDemo from "@/components/public/RequestDemo";

export default function SecurityPage() {
  return (
    <PublicLayout>
      <div className="w-full bg-[#090D16]">
        {/* Security Hero Banner */}
        <PageHeroHeader
          badge="Enterprise Physical & Cyber Security"
          badgeColor="rose"
          titleLead="Zero-Trust Defense for"
          titleHighlight="Modern Communities."
          subtitle="ANPR camera integration, RFID automated boom barriers, verified biometric records, and instant cryptographic visitor access tokens."
          stats={[
            { label: "ANPR Accuracy", value: "99.8%", icon: "📷" },
            { label: "Barrier Speed", value: "1.2s", icon: "⚡" },
            { label: "Emergency Dispatch", value: "< 15s", icon: "🚨" },
            { label: "Security Audit", value: "ISO 27001", icon: "🛡️" },
          ]}
          quickLinks={[
            { label: "Gate Hardware & ANPR", href: "#security-hardware" },
            { label: "Emergency Protocols", href: "#emergency-protocols" },
            { label: "Book Security Audit", href: "#demo" },
          ]}
        />

        {/* 1. Deep-Dive Security Hardware & Systems */}
        <div id="security-hardware">
          <SecuritySection />
        </div>

        {/* 2. Emergency SOS Broadcast Protocols */}
        <div id="emergency-protocols">
          <Emergency />
        </div>

        {/* 3. Request Demo */}
        <div id="demo">
          <RequestDemo />
        </div>
      </div>
    </PublicLayout>
  );
}
