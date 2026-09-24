"use client";

import React, { useState } from "react";
import Link from "next/link";
import PublicLayout from "@/components/public/PublicLayout";

export default function CookiesPage() {
  const [preferences, setPreferences] = useState({
    essential: true, // Always required
    security: true,
    analytics: true,
    functional: true,
  });

  const [savedMessage, setSavedMessage] = useState(false);

  const handleSave = () => {
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  const cookieTypes = [
    {
      category: "Strictly Essential & Authentication Cookies",
      badge: "Required",
      badgeColor: "bg-red-500/10 text-red-400 border-red-500/20",
      description:
        "These cookies are indispensable for authenticating users, managing secure sessions, preventing unauthorized access, and routing role-based portals (Resident, Guard, Supervisor, Admin). Without these cookies, services such as gate checkpoint verification and dashboard logins cannot function.",
      cookies: [
        { name: "gatesphere_*_session", purpose: "Role-bucketed encrypted session authentication token", expiry: "Session / 12h" },
        { name: "gs_csrf / gatesphere_*_csrf", purpose: "Double-submit CSRF protection token against cross-site attacks", expiry: "Session" },
      ],
      required: true,
      key: "essential" as const,
    },
    {
      category: "Security & Guard Verification Cookies",
      badge: "Security Core",
      badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      description:
        "Used to store temporary hardware handshake tokens, gate scanner terminal authorizations, and prevent brute-force login attempts across device endpoints.",
      cookies: [
        { name: "gs_terminal_auth", purpose: "Device verification for security kiosk terminals", expiry: "30 days" },
        { name: "gs_guard_shift", purpose: "Active checkpoint shift verification stamp", expiry: "Shift duration" },
      ],
      required: false,
      key: "security" as const,
    },
    {
      category: "Functional & Preference Cookies",
      badge: "Enhancement",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      description:
        "Enables GateSphere to remember your UI preferences, such as selected society community view, collapsed sidebar states, theme preference, and language settings.",
      cookies: [
        { name: "gs_ui_theme", purpose: "Stores user interface display preferences (dark/contrast mode)", expiry: "1 year" },
        { name: "gs_active_community", purpose: "Stores last accessed community ID for multi-property managers", expiry: "90 days" },
      ],
      required: false,
      key: "functional" as const,
    },
    {
      category: "Performance & Diagnostic Telemetry",
      badge: "Optional",
      badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      description:
        "Collects anonymized operational telemetry regarding page latency, WebSocket heartbeat health, and camera stream rendering speeds to diagnose network bottlenecks in gate operations.",
      cookies: [
        { name: "gs_telemetry_perf", purpose: "Aggregated frontend rendering and API response latency", expiry: "30 days" },
      ],
      required: false,
      key: "analytics" as const,
    },
  ];

  return (
    <PublicLayout>
      <div className="w-full pt-28 sm:pt-36 pb-20 bg-[#090D16] text-slate-200 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Banner */}
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">
              <span>Privacy & Transparency</span>
            </div>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Cookie Policy
            </h1>
            <p
              className="mt-4 text-slate-400 text-sm sm:text-base leading-relaxed"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Learn how GateSphere Enterprise uses cookies, tokens, and local storage technologies to protect sessions and streamline township security operations.
            </p>
          </div>

          {/* Quick Notice Card */}
          <div className="mb-10 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-blue-950/40 border border-cyan-500/20 shadow-xl backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <span className="text-2xl mt-0.5">🍪</span>
              <div>
                <h2
                  className="text-lg font-bold text-white mb-2"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  Our Cookie Philosophy
                </h2>
                <p
                  className="text-sm text-slate-300 leading-relaxed"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  GateSphere does not sell personal browsing profiles or deploy third-party advertising cookies. All cookies utilized by our web portals and API services are strictly engineered for security encryption, role authentication (Super Admin, Resident, Security Guard), and seamless gate operations.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-cyan-400">
                  <Link href="/terms" className="hover:underline flex items-center gap-1">
                    <span>View Terms & Conditions</span> →
                  </Link>
                  <Link href="/security" className="hover:underline flex items-center gap-1">
                    <span>Security Architecture</span> →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Cookie Categories */}
          <div className="space-y-6">
            {cookieTypes.map((item) => (
              <div
                key={item.category}
                className="p-6 sm:p-8 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-cyan-500/30 transition-all shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <h3
                      className="text-lg sm:text-xl font-bold text-white"
                      style={{ fontFamily: "'Outfit', sans-serif" }}
                    >
                      {item.category}
                    </h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  </div>

                  {/* Toggle Control for Optional Cookies */}
                  {!item.required && (
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                      <span>Enable</span>
                      <input
                        type="checkbox"
                        checked={preferences[item.key]}
                        onChange={(e) =>
                          setPreferences((prev) => ({
                            ...prev,
                            [item.key]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400 bg-slate-800 border-slate-700"
                      />
                    </label>
                  )}
                </div>

                <p
                  className="text-sm text-slate-300 leading-relaxed mb-4"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {item.description}
                </p>

                {/* Table of specific cookies */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden">
                    <thead className="bg-slate-900/80 text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Cookie / Token</th>
                        <th className="py-2.5 px-3 font-semibold">Purpose</th>
                        <th className="py-2.5 px-3 font-semibold w-28">Expiry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-black/20 text-slate-300">
                      {item.cookies.map((c) => (
                        <tr key={c.name} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-mono text-cyan-300">{c.name}</td>
                          <td className="py-2.5 px-3">{c.purpose}</td>
                          <td className="py-2.5 px-3 text-slate-400">{c.expiry}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Preferences Save Bar */}
          <div className="mt-8 p-6 rounded-2xl bg-[#0e1628] border border-cyan-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-white font-bold text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Manage Cookie Preferences
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Save your preferences for non-essential diagnostic and preference cookies on this device.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {savedMessage && (
                <span className="text-xs text-emerald-400 font-medium animate-pulse">
                  ✓ Preferences Saved!
                </span>
              )}
              <button
                onClick={handleSave}
                type="button"
                className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Save Preferences
              </button>
            </div>
          </div>

          {/* Browser instructions section */}
          <div className="mt-10 p-6 sm:p-8 rounded-2xl bg-white/[0.02] border border-white/10">
            <h3
              className="text-lg font-bold text-white mb-2"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              How to Control Cookies in Your Browser
            </h3>
            <p
              className="text-sm text-slate-300 leading-relaxed mb-3"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              You can also manage or block cookies through your web browser settings. Please note that disabling essential or CSRF cookies will prevent you from signing in to the GateSphere administrative and resident portals.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="px-3 py-1 bg-white/5 rounded-md border border-white/5">Chrome: Settings → Privacy & Security → Cookies</span>
              <span className="px-3 py-1 bg-white/5 rounded-md border border-white/5">Firefox: Settings → Privacy & Security</span>
              <span className="px-3 py-1 bg-white/5 rounded-md border border-white/5">Safari: Preferences → Privacy</span>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
