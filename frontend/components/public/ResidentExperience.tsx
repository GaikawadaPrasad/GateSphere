"use client";

import React, { useState } from "react";
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
  const [activeItem, setActiveItem] = useState(0);

  return (
    <section
      ref={ref}
      className="relative pt-6 pb-12 sm:pt-8 sm:pb-16 bg-[#FAF9F7] overflow-hidden border-b border-slate-200/80"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* ── LEFT COLUMN: Lifestyle Mockup Image ── */}
          <div className={`lg:col-span-6 reveal-left ${visible ? "visible" : ""}`}>
            <div className="relative rounded-3xl overflow-hidden border border-slate-200/90 shadow-2xl group bg-white">
              <div className="relative h-[400px] sm:h-[460px] w-full">
                <Image
                  src="/images/resident-lifestyle.webp"
                  alt="Residents enjoying smart gated community living with mobile app"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                {/* Floating Notification Badge */}
                <div className="absolute top-6 left-6 right-6 sm:right-auto sm:max-w-sm bg-white/95 backdrop-blur-md rounded-2xl p-3.5 border border-slate-200/80 shadow-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                    🛎️
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900">Guest at Main Gate</div>
                    <div className="text-[11px] text-slate-500">Priya Sharma requested entry</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg shrink-0">
                    Approved
                  </span>
                </div>

                {/* Bottom Resident App Quote */}
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <div className="text-xs font-bold tracking-wider text-sky-400 uppercase font-mono">
                    RESIDENT SUPER-APP
                  </div>
                  <div className="text-xl sm:text-2xl font-bold tracking-tight mt-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Everything at your fingertips.
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-md">
                    One tap to pre-approve guests, pay society maintenance, book the clubhouse, and track parcel deliveries.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: 6 Feature Cards Grid ── */}
          <div className={`lg:col-span-6 reveal-right ${visible ? "visible" : ""}`}>
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 mb-3.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span
                className="text-[11px] font-bold tracking-wider text-blue-900 uppercase"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Resident Super-App
              </span>
            </div>

            {/* Headline */}
            <h2
              className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-slate-950 tracking-tight leading-[1.14] mb-3"
              style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
            >
              Everyday living,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-teal-600">
                simplified.
              </span>
            </h2>

            <p
              className="text-[15px] sm:text-[16px] text-slate-600 font-normal leading-relaxed mb-6"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Built to make high-rise apartment and gated township life completely effortless for owners and tenants alike.
            </p>

            {/* 2x3 Feature Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {residentFeatures.map((item, idx) => {
                const isSelected = activeItem === idx;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveItem(idx)}
                    className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "bg-white border-blue-500 shadow-md shadow-blue-500/10"
                        : "bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${item.iconBg}`}>
                        {item.icon}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.tagColor}`}>
                        {item.tag}
                      </span>
                    </div>
                    <h4 className="text-[13.5px] font-bold text-slate-900 mb-1">
                      {item.title}
                    </h4>
                    <p className="text-[11.5px] text-slate-500 leading-snug">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
