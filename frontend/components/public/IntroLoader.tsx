"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

export default function IntroLoader({ onReady }: { onReady?: () => void }) {
  const [exiting, setExiting] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    // Lock scroll during loader
    document.documentElement.style.overflow = "hidden";

    // Fast, snappy brand loader: 700ms display, then smooth 450ms exit
    const exitTimer = setTimeout(() => {
      setExiting(true);
      document.documentElement.style.overflow = "";
      if (onReady) onReady();
    }, 700);

    const removeTimer = setTimeout(() => {
      setRemoved(true);
    }, 1150);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
      document.documentElement.style.overflow = "";
    };
  }, [onReady]);

  if (removed) return null;

  return (
    <aside
      aria-label="Loading GateSphere"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "linear-gradient(135deg, #0A192F 0%, #0F2F63 50%, #0B1329 100%)",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        transform: exiting ? "translateY(-105%)" : "translateY(0%)",
        transition: "transform 450ms cubic-bezier(0.4, 0, 0.2, 1)",
        willChange: "transform",
        pointerEvents: exiting ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes gsProgressFill {
          0% { width: 5%; }
          35% { width: 50%; }
          75% { width: 85%; }
          100% { width: 100%; }
        }
        @keyframes gsPulseGlow {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
      `}</style>

      {/* Brand Wordmark & Icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          animation: "gsPulseGlow 2.5s ease-in-out infinite",
        }}
      >
        <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
          <Image
            src="/images/gatesphere-logo.webp"
            alt="GateSphere Logo"
            width={56}
            height={56}
            priority
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              filter: "drop-shadow(0 0 16px rgba(56, 189, 248, 0.6))",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "'Outfit', var(--font-sans), sans-serif",
            fontSize: "2.4rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#ffffff",
            textShadow: "0 2px 10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.3)",
          }}
        >
          GateSphere
        </span>
      </div>

      {/* Progress Track & Fill */}
      <div
        style={{
          width: "14rem",
          height: "4px",
          borderRadius: "9999px",
          background: "rgba(255, 255, 255, 0.15)",
          overflow: "hidden",
          position: "relative",
          boxShadow: "0 0 10px rgba(56, 189, 248, 0.2)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            background: "linear-gradient(90deg, #38BDF8, #34D399)",
            borderRadius: "9999px",
            animation: "gsProgressFill 0.7s cubic-bezier(0.25, 1, 0.5, 1) forwards",
            boxShadow: "0 0 8px #38BDF8",
          }}
        />
      </div>

      {/* Subtitle / Tagline */}
      <div
        style={{
          fontSize: "0.8rem",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(255, 255, 255, 0.7)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span>Smart Community Platform</span>
      </div>
    </aside>
  );
}
