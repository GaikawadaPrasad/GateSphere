"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useReveal } from "@/hooks/use-reveal";

interface ModuleItem {
  id: string;
  image: string;
  title: string;
  category: string;
  desc: string;
  features: string[];
  cta: string;
  href: string;
}

const modules: ModuleItem[] = [
  {
    id: "security",
    image: "/images/security-gate.webp",
    title: "Security & Gate",
    category: "Access Control",
    desc: "Visitor verification, staff management, and vehicle entry.",
    features: [
      "Digital Guard Log & SOS",
      "QR Code & OTP Passes",
      "ANPR Boom Barriers",
    ],
    cta: "Explore Gate Tech",
    href: "/security",
  },
  {
    id: "resident",
    image: "/images/resident-app.webp",
    title: "Resident App",
    category: "Daily Living",
    desc: "Pre-approvals, payments, announcements and family access.",
    features: [
      "1-Tap Guest Pre-Approval",
      "Instant Bill Payments",
      "Maid & Delivery Alerts",
    ],
    cta: "View Super-App",
    href: "/solutions",
  },
  {
    id: "helpdesk",
    image: "/images/helpdesk.webp",
    title: "Helpdesk & SLA",
    category: "Facility Operations",
    desc: "Ticket creation, technician dispatch and service history.",
    features: [
      "Photo Ticket Raising",
      "Smart Tech Auto-Assign",
      "Live SLA Tracking",
    ],
    cta: "See Workflows",
    href: "/platform",
  },
  {
    id: "payments",
    image: "/images/payments.webp",
    title: "Payments & Ledger",
    category: "Finance & Accounts",
    desc: "Automated billing, reconciliation, and GST receipts.",
    features: [
      "Automated Invoicing",
      "UPI & NetBanking",
      "Audit-Ready Reports",
    ],
    cta: "Check Financials",
    href: "/features",
  },
  {
    id: "amenities",
    image: "/images/amenities.webp",
    title: "Amenities & Hub",
    category: "Clubhouse & Sports",
    desc: "Live availability, one-tap slot booking and events.",
    features: [
      "Live Slot Calendar",
      "Peak-Hour Limits",
      "Deposit Management",
    ],
    cta: "View Amenities",
    href: "/features",
  },
  {
    id: "communication",
    image: "/images/communication_card_new.webp",
    title: "Communication",
    category: "Notices & Alerts",
    desc: "Broadcast notices, targeted messages and siren alerts.",
    features: [
      "Digital Noticeboard",
      "Wing-Targeted Alerts",
      "Emergency Siren Broadcast",
    ],
    cta: "See Broadcast Tools",
    href: "/features",
  },
  {
    id: "parking",
    image: "/images/parking.webp",
    title: "Smart Parking",
    category: "Vehicles & Slots",
    desc: "Slot allocation, visitor passes and RFID automation.",
    features: [
      "RFID & Fastag Access",
      "Guest Slot Allocator",
      "Overstay Alerts",
    ],
    cta: "View Parking Tech",
    href: "/security",
  },
  {
    id: "analytics",
    image: "/images/analytics.webp",
    title: "Analytics & MIS",
    category: "Executive Reports",
    desc: "Live dashboards, visitor trends, and administrative MIS.",
    features: [
      "Live Executive Dashboard",
      "Visitor Density Trends",
      "1-Click PDF/Excel Export",
    ],
    cta: "Explore Dashboards",
    href: "/platform",
  },
];

