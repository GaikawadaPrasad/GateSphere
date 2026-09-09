"use client";

import React, { useState, useEffect } from "react";
import { useReveal } from "@/hooks/use-reveal";

interface FeatureItem {
  id: string;
  title: string;
  desc: string;
  badge: string;
  badgeColor?: string;
  iconBg: string;
  iconColor?: string;
  icon: React.ReactNode;
}

const features: FeatureItem[] = [
  {
    id: "pre-approval",
    title: "Instant Pre-Approval",
    desc: "Residents generate digital invites with expected arrival times and vehicle details.",
    badge: "1-Tap Invite",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    iconBg: "bg-blue-100/90 border-blue-300 text-blue-700",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <rect x="5" y="2" width="14" height="20" rx="3" />
        <path d="M12 18h.01" strokeLinecap="round" strokeWidth="3" />
        <path d="M9 7h6M9 11h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "otp-entry",
    title: "QR & OTP Verification",
    desc: "Contactless gate check-in via 6-digit dynamic OTP or encrypted QR pass scan.",
    badge: "Sub-3s Entry",
    badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
    iconBg: "bg-teal-100/90 border-teal-300 text-teal-700",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M14 14h3M14 17h1M17 17h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "photo-capture",
    title: "Automated ANPR Photo",
    desc: "High-res gate cameras capture vehicle license plate and visitor photo automatically.",
    badge: "AI Lens",
    badgeColor: "bg-amber-100 text-amber-900 border-amber-200",
    iconBg: "bg-amber-100/90 border-amber-300 text-amber-800",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    id: "full-log",
    title: "Immutable Gate Ledger",
    desc: "Searchable, real-time entry and exit audit trail with automatic overstay detection.",
    badge: "100% Audit",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    iconBg: "bg-emerald-100/90 border-emerald-300 text-emerald-800",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

export default function VisitorManagement() {
  const { ref, visible } = useReveal();
  const [scanState, setScanState] = useState<"scanning" | "success">("scanning");

  // Loop: Scanning for 2.5s -> Success checkmark for 2.5s -> Loop
  useEffect(() => {
    const timer = setInterval(() => {
      setScanState((prev) => (prev === "scanning" ? "success" : "scanning"));
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      ref={ref}
      className="relative pt-4 pb-8 sm:pt-6 sm:pb-10 bg-white overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(circle at 10% 20%, rgba(224, 242, 254, 0.5) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(204, 251, 241, 0.4) 0%, transparent 40%)",
      }}
    >
      {/* Subtle Background Geometric Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#E2E8F0_1px,transparent_1px),linear-gradient(to_bottom,#E2E8F0_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_75%,transparent_100%)] opacity-35 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center relative z-10">
        {/* ── LEFT COLUMN: Slim & Tall Flagship Smartphone (5 Cols) ── */}
        <div className={`lg:col-span-5 reveal-left ${visible ? "visible" : ""} flex justify-center items-center relative order-2 lg:order-1`}>
          {/* Main Presentation Container */}
          <div className="relative w-full max-w-[268px]">
            {/* Ambient Device Glow */}
            <div
              className={`absolute -inset-4 transition-all duration-700 rounded-[56px] blur-2xl pointer-events-none ${
                scanState === "success"
                  ? "bg-gradient-to-tr from-emerald-500/25 via-teal-400/25 to-cyan-500/20"
                  : "bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-teal-400/20"
              }`}
            />

            {/* Hardware Side Buttons */}
            <div className="absolute -left-[3.5px] top-24 w-[3px] h-7 bg-slate-700 rounded-l-sm" />
            <div className="absolute -left-[3.5px] top-35 w-[3px] h-10 bg-slate-700 rounded-l-sm" />
            <div className="absolute -left-[3.5px] top-48 w-[3px] h-10 bg-slate-700 rounded-l-sm" />
            <div className="absolute -right-[3.5px] top-32 w-[3px] h-14 bg-slate-700 rounded-r-sm" />

            {/* Slim Smartphone Outer Shell */}
            <div className="relative rounded-[46px] bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 p-[7px] shadow-2xl ring-1 ring-white/20 border border-slate-700/80 backdrop-blur-xl">
              {/* Screen Bezel Frame */}
              <div className="rounded-[40px] bg-black p-[2px] overflow-hidden shadow-inner">
                {/* Inner Screen Display */}
                <div className="rounded-[38px] bg-gradient-to-b from-[#0B132B] via-[#0D1836] to-[#070C1C] text-white p-3 pt-2.5 shadow-inner relative overflow-hidden flex flex-col justify-between h-[505px]">
                  {/* Status Bar & Dynamic Island */}
                  <div className="relative flex items-center justify-between text-[10px] font-semibold text-slate-300 px-1 pt-1 pb-1.5">
                    <span className="font-bold tracking-tight">9:41</span>

                    {/* Slim Dynamic Island */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 bg-black h-4.5 w-20 rounded-full flex items-center justify-between px-2 z-30 shadow-md border border-slate-800/80">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-900 border border-slate-700" />
                      <div
                        className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                          scanState === "success" ? "bg-emerald-400 animate-ping" : "bg-blue-500 animate-pulse"
                        }`}
                      />
                    </div>

                    {/* Wifi, Signal, Battery Icons */}
                    <div className="flex items-center gap-1 text-slate-300">
                      <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 16 16">
                        <path d="M0 11.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-3zm4-3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-6zm4-3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-9zm4-3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-12z" />
                      </svg>
                      <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 16 16">
                        <path d="M15.384 6.115a.485.485 0 0 0-.047-.736A12.444 12.444 0 0 0 8 3C4.82 3 1.95 4.2 0 6.136a.485.485 0 0 0-.047.736l7.683 7.82a.485.485 0 0 0 .728 0l7.02-7.577z" />
                      </svg>
                      <div className="w-4 h-2 rounded-[2.5px] border border-slate-400 p-[0.8px] flex items-center">
                        <div className="h-full w-[85%] bg-emerald-400 rounded-[1px]" />
                      </div>
                    </div>
                  </div>

                  {/* App Header */}
                  <div className="flex items-center justify-between px-1 py-1 border-b border-white/10">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4.5 h-4.5 rounded-md bg-blue-600 flex items-center justify-center text-[9px] font-black">
                        GS
                      </div>
                      <span className="text-[11px] font-bold tracking-tight text-white">GateSphere</span>
                    </div>
                    <span
                      className={`text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-1 transition-all duration-300 ${
                        scanState === "success"
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/50"
                          : "bg-cyan-950/80 text-cyan-300 border-cyan-500/40"
                      }`}
                    >
                      <span
                        className={`w-1 h-1 rounded-full ${
                          scanState === "success" ? "bg-emerald-400 animate-ping" : "bg-cyan-400 animate-pulse"
                        }`}
                      />
                      {scanState === "success" ? "VERIFIED" : "GATE 01"}
                    </span>
                  </div>

                  {/* Main Digital Pass Container */}
                  <div
                    className={`rounded-xl border transition-all duration-500 p-2.5 shadow-lg relative overflow-hidden my-0.5 space-y-2 ${
                      scanState === "success"
                        ? "bg-gradient-to-b from-[#0E2828] to-[#081B1B] border-emerald-500/50"
                        : "bg-gradient-to-b from-[#132142] to-[#0E1832] border-cyan-500/30"
                    }`}
                  >
                    {/* Visitor Header Card */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center font-bold text-white text-[11px] shadow-md shrink-0">
                          RS
                        </div>
                        <div>
                          <div className="text-[12px] font-bold text-white leading-tight">
                            Rahul Sharma
                          </div>
                          <div className="text-[9.5px] text-slate-300">
                            Host: <span className="text-cyan-300 font-semibold">Apt 304, Tower A</span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[8px] font-bold border px-1.5 py-0.5 rounded-full transition-colors duration-300 ${
                          scanState === "success"
                            ? "bg-emerald-500/30 text-emerald-300 border-emerald-400"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        }`}
                      >
                        {scanState === "success" ? "✓ APPROVED" : "GUEST"}
                      </span>
                    </div>

                    {/* QR Code Pass Container with Scanning & Success State */}
                    <div
                      className={`relative rounded-lg p-2 border transition-all duration-500 flex flex-col items-center justify-center overflow-hidden shadow-inner ${
                        scanState === "success"
                          ? "bg-emerald-950/90 border-emerald-500/60 shadow-emerald-500/20"
                          : "bg-slate-950/90 border-cyan-500/40"
                      }`}
                    >
                      {/* Laser Beam */}
                      {scanState === "scanning" && (
                        <div
                          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent pointer-events-none shadow-sm shadow-cyan-400 z-20"
                          style={{ animation: "scanBeam 2.4s ease-in-out infinite" }}
                        />
                      )}

                      {/* QR Code Graphic or Success Checkmark Overlay */}
                      <div className="w-22 h-22 bg-white p-1 rounded-md shadow-md flex items-center justify-center relative z-10 overflow-hidden">
                        <svg
                          viewBox="0 0 100 100"
                          className={`w-full h-full fill-slate-950 transition-opacity duration-300 ${
                            scanState === "success" ? "opacity-20 scale-95" : "opacity-100 scale-100"
                          }`}
                        >
                          <path d="M0 0h30v30H0zm6 6v18h18V6zm4 4h10v10H10zM70 0h30v30H70zm6 6v18h18V6zm4 4h10v10H80zM0 70h30v30H0zm6 6v18h18V6zm4 4h10v10H10z" />
                          <path d="M40 10h10v10H40zm10 20h10v10H50zm-10 10h20v10H40zm20-20h10v10H60zm-20 40h10v10H40zm20 0h20v10H60zm10-20h20v10H70zm0 30h10v10H70zm10 0h10v10H80zm-70-10h10v10H10z" />
                        </svg>

                        {scanState === "success" && (
                          <div className="absolute inset-0 bg-emerald-500/90 flex flex-col items-center justify-center text-white">
                            <div className="w-9 h-9 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-lg">
                              <svg className="w-5 h-5 stroke-current stroke-[3] fill-none" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-[8.5px] font-black uppercase tracking-wider text-white mt-1 drop-shadow">
                              PASSED
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Pass Status Label */}
                      <div
                        className={`mt-1.5 text-[8px] font-mono font-bold tracking-wider transition-colors duration-300 ${
                          scanState === "success" ? "text-emerald-300 animate-pulse" : "text-cyan-300"
                        }`}
                      >
                        {scanState === "success" ? "✓ GATE SCAN SUCCESSFUL" : "PASS #GS-88294-VERIFIED"}
                      </div>
                    </div>

                    {/* Pass Meta Grid */}
                    <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-200 py-1 border-t border-white/10 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[7.5px]">VEHICLE</span>
                        <span className="text-white font-bold">KA 01 AB 1234</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[7.5px]">ARRIVAL</span>
                        <span className="text-emerald-400 font-bold">Today • 7:30 PM</span>
                      </div>
                    </div>

                    {/* Boom Barrier Button */}
                    <div
                      className={`py-1.5 rounded-lg font-bold text-[10px] tracking-wide text-center shadow-md flex items-center justify-center gap-1.5 transition-all duration-500 text-white ${
                        scanState === "success"
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/30 ring-1 ring-emerald-400/50"
                          : "bg-gradient-to-r from-emerald-600 to-teal-600"
                      }`}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                      </svg>
                      {scanState === "success" ? "BOOM BARRIER OPENED" : "BOOM BARRIER GRANTED"}
                    </div>
                  </div>

                  {/* Bottom Navigation Dock */}
                  <div className="flex items-center justify-around pt-1 text-slate-400 border-t border-white/10 text-[8.5px]">
                    <div className="flex flex-col items-center gap-0.5 text-cyan-400 font-bold">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                        <path d="M14 14h3M14 17h1M17 17h3" strokeLinecap="round" />
                      </svg>
                      <span>Pass</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 hover:text-slate-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      </svg>
                      <span>Home</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 hover:text-slate-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span>Gate</span>
                    </div>
                  </div>

                  {/* Bottom Home Indicator */}
                  <div className="w-16 h-1 bg-slate-600 rounded-full mx-auto" />
                </div>
              </div>
            </div>

            {/* Floating Live Verification Status Cards */}
            <div
              className="absolute -top-3 -right-6 sm:-right-10 bg-white border border-slate-300 rounded-xl p-2 shadow-xl backdrop-blur-md z-30 flex items-center gap-2 w-42"
              style={{ animation: "floatCard1 5s ease-in-out infinite" }}
            >
              <div className="w-6.5 h-6.5 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center shrink-0 font-bold">
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                </svg>
              </div>
              <div className="leading-tight">
                <div className="text-[11px] font-bold text-slate-900">Pre-Approved</div>
                <div className="text-[9px] text-slate-600 font-medium">7:28 PM • Apt 304</div>
              </div>
            </div>

            <div
              className="absolute -bottom-3 -right-4 sm:-right-8 bg-white border border-slate-300 rounded-xl p-2 shadow-xl backdrop-blur-md z-30 flex items-center gap-2 w-46"
              style={{ animation: "floatCard2 6s ease-in-out infinite 1.2s" }}
            >
              <div className="w-6.5 h-6.5 rounded-lg bg-blue-100 border border-blue-300 text-blue-800 flex items-center justify-center shrink-0 font-bold">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </div>
              <div className="leading-tight">
                <div className="text-[11px] font-bold text-slate-900">ANPR Gate 01</div>
                <div className="text-[9px] text-slate-600 font-medium">7:32 PM • Verified</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: High-Contrast Editorial Content & Feature Cards (7 Cols) ── */}
        <div className={`lg:col-span-7 reveal-right ${visible ? "visible" : ""} order-1 lg:order-2`}>
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 border border-teal-300 mb-2 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-teal-700 animate-ping" />
            <span
              className="text-[11px] font-bold tracking-wider text-teal-900 uppercase"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Visitor Management
            </span>
          </div>

          {/* Heading */}
          <h2
            className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-slate-950 tracking-tight leading-[1.14] mb-2"
            style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
          >
            Know who&apos;s coming<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-700">
              before they arrive.
            </span>
          </h2>

          {/* Subtitle */}
          <p
            className="text-[13.5px] sm:text-[14px] text-slate-700 font-normal leading-relaxed max-w-xl mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Residents pre-approve guests in one tap. Security teams receive automated photo and license verification, while every vehicle entry and exit is logged with zero manual registers.
          </p>

          {/* 2x2 Rich Interactive Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {features.map((item) => (
              <div
                key={item.id}
                className="group p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer shadow-xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center border ${item.iconBg} transition-transform duration-300 group-hover:scale-105 shadow-xs`}
                  >
                    {item.icon}
                  </div>
                  <span className={`text-[9.5px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                </div>

                <h3
                  className="text-[13.5px] font-bold text-slate-900 group-hover:text-blue-700 transition-colors tracking-tight mb-0.5"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {item.title}
                </h3>

                <p
                  className="text-[11.5px] text-slate-600 font-normal leading-relaxed"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Bottom Security Trust Seal */}
          <div className="mt-4 flex flex-wrap items-center gap-5 pt-3 border-t border-slate-200 text-[11px] font-semibold text-slate-700">
            <div className="flex items-center gap-1.5">
              <span className="text-teal-700 font-extrabold text-xs">✓</span> Fast ANPR Recognition
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-teal-700 font-extrabold text-xs">✓</span> Zero Paper Logs
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-teal-700 font-extrabold text-xs">✓</span> 100% GDPR &amp; DPDP Compliant
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
