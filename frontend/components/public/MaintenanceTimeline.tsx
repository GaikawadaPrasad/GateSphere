"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
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
    glowColor: "rgba(16, 185, 129, 0.25)",
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
  const { ref, visible } = useReveal();
  const [activeStep, setActiveStep] = useState(0);

  // Auto step every 4s
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const current = STEPS[activeStep];

  return (
    <section
      ref={ref}
      className="relative pt-6 pb-12 sm:pt-8 sm:pb-16 bg-white overflow-hidden border-b border-slate-200/80"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
        {/* Section Header */}
        <div className={`text-center mb-10 reveal ${visible ? "visible" : ""}`}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 mb-3.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span
              className="text-[11px] font-bold tracking-wider text-blue-900 uppercase"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Guaranteed 2-Hour SLA
            </span>
          </div>

          <h2
            className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-slate-950 tracking-tight leading-[1.14] mb-3"
            style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
          >
            End-to-end maintenance,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-teal-600">
              fully tracked.
            </span>
          </h2>

          <p
            className="text-[15px] sm:text-[16px] text-slate-600 font-normal leading-relaxed max-w-xl mx-auto"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            From plumbing leaks to lift maintenance, every request follows an automated transparent workflow with live timestamps.
          </p>
        </div>

        {/* Timeline Step Indicators */}
        <div className="grid grid-cols-5 gap-2 sm:gap-4 mb-8">
          {STEPS.map((step, idx) => {
            const isSelected = activeStep === idx;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(idx)}
                className={`flex flex-col items-center p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                  isSelected
                    ? "bg-blue-50/80 border-blue-500 shadow-md shadow-blue-500/10 scale-102"
                    : "bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold mb-1.5 transition-colors ${
                    isSelected ? "bg-blue-600 text-white" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  0{step.id}
                </div>
                <div className={`text-xs font-bold leading-tight ${isSelected ? "text-blue-900" : "text-slate-700"}`}>
                  {step.shortTitle}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{step.time}</div>
              </button>
            );
          })}
        </div>

        {/* Live Active Step Detail Card */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: Detail Info */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950 border border-blue-500/40 text-blue-300 text-xs font-mono">
                <span>STEP 0{current.id} OF 05</span>
                <span>·</span>
                <span>{current.time}</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {current.title}
              </h3>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl">
                {current.desc}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  SLA TIMER ACTIVE
                </span>
                <span>TICKET #TK-4821</span>
                <span>UNIT: TOWER B-402</span>
              </div>
            </div>

            {/* Right: Simulated Preview Graphic */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-xl h-48 sm:h-56 w-full">
                <Image
                  src="/images/helpdesk.webp"
                  alt="Technician Helpdesk SLA Tracker"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 backdrop-blur-md p-3 rounded-xl border border-white/10 text-xs">
                  <div className="text-[10px] text-sky-400 font-mono font-bold">DIGITAL AUDIT STAMP</div>
                  <div className="text-slate-200 font-semibold">{current.title} · Verified at {current.time}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
