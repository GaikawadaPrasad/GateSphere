"use client";

import React, { useState } from "react";
import Link from "next/link";
import GateSphereLogo from "./GateSphereLogo";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail("");
    }
  };

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
                { label: "𝕏", name: "Twitter", url: "https://twitter.com" },
                { label: "in", name: "LinkedIn", url: "https://linkedin.com" },
                { label: "yt", name: "YouTube", url: "https://youtube.com" },
                { label: "gh", name: "GitHub", url: "https://github.com" },
              ].map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:border-blue-400/50 hover:bg-blue-600/20 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                >
                  {social.label}
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

        {/* ── MIDDLE SECTION: Newsletter (Left) + Accreditation Badges (Right) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 border-b border-slate-800/80 items-center">
          {/* Newsletter Box (5 Cols) */}
          <div className="lg:col-span-5 space-y-2">
            <h4
              className="text-[12px] font-bold uppercase tracking-wider text-white"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              STAY UPDATED
            </h4>
            <p className="text-[12px] text-slate-400">
              Community management insights, security updates, and feature releases.
            </p>
            {subscribed ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <span>✓ Subscribed! You will receive our latest society updates.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex items-center gap-2 pt-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your society email address..."
                  className="w-full px-3.5 py-2 rounded-xl text-[12.5px] text-white bg-white/5 border border-white/15 focus:border-cyan-400 outline-none transition-all"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-slate-950 bg-white hover:bg-slate-200 transition-all uppercase tracking-wider shrink-0 cursor-pointer"
                >
                  Subscribe
                </button>
              </form>
            )}
          </div>

          {/* Accreditation Badges (7 Cols) -> Clickable to /security */}
          <div className="lg:col-span-7 space-y-2">
            <h4
              className="text-[12px] font-bold uppercase tracking-wider text-white"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              TRUSTED SECURITY &amp; ACCREDITATION
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {[
                { icon: "🔒", title: "ISO 27001", sub: "Certified Platform" },
                { icon: "🛡️", title: "SOC 2 Type II", sub: "Audited Systems" },
                { icon: "⚡", title: "DPDP Act", sub: "2023 Compliant" },
                { icon: "💳", title: "NPCI / UPI", sub: "Verified Gateway" },
              ].map((badge) => (
                <Link
                  key={badge.title}
                  href="/security"
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/40 hover:bg-white/10 transition-all cursor-pointer group"
                >
                  <span className="text-base shrink-0 group-hover:scale-110 transition-transform">{badge.icon}</span>
                  <div>
                    <div className="text-[11.5px] font-bold text-slate-200 leading-tight group-hover:text-cyan-300 transition-colors">{badge.title}</div>
                    <div className="text-[10px] text-slate-500 leading-tight">{badge.sub}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── BOTTOM BAR: Copyright + Active Navigation Links ── */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-slate-500 text-center sm:text-left">
          <div>
            © 2026 GateSphere Enterprise. All rights reserved.
          </div>

          {/* Direct Quick Links Bar */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium">
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
