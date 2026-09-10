"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useReveal } from "@/hooks/use-reveal";

const securityFeatures = [
  {
    id: "lookup",
    icon: (
      <svg className="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconBg: "bg-sky-950/80 border-sky-500/30",
    title: "Instant visitor lookup by name, vehicle or host",
    detail: "Sub-second search across 10,000+ registered residents & active daily visitors.",
  },
  {
    id: "qr",
    icon: (
      <svg className="w-5 h-5 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M14 14h3M14 17h1M17 17h3M14 20h3M19 14v3M20 20v.01" strokeLinecap="round" />
      </svg>
    ),
    iconBg: "bg-teal-950/80 border-teal-500/30",
    title: "QR code and OTP-based entry verification",
    detail: "Express contactless validation at pedestrian turnstiles and boom barriers.",
  },
  {
    id: "photo",
    icon: (
      <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
    iconBg: "bg-purple-950/80 border-purple-500/30",
    title: "Photo capture at gate for every entry",
    detail: "Automated ANPR camera captures license plates & driver portrait simultaneously.",
  },
  {
    id: "alerts",
    icon: (
      <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    iconBg: "bg-amber-950/80 border-amber-500/30",
    title: "Real-time alerts for unauthorised access attempts",
    detail: "Instant siren alert to supervisor desk when blacklisted plates approach.",
  },
];

export default function SecuritySection() {
  const { ref, visible } = useReveal();
  const [activeFeature, setActiveFeature] = useState(0);

  return (
    <section
      ref={ref}
      className="relative py-16 sm:py-20 overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #090D16 0%, #0D1220 50%, #090D16 100%)",
      }}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-500/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1E293B_1px,transparent_1px),linear-gradient(to_bottom,#1E293B_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center relative z-10">
        {/* ── LEFT CONTENT (6 COLS) ── */}
        <div className={`lg:col-span-6 reveal-left ${visible ? "visible" : ""}`}>
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 mb-4 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-bold tracking-wider text-cyan-300 uppercase font-mono">
              Gate Access Control
            </span>
          </div>

          {/* Main Headline */}
          <h2
            className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-white leading-[1.14]"
            style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
          >
            Security that starts<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400">
              at the gate.
            </span>
          </h2>

          <p
            className="mt-3.5 text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg font-light"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Give security teams the information and tools they need to verify every entry with confidence and sub-second speed.
          </p>

          {/* 4 Sleek Feature Cards */}
          <div className="mt-7 space-y-3">
            {securityFeatures.map((item, idx) => {
              const isSelected = activeFeature === idx;
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveFeature(idx)}
                  className={`group relative flex items-start gap-4 p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-[#151F33] border-cyan-500/60 shadow-lg shadow-cyan-950/40 translate-x-1"
                      : "bg-[#0E1524]/90 border-slate-800/90 hover:bg-[#151F33]/70 hover:border-slate-700 hover:translate-x-0.5"
                  }`}
                >
                  {/* Icon Box */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${item.iconBg} transition-transform duration-200 group-hover:scale-105 mt-0.5`}
                  >
                    {item.icon}
                  </div>

                  {/* Feature Text */}
                  <div className="flex-1 pr-4">
                    <div
                      className={`text-sm sm:text-[14.5px] font-bold transition-colors leading-snug ${
                        isSelected ? "text-white" : "text-slate-200 group-hover:text-white"
                      }`}
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      {item.title}
                    </div>
                    {isSelected && (
                      <div className="text-xs text-slate-400 mt-1 font-light leading-relaxed">
                        {item.detail}
                      </div>
                    )}
                  </div>

                  {/* Active Indicator Accent */}
                  {isSelected && (
                    <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-cyan-400 to-teal-400 self-center shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT VISUAL & FLOATING DASHBOARDS (6 COLS) ── */}
        <div className={`lg:col-span-6 reveal-right ${visible ? "visible" : ""} relative flex justify-center`}>
          <div className="relative w-full max-w-[480px]">
            {/* Main Entrance Photo with Rounded 3XL & Clean Border */}
            <div className="relative h-[360px] sm:h-[400px] rounded-3xl overflow-hidden border border-white/15 shadow-2xl bg-slate-900">
              <Image
                src="/images/security-gate-entrance.webp"
                alt="GateSphere smart security entrance and automated barrier"
                fill
                sizes="(max-width: 1024px) 100vw, 480px"
                className="object-cover transition-transform duration-500 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#090D16]/80 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* ── FLOATING CARD 1: GATE 01 METRICS (Top Left) ── */}
            <div
              className="absolute -top-3 -left-3 sm:-left-6 bg-[#0F172A]/95 border border-slate-700/80 rounded-2xl p-3.5 w-48 sm:w-52 shadow-2xl backdrop-blur-xl z-20"
              style={{
                animation: "floatCard1 5s ease-in-out infinite",
              }}
            >
              <div className="mb-2.5">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  GATE 01
                </div>
                <div
                  className="text-sm font-bold text-white tracking-tight"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  Main Entrance
                </div>
              </div>

              {/* 2x2 Metric Grid */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-[#1E293B]/80 border border-slate-700/40 rounded-xl p-2 text-center">
                  <div
                    className="text-[17px] font-bold text-[#38BDF8] leading-none"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    18
                  </div>
                  <div className="text-[9.5px] font-medium text-slate-400 mt-0.5">Visitors</div>
                </div>

                <div className="bg-[#1E293B]/80 border border-slate-700/40 rounded-xl p-2 text-center">
                  <div
                    className="text-[17px] font-bold text-[#2DD4BF] leading-none"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    07
                  </div>
                  <div className="text-[9.5px] font-medium text-slate-400 mt-0.5">Deliveries</div>
                </div>

                <div className="bg-[#1E293B]/80 border border-slate-700/40 rounded-xl p-2 text-center">
                  <div
                    className="text-[17px] font-bold text-[#4ADE80] leading-none"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    24
                  </div>
                  <div className="text-[9.5px] font-medium text-slate-400 mt-0.5">Staff</div>
                </div>

                <div className="bg-[#1E293B]/80 border border-slate-700/40 rounded-xl p-2 text-center">
                  <div
                    className="text-[17px] font-bold text-[#F87171] leading-none"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    02
                  </div>
                  <div className="text-[9.5px] font-medium text-slate-400 mt-0.5">Alerts</div>
                </div>
              </div>
            </div>

            {/* ── FLOATING CARD 2: QR VERIFICATION (Bottom Right) ── */}
            <div
              className="absolute -bottom-3 -right-3 sm:-right-6 bg-[#0F172A]/95 border border-slate-700/80 rounded-2xl p-3.5 w-52 sm:w-56 shadow-2xl backdrop-blur-xl z-20"
              style={{
                animation: "floatCard2 6s ease-in-out infinite 1.5s",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-teal-950/80 border border-teal-500/40 text-teal-400 shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <path d="M14 14h3M14 17h1M17 17h3" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-white tracking-tight">
                  QR Verification
                </span>
              </div>

              {/* Progress Line */}
              <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-800 mb-2 relative">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-all duration-1000 shadow-xs shadow-cyan-500/50"
                  style={{ width: "100%" }}
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                </svg>
                Identity confirmed
              </div>

              <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                Rahul Mehta • Tower C
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
