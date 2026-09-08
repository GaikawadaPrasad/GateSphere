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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-[11px] font-mono font-bold text-emerald-400 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              VERIFIED RWA REVIEWS
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Trusted by Premier Communities
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrev}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 text-white flex items-center justify-center transition cursor-pointer"
              aria-label="Previous testimonial"
            >
              ←
            </button>
            <button
              onClick={handleNext}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 text-white flex items-center justify-center transition cursor-pointer"
              aria-label="Next testimonial"
            >
              →
            </button>
          </div>
        </div>

        {/* ── TESTIMONIAL CARD ── */}
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 sm:p-10 border border-white/10 shadow-2xl reveal ${visible ? "visible" : ""}`}>
          <div className="lg:col-span-8 space-y-6">
            <div className="text-3xl sm:text-4xl text-sky-400 font-serif leading-none">&ldquo;</div>
            <p className="text-lg sm:text-2xl text-white font-medium leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {current.quote}
            </p>

            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-base sm:text-lg font-bold text-white">{current.name}</div>
                <div className="text-xs text-slate-400">{current.role} · {current.community}, {current.city}</div>
              </div>

              <div className="bg-blue-950/80 border border-blue-500/30 px-4 py-2 rounded-2xl">
                <div className="text-lg font-bold text-sky-400 font-mono leading-tight">{current.metric}</div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">{current.metricLabel}</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex justify-center">
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl">
              <Image
                src={current.image}
                alt={current.name}
                fill
                sizes="208px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
