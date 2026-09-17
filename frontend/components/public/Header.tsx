"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import GateSphereLogo from "./GateSphereLogo";
import PublicSearchModal from "./PublicSearchModal";

interface NavItem {
  label: string;
  href: string;
  desc: string;
}

const NAV_LINKS: NavItem[] = [
  { label: "Home", href: "/", desc: "Overview & cinematic showcase" },
  { label: "Platform", href: "/platform", desc: "Core community operating system" },
  { label: "Solutions", href: "/solutions", desc: "Visitor & resident workflows" },
  { label: "Features", href: "/features", desc: "Comprehensive property tools" },
  { label: "Security", href: "/security", desc: "Gate & surveillance controls" },
  { label: "About", href: "/about", desc: "Our mission and story" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isHome = pathname === "/";
  const showHeroCapsules = isHome && !scrolled;

  return (
    <>
      <header
        className={`sticky sm:fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ${
          isHome && !scrolled
            ? "bg-transparent py-2.5 sm:py-3"
            : "bg-[#090E1A]/95 backdrop-blur-xl border-b border-white/10 py-3 sm:py-3.5 shadow-2xl"
        }`}
      >
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-8 flex items-center justify-between gap-2 sm:gap-4">
          {/* ── LEFT: MENU Trigger & Compact Logo ── */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* MENU Trigger */}
            <button
              onClick={() => setMenuOpen(true)}
              className={`group flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer select-none shrink-0 ${
                showHeroCapsules
                  ? "px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-black/40 hover:bg-black/55 backdrop-blur-md border border-white/20 text-white hover:text-sky-300 shadow-sm"
                  : "text-white/90 hover:text-white"
              }`}
              aria-label="Open navigation menu"
            >
              <span
                className={`tracking-[0.04em] leading-none ${
                  showHeroCapsules
                    ? "text-[12px] sm:text-[13px] font-medium text-white drop-shadow-xs"
                    : "text-[13px] sm:text-[14px] font-medium text-white/90 group-hover:text-white"
                }`}
              >
                MENU
              </span>
              <div className="flex flex-col justify-between w-[16px] sm:w-[18px] h-[10px] sm:h-[11px] shrink-0">
                {/* Top line */}
                <span className="w-[8px] sm:w-[9px] h-[1.8px] bg-white rounded-full block transition-transform group-hover:translate-x-0.5" />
                {/* Middle line */}
                <span className="w-[16px] sm:w-[18px] h-[1.8px] bg-white rounded-full block" />
                {/* Bottom line */}
                <span className="w-[8px] sm:w-[9px] h-[1.8px] bg-white rounded-full block ml-auto transition-transform group-hover:-translate-x-0.5" />
              </div>
            </button>

            {/* Logo */}
            <Link
              href="/"
              className={`flex items-center gap-1.5 sm:gap-2 transition-all group shrink-0 min-w-0 ${
                showHeroCapsules
                  ? "px-4 py-0.5 sm:px-5 sm:py-0.5 rounded-full bg-black/40 hover:bg-black/55 backdrop-blur-md border border-white/20 shadow-sm"
                  : ""
              }`}
            >
              <GateSphereLogo
                variant="light"
                className="transition-transform duration-200 group-hover:scale-105"
                size={isHome && !scrolled ? "normal" : "large"}
              />
            </Link>
          </div>

          {/* ── RIGHT: Minimal Search Icon & Sign In Button ── */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              onClick={() => setSearchOpen(true)}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                showHeroCapsules
                  ? "text-white bg-black/40 hover:bg-black/55 backdrop-blur-md border border-white/20 shadow-sm"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
              title="Search"
              aria-label="Search"
            >
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>

            <Link
              href="/login"
              className={`rounded-full transition-all flex items-center gap-1.5 shrink-0 ${
                showHeroCapsules
                  ? "px-3 py-1 sm:px-3.5 sm:py-1.5 text-[12px] sm:text-[13px] font-medium text-white bg-black/45 hover:bg-black/60 backdrop-blur-md border border-white/25 shadow-sm"
                  : "px-3 py-1.5 sm:px-4 sm:py-1.5 text-[12px] sm:text-[13px] font-medium text-white/90 hover:text-white border border-white/20 hover:border-white/40 hover:bg-white/10"
              }`}
            >
              <span>Sign In</span>
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white/80" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* ── FULL-FEATURED SLIDE-OUT MENU DRAWER ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 transition-opacity"
            onClick={() => setMenuOpen(false)}
          />

          {/* Slide-in panel */}
          <div className="relative w-full max-w-md bg-slate-950 text-white h-full p-8 flex flex-col justify-between shadow-2xl border-r border-white/10 z-10 overflow-y-auto">
            {/* Drawer Header */}
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-white/10">
                <Link
                  href="/"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 group"
                >
                  <GateSphereLogo variant="light" className="group-hover:scale-105 transition-transform" />
                </Link>

                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer bg-transparent border-0"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Nav List */}
              <nav className="mt-8 flex flex-col gap-2">
                {NAV_LINKS.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`group flex flex-col px-4 py-3 rounded-xl transition-all duration-200 border ${
                        isActive
                          ? "bg-blue-600/15 border-blue-500/30 text-white shadow-sm"
                          : "hover:bg-white/5 border-transparent hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400 animate-pulse" />
                          )}
                          <span
                            className={`text-[17px] font-bold transition-colors ${
                              isActive
                                ? "text-sky-400"
                                : "text-white group-hover:text-sky-400"
                            }`}
                          >
                            {item.label}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 mt-0.5">
                        {item.desc}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Footer CTA */}
            <div className="pt-6 border-t border-white/10 flex flex-col gap-3">
              <Link
                href="/demo"
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 hover:opacity-95 transition"
              >
                <span>Contact Us</span>
                <span>→</span>
              </Link>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center justify-center py-2.5 rounded-xl border border-white/20 text-white font-medium text-xs hover:bg-white/5 transition"
              >
                Sign In to Your Account
              </Link>
              <p className="text-center text-xs text-slate-500 mt-1">
                Empowering 500+ residential communities worldwide.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SEARCH MODAL ── */}
      <PublicSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
