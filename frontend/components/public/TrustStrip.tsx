"use client";

import React from "react";
import { useReveal, useCountUp } from "@/hooks/use-reveal";

interface StatItem {
  icon: React.ReactNode;
  target: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  title: string;
  desc: string;
}

const statsData: StatItem[] = [
  {
    icon: (
      <svg className="w-5 h-5 text-blue-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    target: 500,
    suffix: "+",
    title: "Verified Communities",
    desc: "Across premier townships & societies",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-blue-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    target: 25,
    decimals: 1,
    suffix: "M+",
    title: "Residents & Users",
    desc: "Each resident verified & active",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-blue-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" strokeLinecap="round" />
      </svg>
    ),
    target: 10,
    suffix: "M+",
    title: "Monthly Gate Entries",
    desc: "Instant QR & RFID security check",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-blue-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
    prefix: "₹",
    target: 120,
    suffix: "Cr+",
    title: "Payments Processed",
    desc: "Zero-friction maintenance collections",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-blue-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    target: 800,
    suffix: "+",
    title: "Security Staff Active",
    desc: "Trained guards & facility managers",
  },
];

function StatCard({ stat, visible }: { stat: StatItem; visible: boolean }) {
  const raw = useCountUp(stat.target, 1800, visible);
  const display = (stat.decimals ?? 0) > 0
    ? (raw / Math.pow(10, stat.decimals!)).toFixed(1)
    : raw.toString();

  return (
    <div className="group relative flex flex-col items-center text-center p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-300">
      {/* Top Soft Blue Icon Circle */}
      <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3.5 bg-blue-50/70 border border-blue-100/50 transition-transform duration-300 group-hover:scale-105">
        {stat.icon}
      </div>

      {/* Main Stat Number */}
      <div
        className="text-[32px] sm:text-[36px] font-bold tracking-tight text-slate-900 leading-none"
        style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
      >
        {stat.prefix}{display}{stat.suffix}
      </div>

      {/* Label / Title */}
      <div
        className="text-[13px] font-semibold text-slate-800 mt-2"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {stat.title}
      </div>

      {/* Subtext Description */}
      <div className="text-[11.5px] text-slate-400 font-normal mt-0.5 leading-snug">
        {stat.desc}
      </div>
    </div>
  );
}

