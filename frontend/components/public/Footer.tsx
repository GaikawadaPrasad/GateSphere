"use client";

import React from "react";
import Link from "next/link";
import GateSphereLogo from "./GateSphereLogo";

export default function Footer() {

  return (
    <footer
      className="relative text-slate-300 pt-8 sm:pt-12 pb-6 border-t border-slate-800 overflow-hidden"
      style={{
        backgroundColor: "#090E1A",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        {/* ── TOP SECTION: Brand + Services + Company + Contact + Action Button ── */}
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-5 sm:gap-8 lg:gap-6 pb-8 sm:pb-12 border-b border-slate-800/80 items-start">
          {/* Column 1: Brand (full width on mobile, 3 cols on lg) */}
          <div className="col-span-2 lg:col-span-3 space-y-3 sm:space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5 group cursor-pointer">
              <GateSphereLogo variant="light" className="group-hover:scale-105 transition-transform" />
            </Link>

            <p
              className="text-[12.5px] sm:text-[13px] text-slate-400 leading-relaxed max-w-sm"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Coordinating gate security, visitor pre-approvals, society dues, and facility maintenance for premier townships.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-2 pt-0.5">
              {[
                {
                  name: "X (Twitter)",
                  url: "https://twitter.com",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  ),
                },
                {
                  name: "Instagram",
                  url: "https://instagram.com",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                  ),
                },
                {
                  name: "YouTube",
                  url: "https://youtube.com",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  ),
                },
                {
                  name: "WhatsApp",
                  url: "https://whatsapp.com",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.276-.1-.477-.15-.678.15-.2.301-.778.978-.954 1.18-.175.2-.351.225-.652.075-.301-.15-1.27-.468-2.42-1.493-.895-.798-1.5-1.785-1.675-2.086-.176-.301-.019-.464.132-.614.136-.135.301-.351.452-.527.15-.175.2-.3.301-.501.1-.2.05-.376-.025-.526-.075-.15-.677-1.632-.928-2.235-.244-.588-.493-.508-.677-.517-.176-.009-.377-.01-.578-.01s-.527.075-.803.376c-.276.301-1.054 1.03-1.054 2.511s1.079 2.912 1.23 3.113c.15.2 2.122 3.24 5.141 4.544.718.31 1.279.496 1.716.635.722.23 1.379.197 1.898.12.578-.087 1.78-.727 2.03-1.43.25-.702.25-1.304.176-1.43-.076-.125-.276-.2-.577-.35zm-5.467 7.42c-1.89 0-3.663-.508-5.197-1.39l-.372-.216-3.864 1.013 1.031-3.766-.237-.377c-.965-1.536-1.474-3.327-1.474-5.166 0-5.457 4.44-9.9 9.9-9.9 2.644 0 5.13 1.03 6.999 2.9 1.868 1.87 2.898 4.356 2.898 7 0 5.458-4.441 9.9-9.9 9.9zm8.503-18.404C18.277 1.163 15.26 0 12.005 0 5.385 0 0 5.385 0 12.005c0 2.112.551 4.175 1.599 5.992L0 24l6.177-1.62c1.75 1 3.738 1.528 5.828 1.528 6.62 0 12.005-5.385 12.005-12.005 0-3.254-1.267-6.27-3.48-8.485z" />
                    </svg>
                  ),
                },
              ].map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:border-blue-400/50 hover:bg-blue-600/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Column 2: Platform Links (1 col on mobile, 2 cols on lg) */}
          <div className="col-span-1 lg:col-span-2 space-y-2.5 sm:space-y-3">
            <h4
              className="text-[11.5px] sm:text-[12px] font-bold uppercase tracking-wider text-white"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              PLATFORM
            </h4>
            <ul className="space-y-1.5 sm:space-y-2 text-[12px] sm:text-[13px]">
              {[
                { label: "Platform Architecture", href: "/platform" },
                { label: "Gate Security & Hardware", href: "/security" },
                { label: "Resident Solutions", href: "/solutions" },
                { label: "Core Features & OS", href: "/features" },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    <span className="text-slate-600">›</span> {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Company & Legal Links (1 col on mobile, 2 cols on lg) */}
          <div className="col-span-1 lg:col-span-2 space-y-2.5 sm:space-y-3">
            <h4
              className="text-[11.5px] sm:text-[12px] font-bold uppercase tracking-wider text-white"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              COMPANY & LEGAL
            </h4>
            <ul className="space-y-1.5 sm:space-y-2 text-[12px] sm:text-[13px]">
              {[
                { label: "About GateSphere", href: "/about" },
                { label: "Terms & Conditions", href: "/terms" },
                { label: "Cookie Policy", href: "/cookies" },
                { label: "Security & Privacy", href: "/security" },
                { label: "Contact Us", href: "/demo" },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    <span className="text-slate-600">›</span> {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Get In Touch (full width on mobile, 3 cols on lg) */}
          <div className="col-span-2 lg:col-span-3 space-y-2.5 sm:space-y-3">
            <h4
              className="text-[11.5px] sm:text-[12px] font-bold uppercase tracking-wider text-white"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              GET IN TOUCH
            </h4>
            <div className="space-y-2 text-[12.5px] sm:text-[13px] text-slate-400">
              <a
                href="mailto:support@gatesphere.io"
                className="flex items-center gap-2.5 hover:text-cyan-400 transition-colors cursor-pointer group"
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-slate-300 group-hover:border-cyan-400/50 text-xs">
                  ✉
                </div>
                <span>support@gatesphere.io</span>
              </a>
              <a
                href="tel:+919876543210"
                className="flex items-center gap-2.5 hover:text-cyan-400 transition-colors cursor-pointer group"
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-slate-300 group-hover:border-cyan-400/50 text-xs">
                  📞
                </div>
                <span>+91 98765 43210</span>
              </a>
              <a
                href="https://maps.google.com/?q=Bangalore+Karnataka"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 hover:text-cyan-400 transition-colors cursor-pointer group"
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-slate-300 mt-0.5 group-hover:border-cyan-400/50 text-xs">
                  📍
                </div>
                <span className="leading-snug">Bangalore, Karnataka</span>
              </a>
            </div>

            {/* Contact Button on mobile */}
            <div className="pt-2 lg:hidden">
              <Link
                href="/demo"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-[12px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 transition-all shadow-lg shadow-red-500/25 whitespace-nowrap cursor-pointer hover:scale-105"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Contact Us
              </Link>
            </div>
          </div>

          {/* Column 5: Action Button (Desktop only, mobile is nested above) */}
          <div className="hidden lg:flex lg:col-span-2 items-center lg:justify-end">
            <Link
              href="/demo"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-[12px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 transition-all shadow-lg shadow-red-500/25 whitespace-nowrap cursor-pointer hover:scale-105"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Contact Us
            </Link>
          </div>
        </div>

        {/* ── BOTTOM BAR: Copyright + Active Navigation Links ── */}
        <div className="pt-5 sm:pt-6 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 text-[11.5px] sm:text-[12px] text-slate-500 text-center sm:text-left">
          <div>
            © 2026 GateSphere Enterprise. All rights reserved.
          </div>

          {/* Direct Quick Links Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-medium">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors cursor-pointer">Home</Link>
            <span className="text-slate-700">·</span>
            <Link href="/platform" className="text-slate-400 hover:text-white transition-colors cursor-pointer">Platform</Link>
            <span className="text-slate-700">·</span>
            <Link href="/solutions" className="text-slate-400 hover:text-white transition-colors cursor-pointer">Solutions</Link>
            <span className="text-slate-700">·</span>
            <Link href="/features" className="text-slate-400 hover:text-white transition-colors cursor-pointer">Features</Link>
            <span className="text-slate-700">·</span>
            <Link href="/security" className="text-slate-400 hover:text-white transition-colors cursor-pointer">Security</Link>
            <span className="text-slate-700">·</span>
            <Link href="/terms" className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer">Terms & Conditions</Link>
            <span className="text-slate-700">·</span>
            <Link href="/cookies" className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer">Cookies</Link>
            <span className="text-slate-700">·</span>
            <Link href="/demo" className="text-slate-400 hover:text-white transition-colors cursor-pointer">Contact Us</Link>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] sm:text-xs">
            <span>Built for premier communities</span>
            <span className="text-blue-400">🛡️</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
