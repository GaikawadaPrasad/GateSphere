"use client";

import React, { useState, useEffect, useRef } from "react";
import { useReveal } from "@/hooks/use-reveal";

interface StepData {
  id: number;
  title: string;
  shortTitle: string;
  desc: string;
  time: string;
  accent: string;
  gradient: string;
  glowColor: string;
  icon: React.ReactNode;
}

const STEPS: StepData[] = [
  {
    id: 1,
    title: "Resident Reports",
    shortTitle: "Report",
    desc: "Resident raises a ticket via app with photo attachment and voice/text description.",
    time: "10:00 AM",
    accent: "#38BDF8",
    gradient: "from-blue-500 to-cyan-400",
    glowColor: "rgba(56, 189, 248, 0.25)",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="2" width="14" height="20" rx="3" />
        <circle cx="12" cy="18" r="1" />
        <path d="M9 6h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 2,
    title: "Manager Assigns",
    shortTitle: "Assign",
    desc: "Automated skill-matching routes the ticket to the nearest certified plumber in seconds.",
    time: "10:08 AM",
    accent: "#2DD4BF",
    gradient: "from-teal-500 to-emerald-400",
    glowColor: "rgba(45, 212, 191, 0.25)",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 3,
    title: "Technician Works",
    shortTitle: "Repair",
    desc: "Field team gets digital gate clearance, arrives at unit, and carries out precision repairs.",
    time: "11:30 AM",
    accent: "#F59E0B",
    gradient: "from-amber-500 to-orange-400",
    glowColor: "rgba(245, 158, 11, 0.25)",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: 4,
    title: "Resident Confirms",
    shortTitle: "Confirm",
    desc: "Resident verifies resolution, provides a 5-star digital sign-off with feedback rating.",
    time: "2:15 PM",
    accent: "#10B981",
    gradient: "from-emerald-500 to-teal-400",
    glowColor: "rgba(168, 85, 247, 0.25)",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" />
        <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 5,
    title: "Closed & Archived",
    shortTitle: "Closed",
    desc: "Ticket auto-closes with tamper-proof SLA audit trail stored on society ledger.",
    time: "2:17 PM",
    accent: "#A855F7",
    gradient: "from-purple-500 to-indigo-400",
    glowColor: "rgba(168, 85, 247, 0.25)",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M9 16l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function MaintenanceTimeline() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const { ref: revealRef, visible } = useReveal();

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!sectionRef.current) {
            ticking = false;
            return;
          }
          const rect = sectionRef.current.getBoundingClientRect();
          const windowH = window.innerHeight;

          // Process only if the section is in view or scrolled past
          const totalH = rect.height - windowH;
          if (totalH <= 0) {
            ticking = false;
            return;
          }

          const current = -rect.top;
          const progress = Math.min(Math.max(current / totalH, 0), 0.999);
          const stepIdx = Math.floor(progress * STEPS.length);
          
          setActiveStep((prev) => (prev !== stepIdx ? stepIdx : prev));
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const current = STEPS[activeStep];

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#080D1A] text-white"
      style={{ height: `${STEPS.length * 30}vh` }}
    >
      {/* ── STICKY PINNED PRESENTATION VIEWPORT ── */}
      <div className="sticky top-0 h-screen w-full flex flex-col justify-between py-8 px-6 lg:px-12 overflow-hidden">
        {/* Background Ambient Glows */}
        {!prefersReducedMotion && (
          <>
            <div
              className="absolute -top-24 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-colors duration-700 opacity-20"
              style={{ backgroundColor: current.accent }}
            />
            <div className="absolute -bottom-24 right-10 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          </>
        )}

        {/* ── 1. HEADER AREA ── */}
        <div ref={revealRef} className={`max-w-4xl mx-auto text-center shrink-0 relative z-10 reveal ${visible ? "visible" : ""}`}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-semibold tracking-wider uppercase mb-3 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Maintenance
          </div>

          <h2
            className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-white tracking-tight leading-tight"
            style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
          >
            From complaint to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-teal-400">
              resolution.
            </span>
          </h2>

          <p
            className="mt-2 text-sm sm:text-base text-slate-400 max-w-xl mx-auto hidden sm:block"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Every maintenance request tracked end-to-end with full accountability at every step.
          </p>
        </div>

        {/* ── 2. PROCESS TIMELINE BAR (Horizontal with glowing progress) ── */}
        <div className="max-w-5xl mx-auto w-full relative z-20 my-auto shrink-0 py-2">
          <div className="relative">
            {/* Background Rail */}
            <div className="absolute top-1/2 -translate-y-1/2 left-6 right-6 h-[2px] bg-slate-800" />

            {/* Glowing Active Progress Fill */}
            <div
              className="absolute top-1/2 -translate-y-1/2 left-6 h-[2px] rounded-full transition-all duration-300 ease-out"
              style={{
                width: `calc(${((activeStep) / 4) * 100}% * 0.9 + 2%)`,
                background: "linear-gradient(90deg, #38BDF8, #2DD4BF, #F59E0B, #10B981, #A855F7)",
                boxShadow: `0 0 12px ${current.accent}`,
              }}
            />

            {/* 5 Step Nodes */}
            <div className="flex items-center justify-between relative z-10">
              {STEPS.map((step, idx) => {
                const isCompleted = idx < activeStep;
                const isActive = idx === activeStep;

                return (
                  <button
                    key={step.id}
                    onClick={() => setActiveStep(idx)}
                    className="group flex flex-col items-center cursor-pointer transition-all duration-300 focus:outline-none"
                  >
                    {/* Circle Node */}
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all duration-300 border ${
                        isActive
                          ? "bg-[#151F33] text-white scale-110 shadow-lg"
                          : isCompleted
                          ? "bg-slate-900/90 text-emerald-400 border-emerald-500/40"
                          : "bg-[#0B101E] text-slate-500 border-slate-800 hover:border-slate-700"
                      }`}
                      style={{
                        borderColor: isActive ? step.accent : undefined,
                        boxShadow: isActive ? `0 0 16px ${step.glowColor}` : undefined,
                      }}
                    >
                      {isCompleted ? (
                        <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span style={{ color: isActive ? step.accent : undefined }}>
                          {step.icon}
                        </span>
                      )}
                    </div>

                    {/* Node Text */}
                    <div className="mt-2 text-center hidden sm:block">
                      <div
                        className={`text-[12px] transition-colors ${
                          isActive ? "font-bold text-white" : isCompleted ? "font-semibold text-slate-300" : "font-medium text-slate-500"
                        }`}
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        {step.title}
                      </div>
                      <div
                        className="text-[10px] font-mono mt-0.5"
                        style={{ color: isActive ? step.accent : "#64748B" }}
                      >
                        {step.time}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── 3. MAIN WORKFLOW VISUAL & DEVICE SHOWCASE ── */}
        <div className="max-w-5xl mx-auto w-full relative z-10 my-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center bg-[#0D1424]/80 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* ── LEFT: Stage Narrative & Action Card ── */}
            <div className="lg:col-span-6 flex flex-col justify-center">
              {/* Active Step Badge */}
              <div className="flex items-center gap-2.5 mb-3.5">
                <span
                  className="px-3 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase text-white shadow-xs"
                  style={{ backgroundColor: current.accent }}
                >
                  Step {activeStep + 1} of 5
                </span>
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {current.time}
                </span>
              </div>

              {/* Title */}
              <h3
                className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
                style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
              >
                {current.title}
              </h3>

              {/* Description */}
              <p
                className="mt-2 text-slate-300 text-sm leading-relaxed"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {current.desc}
              </p>

              {/* Live Context Card */}
              <div className="mt-5 space-y-2.5">
                {activeStep === 0 && (
                  <div className="p-3.5 rounded-xl bg-[#131C31] border border-cyan-500/30 text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-cyan-400 flex items-center gap-1.5">
                      <span>✓</span> Resident App • Unit A-204
                    </div>
                    <div className="text-slate-400 text-[11.5px]">
                      Photo captured with AI issue tagging • Priority set to <strong>Standard Plumbing</strong>.
                    </div>
                  </div>
                )}

                {activeStep === 1 && (
                  <div className="p-3.5 rounded-xl bg-[#131C31] border border-teal-500/30 text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-teal-400 flex items-center gap-1.5">
                      <span>✓</span> Manager Dispatch Hub
                    </div>
                    <div className="text-slate-400 text-[11.5px]">
                      Auto-matched to Arun Kumar (Certified Plumber • 4.9★). SLA assigned: <strong>&lt; 2 Hours</strong>.
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="p-3.5 rounded-xl bg-[#131C31] border border-amber-500/30 text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                      <span>✓</span> Field Technician On-Site
                    </div>
                    <div className="text-slate-400 text-[11.5px]">
                      Cartridge valve replaced, pressure testing completed. Digital proof uploaded.
                    </div>
                  </div>
                )}

                {activeStep === 3 && (
                  <div className="p-3.5 rounded-xl bg-[#131C31] border border-emerald-500/30 text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <span>✓</span> Resident Verification
                    </div>
                    <div className="text-slate-400 text-[11.5px]">
                      Resident Rahul signed off digitally with <strong>5.0 / 5.0 Star Rating</strong>.
                    </div>
                  </div>
                )}

                {activeStep === 4 && (
                  <div className="p-3.5 rounded-xl bg-[#131C31] border border-purple-500/30 text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-purple-400 flex items-center gap-1.5">
                      <span>✓</span> Society Ledger Stored
                    </div>
                    <div className="text-slate-400 text-[11.5px]">
                      Cryptographic audit hash generated. Zero paper receipts required.
                    </div>
                  </div>
                )}
              </div>

              {/* Scroll / Action Hint */}
              <div className="mt-4 flex items-center gap-2 text-[11.5px] text-slate-400">
                <span className="text-cyan-400 animate-bounce">↓</span>
                <span>Scroll to scrub through the 5-step maintenance lifecycle</span>
              </div>
            </div>

            {/* ── RIGHT: High-End GateSphere Device Preview ── */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="w-full max-w-[340px] bg-[#0A0F1D] border border-slate-700/80 rounded-2xl p-4 shadow-2xl relative">
                {/* Device Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
                      GS
                    </div>
                    <span className="text-xs font-bold text-white tracking-tight">GateSphere Operations</span>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400 font-semibold">{current.time}</span>
                </div>

                {/* Dynamic Screen Content */}
                <div className="py-4 min-h-[220px] flex flex-col justify-center">
                  {/* Step 1 Screen */}
                  {activeStep === 0 && (
                    <div className="space-y-3 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-white">Ticket #GS-9402</span>
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-semibold">
                          PLUMBING
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-[#111A2E] border border-slate-800 space-y-1.5">
                        <div className="text-xs font-bold text-white">Kitchen Tap Cartridge Leak</div>
                        <div className="text-[11px] text-slate-400">Unit A-204 • Rahul Mehta</div>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-emerald-400 font-semibold">
                            📷 photo_attached.webp
                          </span>
                        </div>
                      </div>

                      <div className="w-full py-2 rounded-xl bg-blue-600 text-white font-bold text-xs text-center shadow-md">
                        ✓ Ticket Raised (10:00 AM)
                      </div>
                    </div>
                  )}

                  {/* Step 2 Screen */}
                  {activeStep === 1 && (
                    <div className="space-y-3 animate-in fade-in duration-300">
                      <div className="p-2.5 rounded-xl bg-teal-950/40 border border-teal-500/30 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
                          AK
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">Arun Kumar</div>
                          <div className="text-[10px] text-teal-300">Master Plumber • 4.9★</div>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#111A2E] border border-slate-800 text-[11px] space-y-1">
                        <div className="text-slate-400">Assigned by: <strong className="text-white">Deepak Sharma (Manager)</strong></div>
                        <div className="text-slate-400">Gate Entry: <strong className="text-emerald-400">Pre-Approved ✓</strong></div>
                      </div>

                      <div className="w-full py-2 rounded-xl bg-teal-600 text-white font-bold text-xs text-center shadow-md">
                        ✓ Technician Dispatched (10:08 AM)
                      </div>
                    </div>
                  )}

                  {/* Step 3 Screen */}
                  {activeStep === 2 && (
                    <div className="space-y-3 animate-in fade-in duration-300">
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-center space-y-1">
                        <div className="text-amber-400 text-lg">🔧 ➔ ✨</div>
                        <div className="text-xs font-bold text-white">Cartridge Replaced &amp; Leak Sealed</div>
                        <div className="text-[10px] text-slate-400">Pressure Test: 3.2 Bar Passed</div>
                      </div>

                      <div className="w-full py-2 rounded-xl bg-amber-600 text-white font-bold text-xs text-center shadow-md">
                        ✓ Work Completed (11:30 AM)
                      </div>
                    </div>
                  )}

                  {/* Step 4 Screen */}
                  {activeStep === 3 && (
                    <div className="space-y-3 animate-in fade-in duration-300 text-center">
                      <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                        <div className="text-[11px] font-bold text-slate-300">Resident Rating</div>
                        <div className="text-amber-400 text-base tracking-widest">★★★★★</div>
                        <div className="text-[10.5px] text-emerald-400 font-semibold">5.0 / 5.0 — &quot;Fast &amp; clean fix&quot;</div>
                      </div>

                      <div className="w-full py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs text-center shadow-md">
                        ✓ Resident Confirmed (2:15 PM)
                      </div>
                    </div>
                  )}

                  {/* Step 5 Screen */}
                  {activeStep === 4 && (
                    <div className="space-y-2.5 animate-in fade-in duration-300">
                      <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-center">
                        <div className="text-xs font-bold text-purple-300">STATUS: CLOSED ✓</div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#111A2E] border border-slate-800 text-[10px] space-y-1 font-mono text-slate-400">
                        <div className="flex justify-between"><span>10:00 AM</span><span className="text-white">Reported</span></div>
                        <div className="flex justify-between"><span>10:08 AM</span><span className="text-white">Assigned</span></div>
                        <div className="flex justify-between"><span>11:30 AM</span><span className="text-white">Repaired</span></div>
                        <div className="flex justify-between"><span>2:15 PM</span><span className="text-white">Confirmed (5★)</span></div>
                        <div className="flex justify-between text-purple-400 font-bold"><span>2:17 PM</span><span>Archived</span></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Device Footer status */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>SLA Met: 100%</span>
                  <span className="text-emerald-400">Encrypted Log ✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. BOTTOM THREE METRIC STATS ── */}
        <div className="max-w-5xl mx-auto w-full grid grid-cols-3 gap-3 sm:gap-4 shrink-0">
          <div className="bg-[#0D1424]/90 border border-slate-800 rounded-2xl p-3 sm:p-4 text-center shadow-lg">
            <div className="text-lg sm:text-2xl font-black text-cyan-400 leading-none" style={{ fontFamily: "'Outfit', sans-serif" }}>&lt; 4hr</div>
            <div className="text-[10px] sm:text-[12px] font-medium text-slate-400 mt-1">Avg Resolution Time</div>
          </div>

          <div className="bg-[#0D1424]/90 border border-slate-800 rounded-2xl p-3 sm:p-4 text-center shadow-lg">
            <div className="text-lg sm:text-2xl font-black text-emerald-400 leading-none" style={{ fontFamily: "'Outfit', sans-serif" }}>98%</div>
            <div className="text-[10px] sm:text-[12px] font-medium text-slate-400 mt-1">Ticket Closure Rate</div>
          </div>

          <div className="bg-[#0D1424]/90 border border-slate-800 rounded-2xl p-3 sm:p-4 text-center shadow-lg">
            <div className="text-lg sm:text-2xl font-black text-amber-400 leading-none" style={{ fontFamily: "'Outfit', sans-serif" }}>4.9★</div>
            <div className="text-[10px] sm:text-[12px] font-medium text-slate-400 mt-1">Resident Satisfaction</div>
          </div>
        </div>
      </div>
    </section>
  );
}
