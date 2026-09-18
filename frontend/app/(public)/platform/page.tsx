"use client";

import React from "react";
import dynamic from "next/dynamic";
import PublicLayout from "@/components/public/PublicLayout";
import ProductEcosystem from "@/components/public/ProductEcosystem";

const WhyGateSphere = dynamic(() => import("@/components/public/WhyGateSphere"), { ssr: true });
const RequestDemo = dynamic(() => import("@/components/public/RequestDemo"), { ssr: true });

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
