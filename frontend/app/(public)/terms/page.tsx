"use client";

import React from "react";
import Link from "next/link";
import PublicLayout from "@/components/public/PublicLayout";

export default function TermsPage() {
  const sections = [
    {
      id: "acceptance",
      title: "1. Acceptance of Terms",
      content:
        "By accessing, installing, or utilizing the GateSphere Enterprise platform, mobile applications, hardware gate integrations, or administrative portals, you agree to be bound by these Terms and Conditions and our Privacy Policy. If you are entering into this agreement on behalf of a residential welfare association (RWA), gated community, or enterprise entity, you represent that you possess the authority to bind such entity.",
    },
    {
      id: "services",
      title: "2. Description of Services",
      content:
        "GateSphere provides an end-to-end community gate security, visitor management, access control integration, maintenance accounting, complaint resolution, and resident communication infrastructure. We reserve the right to modify, upgrade, or temporarily suspend aspects of the service for system maintenance, security enhancements, or emergency updates.",
    },
    {
      id: "responsibilities",
      title: "3. User Roles & Account Responsibilities",
      content:
        "Users (including Super Admins, Community Admins, Security Supervisors, Security Guards, Committee Members, and Residents) are responsible for maintaining the confidentiality of their credentials and two-factor authentication factors. Any unauthorized access or suspected breach of credentials must be reported to the platform security team immediately.",
    },
    {
      id: "access-hardware",
      title: "4. Access Control & Gate Hardware Integration",
      content:
        "ANPR (Automatic Number Plate Recognition) cameras, RFID boom barriers, biometric gates, and intercom hardware provisioned or integrated with GateSphere must be operated in accordance with manufacturer guidelines and local regulatory safety codes. GateSphere is not liable for mechanical hardware failures resulting from local power outages or physical tampering.",
    },
    {
      id: "data-privacy",
      title: "5. Data Privacy & Visitor Log Handling",
      content:
        "Visitor logs, entry/exit timestamps, vehicle registration numbers, and resident directory information are stored with AES-256 encryption at rest and TLS 1.3 in transit. Data retention schedules follow society-configured policies and applicable legal compliance requirements. Society administrators are the controllers of community-specific resident and visitor data.",
    },
    {
      id: "billing",
      title: "6. Billing, Subscriptions & Renewal",
      content:
        "Enterprise and society subscriptions are billed on monthly or annual terms as specified in the service agreement. Fees are non-refundable except where required by law. Failure to settle outstanding license fees within the designated grace period may result in restricted administrative capabilities while critical security logs remain preserved.",
    },
    {
      id: "liability",
      title: "7. Limitation of Liability",
      content:
        "GateSphere provides digital security orchestration tools and verification software. While our systems enforce strict identity verification and tamper-evident audit trails, physical security, perimeter integrity, and emergency law-enforcement dispatch remain the operational responsibility of on-site security personnel and local authorities.",
    },
    {
      id: "modifications",
      title: "8. Amendments & Termination",
      content:
        "GateSphere reserves the right to revise these Terms periodically. We will provide notice of material modifications via portal notification or email. Continued use of the platform after effective dates signifies acceptance of revised terms.",
    },
  ];

  return (
    <PublicLayout>
      <div className="w-full pt-28 sm:pt-36 pb-20 bg-[#090D16] text-slate-200 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Banner */}
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
              <span>Legal & Governance</span>
            </div>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Terms & Conditions
            </h1>
            <p
              className="mt-4 text-slate-400 text-sm sm:text-base leading-relaxed"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Last Updated: January 2026 • Effective for all GateSphere Enterprise platforms, portals, and mobile suites.
            </p>
          </div>

          {/* Quick Summary Card */}
          <div className="mb-10 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-indigo-950/40 border border-blue-500/20 shadow-xl backdrop-blur-sm">
            <h2
              className="text-lg font-bold text-white mb-2"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Executive Summary
            </h2>
            <p
              className="text-sm text-slate-300 leading-relaxed"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              These Terms of Service govern the access and use of GateSphere’s security automation, visitor validation, resident coordination, and gate hardware platform. Please review the complete terms below. If you have questions regarding contractual terms or enterprise licensing, please reach out to our legal and support team.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-cyan-400">
              <Link href="/cookies" className="hover:underline flex items-center gap-1">
                <span>View Cookie Policy</span> →
              </Link>
              <Link href="/security" className="hover:underline flex items-center gap-1">
                <span>Security Architecture & Encryption</span> →
              </Link>
              <Link href="/demo" className="hover:underline flex items-center gap-1">
                <span>Contact Legal Support</span> →
              </Link>
            </div>
          </div>

          {/* Terms Content Sections */}
          <div className="space-y-6">
            {sections.map((section) => (
              <div
                key={section.id}
                id={section.id}
                className="p-6 sm:p-8 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-blue-500/30 transition-all shadow-sm"
              >
                <h3
                  className="text-lg sm:text-xl font-bold text-white mb-3"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {section.title}
                </h3>
                <p
                  className="text-sm sm:text-[15px] text-slate-300 leading-relaxed"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          {/* Contact Support Section */}
          <div className="mt-12 p-8 rounded-2xl bg-[#0d1424] border border-slate-800 text-center">
            <h3
              className="text-xl font-bold text-white mb-2"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              Questions About Our Terms?
            </h3>
            <p className="text-sm text-slate-400 max-w-xl mx-auto mb-6">
              Our legal and compliance specialists are available to answer any questions regarding data governance, enterprise SLAs, and community guidelines.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/demo"
                className="px-6 py-3 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider text-white bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 transition-all shadow-lg shadow-red-500/25"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Contact Support
              </Link>
              <a
                href="mailto:support@gatesphere.io"
                className="px-6 py-3 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                support@gatesphere.io
              </a>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
