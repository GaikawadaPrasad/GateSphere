"use client";

import React from "react";
import PublicLayout from "@/components/public/PublicLayout";
import ProductEcosystem from "@/components/public/ProductEcosystem";
import WhyGateSphere from "@/components/public/WhyGateSphere";
import RequestDemo from "@/components/public/RequestDemo";

export default function PlatformPage() {
  return (
    <PublicLayout>
      <div className="w-full pt-0 sm:pt-24">
        {/* 1. Product Ecosystem Platform Architecture */}
        <ProductEcosystem />

        {/* 2. Why GateSphere Foundation & Township Scale */}
        <WhyGateSphere />

        {/* 3. Request Live Demo */}
        <RequestDemo />
      </div>
    </PublicLayout>
  );
}
