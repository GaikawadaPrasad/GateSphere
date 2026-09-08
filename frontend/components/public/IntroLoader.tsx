"use client";

import React, { useState, useEffect } from "react";
import GateSphereLogo from "./GateSphereLogo";

export default function IntroLoader({ onReady }: { onReady?: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    // Only run on initial load within session
    const hasSeenIntro = sessionStorage.getItem("gatesphere_intro_seen");
    if (hasSeenIntro) {
      setRemoved(true);
      if (onReady) onReady();
      return;
    }

    // Lock scroll during loader
    document.documentElement.style.overflow = "hidden";

    // Start progress line & wordmark animation
    const revealTimer = setTimeout(() => {
      setRevealed(true);
    }, 60);

    // Loader timing: 1400ms display, then exit
    const MIN_TIME = 1400;
    const EXIT_TIME = 850;

    const exitTimer = setTimeout(() => {
      setExiting(true);
      document.documentElement.style.overflow = "";
      sessionStorage.setItem("gatesphere_intro_seen", "true");
      if (onReady) onReady();

      setTimeout(() => {
        setRemoved(true);
      }, EXIT_TIME);
    }, MIN_TIME);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(exitTimer);
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
        gap: "1.75rem",
        transform: exiting ? "translateY(-105%)" : "translateY(0%)",
        transition: "transform 850ms cubic-bezier(0.65, 0, 0.35, 1)",
        willChange: "transform",
        pointerEvents: exiting ? "none" : "auto",
      }}
    >
      {/* Brand Wordmark & Icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.875rem",
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <GateSphereLogo variant="light" />
      </div>

      {/* Progress Track & Fill */}
      <div
        style={{
          width: "10.5rem",
          height: "2px",
          borderRadius: "9999px",
          background: "rgba(255, 255, 255, 0.15)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, #38BDF8, #34D399)",
            transformOrigin: "left",
            transform: revealed ? "scaleX(1)" : "scaleX(0)",
            transition: "transform 1280ms cubic-bezier(0.65, 0, 0.35, 1) 100ms",
          }}
        />
      </div>

      {/* Subtitle / Micro tagline */}
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 500,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "rgba(255, 255, 255, 0.5)",
          opacity: revealed ? 1 : 0,
          transition: "opacity 0.6s ease 0.2s",
        }}
      >
        Smart Community Platform
      </div>
    </aside>
  );
}
