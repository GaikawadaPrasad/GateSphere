"use client";

import React from "react";
import Link from "next/link";
import GateSphereLogo from "./GateSphereLogo";

export default function Footer() {

  return (
    <footer
      className="relative text-slate-300 pt-12 pb-6 border-t border-slate-800 overflow-hidden"
      style={{
        backgroundColor: "#090E1A",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        {/* ── TOP SECTION: Brand + Services + Company + Contact + Action Button ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-6 pb-12 border-b border-slate-800/80 items-start">
          {/* Column 1: Brand (3.5 Cols) */}
          <div className="lg:col-span-3 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5 group cursor-pointer">
              <GateSphereLogo variant="light" className="group-hover:scale-105 transition-transform" />
            </Link>

            <p
              className="text-[13px] text-slate-400 leading-relaxed max-w-xs"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Coordinating gate security, visitor pre-approvals, society dues, and facility maintenance for premier townships.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-2 pt-1">
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
                  name: "LinkedIn",
                  url: "https://linkedin.com",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
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
                  name: "GitHub",
                  url: "https://github.com",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
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

          {/* Column 2: Platform Links (2.5 Cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4
              className="text-[12px] font-bold uppercase tracking-wider text-white"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              PLATFORM
            </h4>
            <ul className="space-y-2 text-[13px]">
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

          {/* Column 3: Company Links (2.5 Cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4
              className="text-[12px] font-bold uppercase tracking-wider text-white"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              COMPANY
            </h4>
            <ul className="space-y-2 text-[13px]">
              {[
                { label: "About GateSphere", href: "/about" },
                { label: "Platform Architecture", href: "/platform" },
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

          {/* Column 4: Get In Touch (3 Cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4
              className="text-[12px] font-bold uppercase tracking-wider text-white"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              GET IN TOUCH
            </h4>
            <div className="space-y-2.5 text-[13px] text-slate-400">
              <a
                href="mailto:support@gatesphere.io"
                className="flex items-center gap-2.5 hover:text-cyan-400 transition-colors cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-slate-300 group-hover:border-cyan-400/50">
                  ✉
                </div>
                <span>support@gatesphere.io</span>
              </a>
              <a
                href="tel:+919876543210"
                className="flex items-center gap-2.5 hover:text-cyan-400 transition-colors cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-slate-300 group-hover:border-cyan-400/50">
                  📞
                </div>
                <span>+91 98765 43210</span>
              </a>
              <a
                href="https://maps.google.com/?q=Prestige+Tech+Park+Outer+Ring+Road+Bengaluru"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 hover:text-cyan-400 transition-colors cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-slate-300 mt-0.5 group-hover:border-cyan-400/50">
                  📍
                </div>
                <span className="leading-snug">Prestige Tech Park, Outer Ring Road, Bengaluru, Karnataka</span>
              </a>
            </div>
          </div>

          {/* Column 5: Action Button (1.5 Cols) */}
          <div className="lg:col-span-1 flex lg:justify-end">
            <Link
              href="/demo"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-full text-[12px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 transition-all shadow-lg shadow-red-500/25 whitespace-nowrap cursor-pointer hover:scale-105"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Contact Us
            </Link>
          </div>
        </div>

       

        {/* ── BOTTOM BAR: Copyright + Active Navigation Links ── */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-slate-500 text-center sm:text-left">
          <div>
            © 2026 GateSphere Enterprise. All rights reserved.
          </div>

          {/* Direct Quick Links Bar */}
          <div className="flex flex-nowrap items-center justify-center gap-3 text-xs font-medium">
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
            <Link href="/about" className="text-slate-400 hover:text-white transition-colors cursor-pointer">About</Link>
            <span className="text-slate-700">·</span>
            <Link href="/demo" className="text-slate-400 hover:text-white transition-colors cursor-pointer">Contact Us</Link>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Built for premier communities</span>
            <span className="text-blue-400">🛡️</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