export default function EverythingYouNeed() {
  const { ref, visible } = useReveal();
  const [selectedModule, setSelectedModule] = useState<ModuleItem | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedModule(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section
      ref={ref}
      className="relative pt-4 pb-12 sm:pt-6 sm:pb-16 bg-white overflow-hidden border-b border-slate-200/80"
      id="features"
      style={{
        backgroundImage:
          "radial-gradient(circle at 10% 20%, rgba(224, 242, 254, 0.45) 0%, transparent 45%), radial-gradient(circle at 90% 80%, rgba(240, 253, 244, 0.45) 0%, transparent 45%)",
      }}
    >
      {/* Background Geometric Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#F1F5F9_1px,transparent_1px),linear-gradient(to_bottom,#F1F5F9_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-60 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
        {/* Section Header */}
        <div className={`text-center mb-10 sm:mb-12 reveal ${visible ? "visible" : ""}`}>
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 mb-3.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span
              className="text-[11px] font-bold tracking-wider text-blue-900 uppercase"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Core Architecture
            </span>
          </div>

          {/* High-Impact Headline */}
          <h2
            className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-slate-950 tracking-tight leading-[1.14] mb-3"
            style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
          >
            One Unified{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-teal-600">
              Operating System
            </span>
          </h2>

          {/* Subtitle */}
          <p
            className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Click any module to inspect key capabilities and technical workflows.
          </p>
        </div>

        {/* 3D Compact Book Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5">
          {modules.map((m, i) => (
            <div
              key={m.id}
              className={`reveal reveal-delay-${Math.min(i + 1, 4)} ${visible ? "visible" : ""}`}
            >
              {/* 3D Book Container */}
              <div 
                className="prod-book-card group"
                onClick={() => setSelectedModule(m)}
              >
                {/* ── INSIDE PAGE ── */}
                <div className="prod-book-inside">
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                          {m.category}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      </div>

                      <h4 className="text-[13px] font-bold text-slate-900 mb-2 leading-snug">
                        {m.title}
                      </h4>

                      {/* Capabilities Checklist */}
                      <ul className="space-y-1 text-left">
                        {m.features.map((feat, fIdx) => (
                          <li key={fIdx} className="flex items-start gap-1 text-[10.5px] text-slate-600 leading-tight">
                            <span className="text-blue-600 font-bold shrink-0">✓</span>
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Inside CTA */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px] font-semibold text-blue-600 z-20 relative">
                      <span>Click to explore module</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>

                {/* ── FRONT COVER ── */}
                <div className="prod-book-cover">
                  {/* Background Image */}
                  <Image
                    src={m.image}
                    alt={m.title}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover rounded-xl transition-transform duration-700 group-hover:scale-105"
                  />

                  {/* Film Overlay */}
                  <div
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(15, 23, 42, 0.25) 0%, rgba(15, 23, 42, 0.65) 55%, rgba(15, 23, 42, 0.92) 100%)",
                    }}
                  />

                  {/* Spine Edge Ridge */}
                  <div className="prod-spine-effect" />

                  {/* Foreground Content */}
                  <div className="relative z-10 flex flex-col justify-between h-full p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-md text-slate-200 border border-white/10">
                        {m.category}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-[14px] sm:text-[15px] font-bold text-white leading-tight mb-1 tracking-tight drop-shadow-xs">
                        {m.title}
                      </h3>
                      <p className="text-[10.5px] text-slate-300 leading-snug line-clamp-2 drop-shadow-xs">
                        {m.desc}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-[9px] font-medium text-slate-400">
                        <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                        <span>Click to inspect</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DETAILED POPUP MODAL ── */}
      {selectedModule && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedModule(null)} 
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto overflow-x-hidden flex flex-col md:flex-row z-10 animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button 
              onClick={() => setSelectedModule(null)} 
              className="absolute top-4 right-4 z-20 text-slate-400 hover:text-slate-700 bg-white/80 hover:bg-slate-100 backdrop-blur-md rounded-full p-2 transition-colors cursor-pointer border-0"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Left Image */}
            <div className="w-full md:w-1/2 h-56 md:h-auto relative shrink-0 min-h-[260px]">
              <Image 
                src={selectedModule.image} 
                alt={selectedModule.title} 
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent md:bg-gradient-to-r" />
              
              <div className="absolute bottom-6 left-6 right-6 text-white z-10">
                <span className="inline-block px-3 py-1 mb-3 rounded-full bg-blue-600/90 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest border border-white/10">
                  {selectedModule.category}
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
                  {selectedModule.title}
                </h3>
              </div>
            </div>

            {/* Right: Content & CTA */}
            <div className="w-full md:w-1/2 p-6 sm:p-8 md:p-10 flex flex-col justify-center bg-slate-50">
              <h4 className="text-lg font-bold text-slate-900 mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>Overview</h4>
              <p className="text-slate-600 text-sm sm:text-base mb-8 leading-relaxed">
                {selectedModule.desc}
              </p>
              
              <h4 className="text-[13px] font-bold uppercase tracking-wider text-slate-400 mb-4">Key Capabilities</h4>
              <ul className="space-y-3 mb-10">
                {selectedModule.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-slate-700">
                    <span className="shrink-0 w-5 h-5 mt-0.5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold border border-blue-200">✓</span>
                    <span className="text-sm font-medium leading-snug">{feat}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row items-center gap-3 mt-auto pt-6 border-t border-slate-200">
                <Link 
                  href="/demo" 
                  onClick={() => setSelectedModule(null)}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                >
                  Get in Contact <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Production 3D CSS Styles */}
      <style>{`
        .prod-book-card {
          position: relative;
          border-radius: 12px;
          width: 100%;
          height: 245px;
          background-color: #ffffff;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
          transform-style: preserve-3d;
          perspective: 4000px;
          cursor: pointer;
        }

        .prod-book-inside {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border-radius: 12px;
          padding: 14px 12px 14px 28px;
          background-color: #ffffff;
          border: 1px solid #E2E8F0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
          z-index: 1;
        }

        .prod-book-cover {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border-radius: 12px;
          color: #ffffff;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease;
          transform-origin: 0% 50%;
          transform-style: preserve-3d;
          backface-visibility: hidden;
          box-shadow: 2px 6px 18px rgba(0, 0, 0, 0.16);
          border-left: 3px solid rgba(255, 255, 255, 0.35);
          z-index: 10;
        }

        .prod-spine-effect {
          position: absolute;
          inset-y: 0;
          left: 0;
          width: 10px;
          background: linear-gradient(to right, rgba(0, 0, 0, 0.35) 0%, transparent 100%);
          pointer-events: none;
          z-index: 5;
        }

        .prod-book-card:hover .prod-book-cover {
          transform: rotateY(-84deg);
          box-shadow: 10px 14px 28px rgba(0, 0, 0, 0.28);
          pointer-events: none;
        }
      `}</style>
    </section>
  );
}
