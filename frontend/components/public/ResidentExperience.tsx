"use client";

import React from "react";
import Image from "next/image";
import { useReveal } from "@/hooks/use-reveal";

interface ResidentFeature {
  id: string;
  title: string;
  desc: string;
  tag: string;
  tagColor: string;
  iconBg: string;
  icon: React.ReactNode;
}

const residentFeatures: ResidentFeature[] = [
  {
    id: "visitors",
    title: "Invite Visitors",
    desc: "Instant QR passes via WhatsApp or SMS with 1-tap host approval.",
    tag: "Instant",
    tagColor: "bg-blue-100 text-blue-800 border-blue-200",
    iconBg: "bg-blue-50 text-blue-600 border-blue-200",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "payments",
    title: "Pay Society Dues",
    desc: "Auto-recurring maintenance & utility billing via UPI, Cards, or NetBanking.",
    tag: "Auto-Pay",
    tagColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    iconBg: "bg-emerald-50 text-emerald-600 border-emerald-200",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    id: "complaints",
    title: "Raise Complaints",
    desc: "Photo tickets assigned directly to on-duty plumbers, electricians & technicians.",
    tag: "2-Hr SLA",
    tagColor: "bg-amber-100 text-amber-900 border-amber-200",
    iconBg: "bg-amber-50 text-amber-600 border-amber-200",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: "amenities",
    title: "Book Amenities",
    desc: "Reserve clubhouse, tennis courts & banquet halls with automated slot verification.",
    tag: "1-Tap Slot",
    tagColor: "bg-cyan-100 text-cyan-800 border-cyan-200",
    iconBg: "bg-cyan-50 text-cyan-600 border-cyan-200",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "deliveries",
    title: "Track Deliveries",
    desc: "Real-time gate arrival alerts for Amazon, Swiggy, and parcel lock-box pins.",
    tag: "No-Contact",
    tagColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
    iconBg: "bg-indigo-50 text-indigo-600 border-indigo-200",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    id: "updates",
    title: "Community Updates",
    desc: "Official RWA announcements, AGM notices & verified neighbor discussions.",
    tag: "Official",
    tagColor: "bg-purple-100 text-purple-800 border-purple-200",
    iconBg: "bg-purple-50 text-purple-600 border-purple-200",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
];

export default function ResidentExperience() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      className="relative py-6 sm:py-8 bg-[#FAFCFF] overflow-hidden border-b border-slate-200/60"
      style={{
        backgroundImage:
          "radial-gradient(circle at 10% 20%, rgba(224, 242, 254, 0.4) 0%, transparent 45%), radial-gradient(circle at 90% 80%, rgba(238, 242, 255, 0.45) 0%, transparent 45%)",
      }}
    >
      {/* Subtle Background Geometric Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#E2E8F0_1px,transparent_1px),linear-gradient(to_bottom,#E2E8F0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center relative z-10">
        {/* ── LEFT COLUMN: Clean 4K Luxury Community Lifestyle Showcase (5 Cols) ── */}
        <div className={`lg:col-span-5 reveal-left ${visible ? "visible" : ""} relative`}>
          {/* Main 4K Image Container */}
          <div className="relative h-[460px] rounded-3xl overflow-hidden shadow-2xl border border-slate-200/90 group">
            <Image
              src="/images/resident-lifestyle.webp"
              alt="Luxury gated community poolside and modern villas lifestyle"
              fill
              sizes="(max-width: 1024px) 100vw, 500px"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />

            {/* Subtle Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />

            {/* Bottom In-Image Trust Strip */}
            <div className="absolute bottom-4 left-4 right-4 bg-slate-950/90 backdrop-blur-md rounded-2xl p-3 border border-white/15 text-white flex items-center justify-between shadow-xl">
              <div>
                <div className="text-[9px] font-extrabold tracking-wider uppercase text-cyan-400">
                  GATESPHERE RESIDENT OS
                </div>
                <div className="text-[12.5px] font-bold text-white tracking-tight">
                  Clubhouse, Pool &amp; Home Automation
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[9.5px] font-mono text-emerald-300 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                14,000+ HOMES
              </div>
            </div>
          </div>

          {/* Floating Luxury Status Chip: Bottom Left */}
          <div
            className="absolute -bottom-3 -left-3 sm:-left-4 bg-white border border-slate-200 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md z-20 flex items-center gap-2.5"
            style={{ animation: "floatCard1 5.5s ease-in-out infinite" }}
          >
            <div className="w-8 h-8 rounded-xl bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm shadow-xs">
              ⭐
            </div>
            <div className="leading-tight pr-1">
              <div className="text-[12px] font-extrabold text-slate-900">4.9 / 5 Rating</div>
              <div className="text-[9.5px] text-slate-500 font-medium">99.2% Resident Adoption</div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Content & Uniform 2x3 Feature Matrix (7 Cols) ── */}
        <div className={`lg:col-span-7 reveal-right ${visible ? "visible" : ""}`}>
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 mb-2.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
            <span
              className="text-[11px] font-bold tracking-wider text-emerald-900 uppercase"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Resident Experience
            </span>
          </div>

          {/* Heading */}
          <h2
            className="text-2xl sm:text-3xl lg:text-[38px] font-extrabold text-slate-950 tracking-tight leading-[1.12] mb-2"
            style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
          >
            Everything residents need,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-teal-600">
              right where they live.
            </span>
          </h2>

          {/* Subtitle */}
          <p
            className="text-[14px] sm:text-[15px] text-slate-700 font-normal leading-relaxed max-w-xl mb-5"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            A single app that handles daily community life — from inviting guests to booking the pool — so residents spend more time enjoying their home.
          </p>

          {/* 2x3 Uniform Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {residentFeatures.map((item) => (
              <div
                key={item.id}
                className="group p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border ${item.iconBg} transition-transform duration-300 group-hover:scale-110 shadow-xs shrink-0`}
                  >
                    {item.icon}
                  </div>
                  <h3
                    className="text-[14.5px] font-bold text-slate-900 group-hover:text-blue-700 transition-colors tracking-tight"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    {item.title}
                  </h3>
                </div>

                <p
                  className="text-[12px] text-slate-600 font-normal leading-relaxed"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
