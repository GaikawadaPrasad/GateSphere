"use client";

import React from "react";
import PublicLayout from "@/components/public/PublicLayout";
import RequestDemo from "@/components/public/RequestDemo";
import FAQ from "@/components/public/FAQ";

export default function DemoPage() {
  return (
    <PublicLayout>
      <div className="w-full pt-0 sm:pt-24">
        {/* 1. Request Demo Full Section */}
        <RequestDemo />

        {/* 2. FAQ Section */}
        <FAQ />
      </div>
    </PublicLayout>
  );
}
