"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useReveal } from "@/hooks/use-reveal";

interface SecurityFeature {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  detail: string;
}

const securityFeatures: SecurityFeature[] = [
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
                      : "bg-[#0F172A]/70 border-slate-800/80 hover:bg-[#151F33]/70 hover:border-slate-700"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${item.iconBg} transition-transform group-hover:scale-105`}
                  >
                    {item.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4
                        className={`text-sm sm:text-[14.5px] font-bold transition-colors ${
                          isSelected ? "text-cyan-300" : "text-white group-hover:text-cyan-300"
                        }`}
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        {item.title}
                      </h4>
                      {isSelected && (
                        <span className="text-xs text-cyan-400 font-mono shrink-0 font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed font-normal">
                      {item.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT VISUAL (6 COLS) ── */}
        <div className={`lg:col-span-6 reveal-right ${visible ? "visible" : ""}`}>
          <div className="relative rounded-3xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-950/80 backdrop-blur-xl group">
            {/* Top Terminal Status Bar */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                <span className="text-slate-300 font-mono font-medium">GATE-NORTH · TERMINAL 01</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-semibold">ANPR LIVE</span>
                <span>SUB-SECOND AI</span>
              </div>
            </div>

            {/* Embedded Live Gate Showcase Image */}
            <div className="relative h-[340px] sm:h-[390px] w-full overflow-hidden">
              <Image
                src="/images/security-gate-entrance.webp"
                alt="Automated High-Security Residential Gate Entrance"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

              {/* Live Overlay Badge - Verified Entry */}
              <div className="absolute bottom-5 left-5 right-5 bg-slate-950/90 backdrop-blur-md rounded-2xl p-4 border border-cyan-500/30 text-white shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-mono font-bold text-emerald-300 uppercase">
                      Vehicle Verified · Gate Opened
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">0.42s latency</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                  <div>KA-01-MJ-4028 · Guest of Tower B, 1402</div>
                  <div className="text-cyan-400 font-mono font-bold">PASS #GS-7821</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
