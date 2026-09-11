"use client";

import React, { useState } from "react";
import { useReveal } from "@/hooks/use-reveal";

interface FAQItem {
  q: string;
  a: string;
  category: "all" | "security" | "residents" | "maintenance" | "enterprise";
  tag: string;
  tagColor: string;
}

const faqs: FAQItem[] = [
  {
    q: "What is GateSphere and how does it work?",
    a: "GateSphere is an enterprise-grade gated community platform that unifies AI-powered gate security, instant resident visitor pre-approvals, 1-tap maintenance dues, amenity reservations, and emergency incident audits into a single coordinated system.",
    category: "all",
    tag: "Overview",
    tagColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    q: "How does visitor pre-approval and gate ANPR work?",
    a: "Residents pre-approve guests in one tap via the mobile app, generating an instant dynamic QR pass or 6-digit OTP. When the visitor arrives, high-resolution gate cameras perform automated ANPR license plate lookup while security verifies the digital pass in under 5 seconds.",
    category: "security",
    tag: "Security",
    tagColor: "bg-teal-50 text-teal-700 border-teal-200",
  },
  {
    q: "What happens if an unauthorized or blacklisted vehicle arrives at the gate?",
    a: "Our ANPR edge nodes cross-reference vehicle plates against the community database in real time (<300ms). If an unregistered or blacklisted vehicle approaches, the boom barrier remains locked and security guards receive a loud audio-visual alert with emergency SOP instructions.",
    category: "security",
    tag: "Security",
    tagColor: "bg-teal-50 text-teal-700 border-teal-200",
  },
  {
    q: "Can residents approve deliveries & cabs without calling the guard?",
    a: "Yes. GateSphere features real-time gate arrival alerts for Amazon, Swiggy, Uber, and delivery partners. Residents can grant 1-tap automated entry clearance or authorize contactless drop-off directly from the notification.",
    category: "residents",
    tag: "Residents",
    tagColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    q: "How does GateSphere protect resident contact numbers and privacy?",
    a: "GateSphere enforces strict number masking. Delivery personnel and security staff can call residents through an encrypted in-app VOIP / masked routing relay without ever seeing personal mobile numbers.",
    category: "residents",
    tag: "Privacy",
    tagColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    q: "How does the end-to-end maintenance ticketing workflow work?",
    a: "Residents raise photo-enabled tickets from the app. GateSphere automatically routes and assigns the request to the on-duty electrician, plumber, or technician with a 2-hour SLA timer. Residents must confirm satisfactory resolution before any ticket is closed.",
    category: "maintenance",
    tag: "Maintenance",
    tagColor: "bg-amber-50 text-amber-800 border-amber-200",
  },
  {
    q: "What payment methods are supported for society dues?",
    a: "GateSphere supports instant UPI, Credit/Debit Cards, NetBanking, and Auto-Debit mandates with automated digital receipts, real-time RWA ledger reconciliation, and zero manual accounting errors.",
    category: "maintenance",
    tag: "Finance",
    tagColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    q: "How fast can our society be onboarded?",
    a: "Full turnkey onboarding is completed within 48 hours. Our dedicated team handles resident directory data migration, hardware compatibility checks, guard tablet setup, and hands-on staff training with zero downtime.",
    category: "enterprise",
    tag: "Onboarding",
    tagColor: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    q: "Does GateSphere support role-based access for RWA & facility managers?",
    a: "Yes. Strict role-based permissions ensure Administrators, Security Personnel, Facility Heads, and Residents each access customized dashboards with immutable cryptographic audit logs.",
    category: "enterprise",
    tag: "Compliance",
    tagColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
];

const categories = [
  { id: "all", label: "All Questions" },
  { id: "security", label: "Gate & Security" },
  { id: "residents", label: "Resident App" },
  { id: "maintenance", label: "Dues & Maintenance" },
  { id: "enterprise", label: "Society Admins" },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { ref, visible } = useReveal();

  const filteredFaqs = faqs.filter(
    (faq) => selectedCategory === "all" || faq.category === selectedCategory || (selectedCategory !== "all" && faq.category === "all")
  );

  return (
    <section
      ref={ref}
      className="relative py-12 sm:py-16 bg-white overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(circle at 15% 15%, rgba(224, 242, 254, 0.4) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(240, 253, 244, 0.4) 0%, transparent 45%)",
      }}
    >
      {/* Background Geometric Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#F1F5F9_1px,transparent_1px),linear-gradient(to_bottom,#F1F5F9_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-60 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* ── LEFT COLUMN: Header & 24/7 Support Card (5 Cols) ── */}
          <div className={`lg:col-span-5 reveal-left ${visible ? "visible" : ""} space-y-6 lg:sticky lg:top-24`}>
            <div>
              {/* Pill Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 mb-3 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span
                  className="text-[11px] font-bold tracking-wider text-blue-900 uppercase"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Frequently Asked Questions
                </span>
              </div>

              {/* Heading */}
              <h2
                className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight leading-[1.15] mb-3"
                style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
              >
                Everything you need to know{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-teal-600">
                  about GateSphere.
                </span>
              </h2>

              <p
                className="text-[14.5px] text-slate-600 font-normal leading-relaxed"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Find fast answers on gate security, resident pre-approvals, society billing, and fast 48-hour onboarding.
              </p>
            </div>

          </div>

          {/* ── RIGHT COLUMN: Category Filter Tabs & Modern Accordion (7 Cols) ── */}
          <div className={`lg:col-span-7 reveal-right ${visible ? "visible" : ""} space-y-4`}>
            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2 pb-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setOpenIndex(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? "bg-blue-700 text-white shadow-sm shadow-blue-500/20"
                      : "bg-[#F1F5F9] text-slate-700 hover:bg-slate-200"
                  }`}
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Accordion Item Stack */}
            <div className="space-y-3">
              {filteredFaqs.map((faq, i) => {
                const isOpen = openIndex === i;
                return (
                  <div
                    key={faq.q}
                    className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                      isOpen
                        ? "bg-[#F8FAFC] border-blue-300 shadow-md shadow-blue-500/5"
                        : "bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs"
                    }`}
                  >
                    <button
                      onClick={() => setOpenIndex(isOpen ? null : i)}
                      className="w-full flex items-center justify-between p-4 sm:p-4.5 text-left cursor-pointer gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${faq.tagColor}`}>
                          {faq.tag}
                        </span>
                        <span
                          className="text-[14.5px] sm:text-[15.5px] font-bold text-slate-900 tracking-tight leading-snug"
                          style={{ fontFamily: "'Outfit', sans-serif" }}
                        >
                          {faq.q}
                        </span>
                      </div>

                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                          isOpen
                            ? "bg-blue-600 text-white rotate-45 shadow-sm"
                            : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                        </svg>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4.5 pb-4.5 pt-1 text-[13.5px] leading-relaxed text-slate-600 border-t border-slate-200/60 animate-in fade-in slide-in-from-top-1 duration-200">
                        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          {faq.a}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
