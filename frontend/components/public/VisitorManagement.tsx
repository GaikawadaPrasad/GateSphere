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
  const [activeTab, setActiveTab] = useState(0);
  const [scanState, setScanState] = useState<"scanning" | "success">("scanning");

  // Loop: Scanning for 2.4s -> Success checkmark for 2.4s -> Loop
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
      {/* Background Geometric Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#F1F5F9_1px,transparent_1px),linear-gradient(to_bottom,#F1F5F9_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-60 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* ── LEFT COLUMN: 4 Features Accordion ── */}
          <div className={`lg:col-span-6 reveal-left ${visible ? "visible" : ""}`}>
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 mb-3.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span
                className="text-[11px] font-bold tracking-wider text-blue-900 uppercase"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Seamless Verification
              </span>
            </div>

            {/* Headline */}
            <h2
              className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-slate-950 tracking-tight leading-[1.14] mb-3"
              style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
            >
              Every entry verified in{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-teal-600">
                under 3 seconds.
              </span>
            </h2>

            {/* Subtitle */}
            <p
              className="text-[15px] sm:text-[16px] text-slate-600 font-normal leading-relaxed max-w-xl mb-6"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              From expected dinner guests to daily delivery couriers, GateSphere replaces slow paper registers with contactless pre-approvals and automated ANPR verification.
            </p>

            {/* Feature Cards List */}
            <div className="space-y-2.5">
              {features.map((item, idx) => {
                const isSelected = activeTab === idx;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveTab(idx)}
                    className={`group relative flex items-start gap-4 p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/70 border-blue-500/50 shadow-md shadow-blue-500/10"
                        : "bg-slate-50/60 border-slate-200/80 hover:bg-white hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${item.iconBg}`}
                    >
                      {item.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4
                          className={`text-sm sm:text-[14.5px] font-bold ${
                            isSelected ? "text-blue-900" : "text-slate-800 group-hover:text-blue-900"
                          }`}
                        >
                          {item.title}
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT COLUMN: Interactive Live Pass & Camera Simulation ── */}
          <div className={`lg:col-span-6 reveal-right ${visible ? "visible" : ""}`}>
            <div className="relative bg-slate-950 rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-2xl text-white">
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-slate-300 font-semibold">GATESPHERE SECURE TERMINAL</span>
                </div>
                <div className="font-mono text-cyan-400 font-bold bg-cyan-950/80 px-2.5 py-1 rounded border border-cyan-500/30">
                  {scanState === "scanning" ? "SCANNING QR PASS..." : "VERIFIED & APPROVED"}
                </div>
              </div>

              {/* Digital Pass Hologram Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-900/90 rounded-2xl p-5 border border-slate-700/80 relative overflow-hidden shadow-inner mb-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
                      VISITOR DIGITAL PASS
                    </div>
                    <div className="text-lg font-bold text-white tracking-tight">Vikramaditya Rao</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-slate-400">HOST APARTMENT</div>
                    <div className="text-sm font-bold text-sky-300">Tower C · Unit 804</div>
                  </div>
                </div>

                {/* QR Code & Scan Beam Area */}
                <div className="relative w-36 h-36 mx-auto bg-white rounded-2xl p-2.5 shadow-lg flex items-center justify-center overflow-hidden my-2">
                  {scanState === "scanning" ? (
                    <>
                      {/* Sim QR code */}
                      <div className="w-full h-full bg-slate-950 rounded-lg p-2 flex flex-col justify-between">
                        <div className="flex justify-between">
                          <div className="w-6 h-6 border-2 border-cyan-400 p-0.5"><div className="w-full h-full bg-cyan-400" /></div>
                          <div className="w-6 h-6 border-2 border-cyan-400 p-0.5"><div className="w-full h-full bg-cyan-400" /></div>
                        </div>
                        <div className="flex justify-between">
                          <div className="w-6 h-6 border-2 border-cyan-400 p-0.5"><div className="w-full h-full bg-cyan-400" /></div>
                          <div className="w-4 h-4 bg-cyan-400 ml-auto self-end" />
                        </div>
                      </div>
                      {/* Laser scanning beam */}
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-lg shadow-cyan-400 animate-[scanBeam_2s_ease-in-out_infinite]" />
                    </>
                  ) : (
                    <div className="w-full h-full bg-emerald-50 rounded-lg flex flex-col items-center justify-center text-emerald-600">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-2xl font-bold mb-1">
                        ✓
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-700">VERIFIED</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>EXP: TODAY, 11:30 PM</span>
                  <span>TYPE: GUEST DINNER</span>
                  <span className="text-emerald-400 font-bold">OTP: 839-201</span>
                </div>
              </div>

              {/* Bottom Real-time Security Strip */}
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Camera</div>
                  <div className="font-bold text-slate-200 mt-0.5">ANPR-4K</div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Response</div>
                  <div className="font-bold text-emerald-400 mt-0.5">0.6s FAST</div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Barrier</div>
                  <div className="font-bold text-cyan-400 mt-0.5">AUTO-LIFT</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
