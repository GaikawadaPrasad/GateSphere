"use client";

import React from "react";
import Image from "next/image";
import { useReveal } from "@/hooks/use-reveal";
import { InfiniteSlider } from "./core/infinite-slider";

interface AmenityData {
  id: string;
  name: string;
  shortName: string;
  categoryTag: string;
  subDescription: string;
  icon: string;
  src: string;
  iconSvg: React.ReactNode;
}

const PRD_AMENITIES: AmenityData[] = [
  {
    id: "clubhouse",
    name: "The Grand Clubhouse & Lounge",
    shortName: "Clubhouse",
    categoryTag: "RECREATION",
    subDescription: "Lounge, Wi-Fi & Billiards",
    icon: "🏛️",
    src: "/images/demo-township-towers.webp",
    iconSvg: (
      <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: "gymnasium",
    name: "State-of-the-Art Gymnasium",
    shortName: "Gymnasium",
    categoryTag: "HEALTH & FITNESS",
    subDescription: "Technogym & cardio deck",
    icon: "💪",
    src: "/images/smart-hardware.webp",
    iconSvg: (
      <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V6a2 2 0 012-2h1m13 4V6a2 2 0 00-2-2h-1M4 16v2a2 2 0 002 2h1m13-4v2a2 2 0 01-2 2h-1M3 10h18M3 14h18M7 4v16m10-16v16" />
      </svg>
    ),
  },
  {
    id: "swimming-pool",
    name: "Azure Swimming Pool & Deck",
    shortName: "Swimming Pool",
    categoryTag: "AQUATICS",
    subDescription: "25m Lap pool · Lifeguard on duty",
    icon: "🏊",
    src: "/images/resident-lifestyle.webp",
    iconSvg: (
      <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17c3.333 0 5-2 8-2s4.667 2 8 2 5-2 8-2M3 21c3.333 0 5-2 8-2s4.667 2 8 2 5-2 8-2M14 6a2 2 0 11-4 0 2 2 0 014 0zM12 9v4m-3 0h6" />
      </svg>
    ),
  },
  {
    id: "tennis-court",
    name: "Championship Tennis Court",
    shortName: "Tennis Court",
    categoryTag: "OUTDOOR SPORTS",
    subDescription: "Floodlit arena · Online booking",
    icon: "🎾",
    src: "/images/friends-outdoors.webp",
    iconSvg: (
      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9M12 3c4.97 0 9 4.03 9 9s-4.03 9-9 9M3.6 7.5h16.8M3.6 16.5h16.8" />
      </svg>
    ),
  },
  {
    id: "community-hall",
    name: "Grand Banquet & Community Hall",
    shortName: "Community Hall",
    categoryTag: "EVENTS & BANQUETS",
    subDescription: "Grand banquet · Up to 250 guests",
    icon: "🎉",
    src: "/images/testimonial-villa-night.webp",
    iconSvg: (
      <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: "guest-rooms",
    name: "Executive Resident Guest Rooms",
    shortName: "Guest Rooms",
    categoryTag: "HOSPITALITY",
    subDescription: "Executive suite · Hotel standard",
    icon: "🛏️",
    src: "/images/security-skyscraper.webp",
    iconSvg: (
      <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v.01M16 14v.01M8 17h8" />
      </svg>
    ),
  },
];

// Column 1 items (Upward flow)
const COLUMN_1 = [
  PRD_AMENITIES[0], // Clubhouse
  PRD_AMENITIES[2], // Swimming Pool
  PRD_AMENITIES[4], // Community Hall
];

// Column 2 items (Downward flow / Reverse)
const COLUMN_2 = [
  PRD_AMENITIES[1], // Gymnasium
  PRD_AMENITIES[3], // Tennis Court
  PRD_AMENITIES[5], // Guest Rooms
];

function AmenityFeedCard({ amenity }: { amenity: AmenityData }) {
  return (
    <div className="group w-full rounded-2xl overflow-hidden bg-slate-900/90 border border-slate-800/90 shadow-lg flex flex-col">
      {/* Photo Area */}
      <div className="relative aspect-[16/11] w-full overflow-hidden bg-slate-950">
        <Image
          src={amenity.src}
          alt={amenity.name}
          fill
          sizes="(max-width: 640px) 100vw, 200px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-60 pointer-events-none" />
      </div>

      {/* Card Info Area */}
      <div className="p-3.5 bg-slate-900/95 flex flex-col gap-1 border-t border-slate-800/50">
        <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
          {amenity.categoryTag}
        </div>
        <div className="text-sm font-bold text-white tracking-tight leading-tight">
          {amenity.shortName}
        </div>
        <div className="text-[11px] text-slate-400 leading-snug line-clamp-1">
          {amenity.subDescription}
        </div>
      </div>
    </div>
  );
}

export function InfiniteSliderVertical() {
  return (
    <div className="flex h-[380px] sm:h-[400px] space-x-3.5 select-none w-full max-w-[360px] sm:max-w-[390px] mx-auto">
      {/* Column 1 (Upward) */}
      <InfiniteSlider direction="vertical" duration={18} gap={14} className="h-full w-1/2">
        {COLUMN_1.map((amenity) => (
          <AmenityFeedCard
            key={`feed-col1-${amenity.id}`}
            amenity={amenity}
          />
        ))}
      </InfiniteSlider>

      {/* Column 2 (Downward / Reverse) */}
      <InfiniteSlider direction="vertical" reverse duration={20} gap={14} className="h-full w-1/2">
        {COLUMN_2.map((amenity) => (
          <AmenityFeedCard
            key={`feed-col2-${amenity.id}`}
            amenity={amenity}
          />
        ))}
      </InfiniteSlider>
    </div>
  );
}

export default function Amenities() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      id="amenities"
      className="py-14 md:py-18 relative overflow-hidden"
      style={{
        background: "#070B14",
        color: "#F8FAFC",
      }}
    >
      {/* Subtle Radial Glows */}
      <div className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 translate-x-1/3 translate-y-1/3 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* LEFT SIDE: PawGuard Style Feed Cards Infinite Vertical Slider */}
          <div className={`lg:col-span-5 flex justify-center order-2 lg:order-1 reveal-left ${visible ? "visible" : ""}`}>
            <div className="relative w-full max-w-[390px]">
              <div className="absolute -inset-3 bg-gradient-to-tr from-purple-500/10 via-transparent to-blue-500/10 rounded-2xl blur-xl pointer-events-none -z-10" />
              <InfiniteSliderVertical />
            </div>
          </div>

          {/* RIGHT SIDE: Typography & Clean 6-Amenity Display Grid */}
          <div className={`lg:col-span-7 order-1 lg:order-2 reveal-right ${visible ? "visible" : ""}`}>
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3.5 text-[11px] font-bold tracking-widest uppercase bg-purple-950/70 border border-purple-500/30 text-purple-300 shadow-sm backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span>AMENITIES &amp; BOOKING</span>
            </div>

            {/* Main Heading */}
            <h2
              className="text-3xl sm:text-4xl lg:text-[40px] font-black tracking-tight leading-[1.18] text-white"
              style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
            >
              Every space your community loves,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-blue-400">
                booked instantly.
              </span>
            </h2>

            {/* Subtitle Description */}
            <p
              className="mt-3 text-slate-400 text-sm sm:text-[15px] leading-relaxed max-w-xl"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Residents check availability and book any amenity in seconds. Managers get live schedules and zero double-bookings.
            </p>

            {/* 6 Amenity Cards Grid (2 columns x 3 rows - pure static display) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              {PRD_AMENITIES.map((amenity) => (
                <div
                  key={amenity.id}
                  className="w-full px-4 py-3.5 rounded-2xl border bg-slate-900/60 border-slate-800/90 flex items-center gap-3.5 shadow-sm hover:border-purple-500/40 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center shrink-0">
                    {amenity.iconSvg}
                  </div>
                  <span
                    className="font-semibold text-[15px] text-slate-200 tracking-tight"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {amenity.shortName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
