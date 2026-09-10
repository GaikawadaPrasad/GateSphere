"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useReveal } from "@/hooks/use-reveal";

interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  community: string;
  city: string;
  units: string;
  metric: string;
  metricLabel: string;
  image: string;
  badge: string;
}

const testimonials: Testimonial[] = [
  {
    id: "rajan",
    quote:
      "GateSphere completely transformed our society operations. Visitor management is frictionless, and our maintenance dues collection reached 98% in the very first quarter.",
    name: "Rajan Pillai",
    role: "RWA President & Administrator",
    community: "Serene Palms Estate",
    city: "Hyderabad",
    units: "1,200 Villas",
    metric: "98%",
    metricLabel: "On-time Dues Collection",
    image: "/images/rajan-pillai.webp",
    badge: "VERIFIED RWA",
  },
  {
    id: "priya",
    quote:
      "Booking the clubhouse, paying society fees, and approving guest entries takes mere seconds. It gives our entire gated community a genuine five-star living experience.",
    name: "Priya Nambiar",
    role: "Resident Council Secretary",
    community: "Marina Heights Towers",
    city: "Mumbai",
    units: "840 Apartments",
    metric: "< 15s",
    metricLabel: "Guest Pre-Approval",
    image: "/images/priya-nambiar.webp",
    badge: "COUNCIL MEMBER",
  },
  {
    id: "sunil",
    quote:
      "Our security team mastered the guard terminal in under an hour. ANPR number plate recognition and instant gate alerts have eliminated manual registers entirely.",
    name: "Sunil Krishnamurthy",
    role: "Head of Estate Security",
    community: "Prestige Greenlands",
    city: "Bengaluru",
    units: "2,100 Units",
    metric: "100%",
    metricLabel: "Digital Gate Audit",
    image: "/images/sunil-krishnamurthy.webp",
    badge: "SECURITY HEAD",
  },
];

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { ref, visible } = useReveal();
  const current = testimonials[currentIndex];

  // Auto cycle every 6.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 6500);
    return () => clearInterval(timer);
  }, []);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  return (
    <section
      ref={ref}
      className="relative overflow-hidden min-h-[580px] lg:min-h-[640px] flex flex-col justify-center py-12 sm:py-14"
      style={{
        backgroundColor: "#070B16",
        backgroundImage:
          "radial-gradient(circle at 75% 30%, rgba(37, 99, 235, 0.14) 0%, transparent 55%), radial-gradient(circle at 15% 85%, rgba(16, 185, 129, 0.08) 0%, transparent 50%)",
      }}
    >
      {/* Background Micro Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-35 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 w-full relative z-10">
        {/* ── TOP SECTION HEADER ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-5 border-b border-white/10 pb-5">
          <div>
            {/* Pill Label */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 backdrop-blur-md mb-2.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span
                className="text-[11px] font-bold tracking-wider text-blue-400 uppercase"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Community Trust &amp; Leadership
              </span>
            </div>

            {/* Headline */}
            <h2
              className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-white tracking-tight leading-[1.15]"
              style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
            >
              Trusted by premier communities{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
                across India.
              </span>
            </h2>
          </div>

          {/* Aggregate Proof Metrics */}
          <div className="flex items-center gap-6 sm:gap-8 shrink-0">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">450+</div>
              <div className="text-[11.5px] text-slate-400 font-medium">Communities</div>
            </div>
            <div className="w-px h-9 bg-white/10" />
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight">98.6%</div>
              <div className="text-[11.5px] text-slate-400 font-medium">On-Time Dues</div>
            </div>
            <div className="w-px h-9 bg-white/10" />
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-tight">4.9 ★</div>
              <div className="text-[11.5px] text-slate-400 font-medium">14,000+ Reviews</div>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT: Balanced Spotlight Card & Leader Switcher ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* ── LEFT COLUMN: Executive Story Card (7 Cols) ── */}
          <div className={`lg:col-span-7 reveal-left ${visible ? "visible" : ""} flex flex-col justify-between`}>
            <div
              key={current.id}
              className="rounded-2xl p-6 sm:p-7 border border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent transition-all duration-300 flex-1 flex flex-col justify-between"
            >
              {/* Subtle Ambient Glow */}
              <div className="absolute top-0 right-0 w-56 h-56 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

              <div>
                {/* Card Top Row: 5 Stars + Verified Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5 text-amber-400 text-sm">
                    {"★★★★★"}
                  </div>
                  <span className="text-[9.5px] font-mono font-bold tracking-wider text-cyan-300 bg-cyan-950/70 border border-cyan-500/30 px-2.5 py-1 rounded-full uppercase">
                    {current.badge}
                  </span>
                </div>

                {/* Quote */}
                <blockquote
                  className="text-[16px] sm:text-[17.5px] leading-relaxed text-slate-100 font-normal mb-6 min-h-[70px]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  &ldquo;{current.quote}&rdquo;
                </blockquote>
              </div>

              {/* Bottom Author Section */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-blue-400/50 shadow-md shrink-0">
                    <Image
                      src={current.image}
                      alt={current.name}
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-[14.5px] font-bold text-white tracking-tight leading-tight">
                      {current.name}
                    </div>
                    <div className="text-[12px] font-semibold text-blue-400">
                      {current.role}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {current.community}, {current.city} • <span className="text-slate-300 font-mono">{current.units}</span>
                    </div>
                  </div>
                </div>

                {/* Impact Metric Pill */}
                <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-xl px-3 py-1.5 text-right shrink-0">
                  <div className="text-sm font-extrabold text-emerald-300 font-mono leading-none">
                    {current.metric}
                  </div>
                  <div className="text-[9.5px] text-slate-300 font-medium mt-0.5">
                    {current.metricLabel}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation & Carousel Indicators */}
            <div className="flex items-center justify-between mt-3.5 px-1">
              {/* Dot Indicators */}
              <div className="flex items-center gap-1.5">
                {testimonials.map((t, idx) => (
                  <button
                    key={t.id}
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Select testimonial ${idx + 1}`}
                    className="h-1.5 rounded-full transition-all duration-300 cursor-pointer"
                    style={{
                      width: idx === currentIndex ? "32px" : "8px",
                      backgroundColor: idx === currentIndex ? "#60A5FA" : "rgba(255, 255, 255, 0.2)",
                    }}
                  />
                ))}
              </div>

              {/* Prev / Next Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrev}
                  aria-label="Previous testimonial"
                  className="w-8.5 h-8.5 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 text-white hover:bg-white/15 hover:border-white/30 transition-all duration-200 cursor-pointer active:scale-95"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 12L6 8L10 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={handleNext}
                  aria-label="Next testimonial"
                  className="w-8.5 h-8.5 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 text-white hover:bg-white/15 hover:border-white/30 transition-all duration-200 cursor-pointer active:scale-95"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 4L10 8L6 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Compact Leader Switcher List (5 Cols) ── */}
          <div className={`lg:col-span-5 reveal-right ${visible ? "visible" : ""} space-y-3 flex flex-col justify-between`}>
            {testimonials.map((item, idx) => {
              const isSelected = idx === currentIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-300 cursor-pointer backdrop-blur-md flex items-center gap-3.5 ${
                    isSelected
                      ? "bg-blue-600/15 border-blue-400/60 shadow-md shadow-blue-500/10 translate-x-1"
                      : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
                  }`}
                >
                  <div className={`relative w-10 h-10 rounded-xl overflow-hidden border shrink-0 ${isSelected ? "border-cyan-400" : "border-white/10"}`}>
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="40px"
                      className={`object-cover transition-transform ${
                        isSelected ? "scale-105" : ""
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="text-[13.5px] font-bold text-white tracking-tight truncate">
                        {item.name}
                      </div>
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                          isSelected ? "bg-blue-400/20 text-blue-300 font-bold" : "text-slate-400"
                        }`}
                      >
                        {item.city}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-blue-400 font-medium truncate">
                      {item.role}
                    </div>
                    <div className="text-[10.5px] text-slate-400 truncate">
                      {item.community}
                    </div>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                      isSelected ? "bg-cyan-400" : "bg-transparent"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
