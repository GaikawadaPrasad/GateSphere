"use client";

import React, { useState } from "react";
import Link from "next/link";
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
    q: "Can residents approve deliveries & cabs without calling the guard?",
    a: "Yes. GateSphere features real-time gate arrival alerts for Amazon, Swiggy, Uber, and delivery partners. Residents can grant 1-tap automated entry clearance or authorize contactless drop-off directly from the notification.",
    category: "residents",
    tag: "Residents",
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
    (faq) => selectedCategory === "all" || faq.category === selectedCategory || faq.category === "all"
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
          {/* ── LEFT COLUMN ── */}
          <div className={`lg:col-span-5 reveal-left ${visible ? "visible" : ""} space-y-6 lg:sticky lg:top-24`}>
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 mb-3.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span
                  className="text-[11px] font-bold tracking-wider text-blue-900 uppercase"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Help &amp; Insights
                </span>
              </div>

              <h2
                className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight leading-[1.14] mb-3"
                style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
              >
                Frequently asked{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-teal-600">
                  questions.
                </span>
              </h2>

              <p className="text-[14.5px] text-slate-600 leading-relaxed">
                Everything you need to know about GateSphere deployment, resident privacy, gate hardware, and society accounting.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2 pt-2">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* 24/7 Support Box */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-xl">
                  💬
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Have a unique community question?</div>
                  <div className="text-xs text-slate-400">Our specialists are available 24/7.</div>
                </div>
              </div>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 text-xs font-bold text-sky-400 hover:text-sky-300 transition"
              >
                <span>Speak with an executive specialist</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Accordion ── */}
          <div className={`lg:col-span-7 reveal-right ${visible ? "visible" : ""} space-y-3`}>
            {filteredFaqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={faq.q}
                  className={`border rounded-2xl transition-all duration-200 overflow-hidden ${
                    isOpen ? "bg-white border-blue-300 shadow-md shadow-blue-500/5" : "bg-white/80 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full text-left p-5 flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span
                      className={`text-[15px] sm:text-[16px] font-bold transition-colors ${
                        isOpen ? "text-blue-700" : "text-slate-900"
                      }`}
                      style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
                    >
                      {faq.q}
                    </span>
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-transform duration-200 ${
                        isOpen ? "bg-blue-100 text-blue-700 rotate-180" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      ↓
                    </span>
                  </button>

                  <div className={`faq-answer px-5 pb-5 pt-0 text-slate-600 text-sm leading-relaxed ${isOpen ? "open" : ""}`}>
                    <p className="pt-2 border-t border-slate-100">{faq.a}</p>
                    <div className="mt-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${faq.tagColor}`}>
                        {faq.tag}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
