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
  },
  {
    id: "gymnasium",
    name: "State-of-the-Art Gymnasium",
    shortName: "Gymnasium",
    categoryTag: "HEALTH & FITNESS",
    subDescription: "Technogym & cardio deck",
    icon: "💪",
    src: "/images/smart-hardware.webp",
  },
  {
    id: "swimming-pool",
    name: "Azure Swimming Pool & Deck",
    shortName: "Swimming Pool",
    categoryTag: "AQUATICS",
    subDescription: "25m Lap pool · Lifeguard on duty",
    icon: "🏊",
    src: "/images/resident-lifestyle.webp",
  },
  {
    id: "tennis-court",
    name: "Championship Tennis Court",
    shortName: "Tennis Court",
    categoryTag: "OUTDOOR SPORTS",
    subDescription: "Floodlit arena · Online booking",
    icon: "🎾",
    src: "/images/friends-outdoors.webp",
  },
  {
    id: "community-hall",
    name: "Grand Banquet & Community Hall",
    shortName: "Community Hall",
    categoryTag: "EVENTS & BANQUETS",
    subDescription: "Grand banquet · Up to 250 guests",
    icon: "🎉",
    src: "/images/testimonial-villa-night.webp",
  },
  {
    id: "guest-rooms",
    name: "Executive Resident Guest Rooms",
    shortName: "Guest Rooms",
    categoryTag: "HOSPITALITY",
    subDescription: "Executive suite · Hotel standard",
    icon: "🛏️",
    src: "/images/security-skyscraper.webp",
  },
];

export default function Amenities() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      className="relative pt-6 pb-12 sm:pt-8 sm:pb-16 bg-[#090E1A] text-white overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 mb-8 relative z-10">
        <div className={`text-center max-w-3xl mx-auto reveal ${visible ? "visible" : ""}`}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 mb-3.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-bold tracking-wider text-cyan-300 uppercase font-mono">
              Clubhouse &amp; Facility Hub
            </span>
          </div>

          <h2
            className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-white leading-[1.14] mb-3"
            style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
          >
            Clubhouse &amp; Amenities,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400">
              one tap away.
            </span>
          </h2>

          <p
            className="text-sm sm:text-base text-slate-300 font-light leading-relaxed max-w-xl mx-auto"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Real-time slot availability, instant booking passes, and zero booking conflicts across community facilities.
          </p>
        </div>
      </div>

      {/* Infinite Horizontal Carousel */}
      <div className="relative w-full overflow-hidden">
        <InfiniteSlider duration={35} gap={20}>
          {PRD_AMENITIES.map((amenity) => (
            <div
              key={amenity.id}
              className="relative w-[300px] sm:w-[340px] h-[380px] rounded-3xl overflow-hidden border border-slate-700/70 shrink-0 group bg-slate-900 shadow-2xl"
            >
              <Image
                src={amenity.src}
                alt={amenity.name}
                fill
                sizes="340px"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

              <div className="absolute top-4 left-4">
                <span className="text-[10px] font-bold font-mono uppercase tracking-widest px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-cyan-300 border border-cyan-500/30">
                  {amenity.categoryTag}
                </span>
              </div>

              <div className="absolute bottom-5 left-5 right-5 text-white">
                <div className="text-xl mb-1">{amenity.icon}</div>
                <h3 className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {amenity.name}
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  {amenity.subDescription}
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                  <span>Check Live Slots</span>
                  <span>→</span>
                </div>
              </div>
            </div>
          ))}
        </InfiniteSlider>
      </div>
    </section>
  );
}