// Company logos with custom vector marks
const clientCompanies = [
  {
    name: "Prestige",
    tag: "GROUP",
    subtitle: "140+ Projects",
    badgeBg: "#EFF6FF",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" stroke="#1D4ED8" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="2" fill="#1D4ED8" />
      </svg>
    ),
  },
  {
    name: "Sobha",
    tag: "PASSION AT WORK",
    subtitle: "85+ Communities",
    badgeBg: "#F0FDFA",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="3" stroke="#0D9488" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.5" fill="#0D9488" />
      </svg>
    ),
  },
  {
    name: "Brigade",
    tag: "GROUP",
    subtitle: "110+ Societies",
    badgeBg: "#EEF2FF",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="10" width="5" height="10" rx="1" fill="#2563EB" />
        <rect x="9.5" y="6" width="5" height="14" rx="1" fill="#3B82F6" />
        <rect x="16" y="3" width="5" height="17" rx="1" fill="#60A5FA" />
      </svg>
    ),
  },
  {
    name: "Puravankara",
    tag: "HOMES",
    subtitle: "65+ Properties",
    badgeBg: "#F5F3FF",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <path d="M12 3L2 10h3v10h14V10h3L12 3z" stroke="#7C3AED" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Godrej",
    tag: "PROPERTIES",
    subtitle: "180+ Townships",
    badgeBg: "#F0FDF4",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.5 2 2 6.5 2 12c0 4 2.5 7.5 6 9 1-3 3.5-5 4-8-2 0-4-1-4-3 0-2 2-4 4-4s4 2 4 4c0 2-2 3-4 3 .5 3 3 5 4 8 3.5-1.5 6-5 6-9 0-5.5-4.5-10-10-10z" fill="#16A34A" fillOpacity="0.3" stroke="#16A34A" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    name: "Lodha",
    tag: "LUXURY LIVING",
    subtitle: "95+ Enclaves",
    badgeBg: "#FFFBEB",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <path d="M4 18h16M5 14h14M7 10h10M9 6h6M12 2v2" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "DLF",
    tag: "BUILDING INDIA",
    subtitle: "125+ Landmarks",
    badgeBg: "#F0F9FF",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <path d="M3 21h18M6 21V9l5-4v16M13 21V11l5 3v7" stroke="#0284C7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Tata Housing",
    tag: "COMMUNITIES",
    subtitle: "70+ Projects",
    badgeBg: "#EFF6FF",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#1E40AF" strokeWidth="1.8" />
        <path d="M7 9h10M12 9v9" stroke="#1E40AF" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function TrustStrip() {
  const { ref, visible } = useReveal<HTMLElement>(0.2);

  const badges = [
    { icon: "🔒", text: "ISO 27001" },
    { icon: "🛡️", text: "GDPR Compliant" },
    { icon: "☁️", text: "AWS Powered" },
  ];

  const marqueeItems = [...clientCompanies, ...clientCompanies];

  return (
    <section
      ref={ref}
      className="relative pt-10 pb-12 overflow-hidden border-b border-slate-200/80"
      style={{
        background:
          "radial-gradient(ellipse at 15% 20%, rgba(254, 243, 199, 0.35) 0%, rgba(240, 249, 255, 0.45) 45%, rgba(250, 249, 247, 0.95) 85%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* ── HEADER ── */}
        <div className="text-center max-w-4xl mx-auto mb-8">
          <div
            className="inline-block text-[11px] font-bold tracking-[0.25em] text-blue-600 uppercase mb-2.5"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            PROVEN AT SCALE
          </div>

          <h2
            className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 leading-[1.15]"
            style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
          >
            The Standard for{" "}
            <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-sky-600 to-teal-600 font-extrabold">
              Communities
              <span
                className="absolute bottom-0.5 left-0 right-0 h-[2.5px] rounded-full"
                style={{ background: "linear-gradient(90deg, #F59E0B, #38BDF8)" }}
              />
            </span>{" "}
            That Expect More
          </h2>

          <p
            className="mt-2.5 text-xs sm:text-sm text-slate-500 font-normal max-w-xl mx-auto leading-relaxed"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Delivering frictionless gate security, automated billing, and seamless living for over 2.5 million residents across India&apos;s premier townships.
          </p>
        </div>

        {/* ── STAT CARDS GRID ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4 mb-10">
          {statsData.map((stat) => (
            <StatCard key={stat.title} stat={stat} visible={visible} />
          ))}
        </div>

        {/* ── CLIENT BUILDERS BAR ── */}
        <div className="pt-6 border-t border-slate-200/80">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Trusted by Premier Builders &amp; Top Communities
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {badges.map((b) => (
                <div
                  key={b.text}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs"
                >
                  <span>{b.icon}</span>
                  <span>{b.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Marquee viewport */}
          <div className="relative w-full overflow-hidden marquee-gradient-mask py-1">
            <div className="marquee-track flex items-center gap-3.5">
              {marqueeItems.map((item, idx) => (
                <div
                  key={`${item.name}-${idx}`}
                  className="group flex items-center gap-3 px-4 py-2 rounded-xl bg-white/90 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer shrink-0"
                  style={{ minWidth: "185px" }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{ background: item.badgeBg }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-semibold text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors">
                        {item.name}
                      </span>
                      <span className="text-[8.5px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 uppercase">
                        {item.tag}
                      </span>
                    </div>
                    <span className="text-[9.5px] font-normal text-slate-400">
                      {item.subtitle}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
