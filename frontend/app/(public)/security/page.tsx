"use client";

import React from "react";
import dynamic from "next/dynamic";
import PublicLayout from "@/components/public/PublicLayout";
import SecuritySection from "@/components/public/SecuritySection";

const Emergency = dynamic(() => import("@/components/public/Emergency"), { ssr: true });
const RequestDemo = dynamic(() => import("@/components/public/RequestDemo"), { ssr: true });

export default function SecurityPage() {
  return (
    <PublicLayout>
      <div className="w-full pt-0 sm:pt-24 bg-[#090D16]">
        {/* 1. Deep-Dive Security Hardware & Systems */}
        <SecuritySection />

        {/* 2. Emergency SOS Broadcast Protocols */}
        <Emergency />

        {/* 3. Request Demo */}
        <RequestDemo />
      </div>
    </PublicLayout>
  );
}
