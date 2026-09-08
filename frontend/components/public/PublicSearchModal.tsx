"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface PublicSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SEARCH_SUGGESTIONS = [
  { title: "Security & Gate OS", href: "/security", desc: "Gate hardware, ANPR & guard operations" },
  { title: "Visitor Pass Management", href: "/solutions", desc: "Pre-approvals, QR passes & delivery management" },
  { title: "Resident Experience App", href: "/solutions", desc: "Community notices, amenity booking & dues" },
  { title: "Platform Architecture", href: "/platform", desc: "Multi-tenant township operating system" },
  { title: "Features & Modules", href: "/features", desc: "Helpdesk SLA, maintenance & finances" },
  { title: "Book Demo & Contact", href: "/demo", desc: "Schedule a customized 1-on-1 walkthrough" },
  { title: "About GateSphere", href: "/about", desc: "Mission, township proof & leadership" },
  { title: "Resident / Staff Sign In", href: "/login", desc: "Sign into your community account" },
];

export default function PublicSearchModal({ isOpen, onClose }: PublicSearchModalProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = SEARCH_SUGGESTIONS.filter(
    (s) =>
      query === "" ||
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.desc.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <svg
            className="w-5 h-5 text-sky-400 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search platform, solutions, security, demo, about..."
            className="w-full bg-transparent text-white placeholder-slate-400 outline-none text-base"
            autoFocus
          />
          <button
            onClick={onClose}
            className="text-xs uppercase font-mono px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Search Results / Suggestions */}
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            {query ? "Search Results" : "Quick Navigation"}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.length > 0 ? (
              filtered.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => handleSelect(s.href)}
                  className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-200 hover:text-sky-300 text-xs font-medium transition text-left flex items-center justify-between cursor-pointer group"
                >
                  <div>
                    <div className="font-semibold text-slate-100 group-hover:text-sky-400 transition-colors">
                      {s.title}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1">{s.desc}</div>
                  </div>
                  <span className="text-slate-500 group-hover:translate-x-0.5 transition-transform">→</span>
                </button>
              ))
            ) : (
              <div className="col-span-2 py-6 text-center text-sm text-slate-400">
                No matching results found for &ldquo;{query}&rdquo;.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
