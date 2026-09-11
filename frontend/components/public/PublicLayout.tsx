"use client";

import React from "react";
import Header from "./Header";
import Footer from "./Footer";
import IntroLoader from "./IntroLoader";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F7] text-slate-900 font-sans selection:bg-blue-600 selection:text-white w-full max-w-full">
      {/* 
        IntroLoader wraps the whole page so its z-index (60) covers 
        the Header (50) and main content.
      */}
      <IntroLoader />

      {/* Global Public Navigation Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-grow w-full max-w-full">{children}</main>

      {/* Global Public Footer */}
      <Footer />
    </div>
  );
}
