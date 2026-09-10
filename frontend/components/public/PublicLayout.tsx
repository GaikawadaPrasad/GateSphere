"use client";

import React from "react";
import Header from "./Header";
import Footer from "./Footer";
import IntroLoader from "./IntroLoader";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F7] text-slate-900 font-sans selection:bg-blue-600 selection:text-white overflow-x-hidden w-full max-w-full">
      {/* Initial load intro loader */}
      <IntroLoader />

      {/* Global Public Navigation Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-grow w-full overflow-x-hidden max-w-full">{children}</main>

      {/* Global Public Footer */}
      <Footer />
    </div>
  );
}
