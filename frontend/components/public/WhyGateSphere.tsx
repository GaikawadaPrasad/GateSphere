'use client';

import React from 'react';
import { useReveal } from '@/hooks/use-reveal';

interface Pillar {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  desc: string;
  metric: string;
  metricLabel: string;
  color: string;
  lightBg: string;
  accentBorder: string;
  tags: string[];
  icon: React.ReactNode;
}

const pillars: Pillar[] = [
  {
    id: 'security',
    badge: 'Zero-Breach Foundation',
    title: 'Security-First Architecture',
    subtitle: 'Access control is the cornerstone of community safety.',
    desc: 'Automated boom barriers, instant ANPR license plate recognition, digital guard logs, and verified visitor passes built right into the foundation.',
    metric: '99.99%',
    metricLabel: 'Hardware Uptime',
    color: '#2563EB',
    lightBg: '#EFF6FF',
    accentBorder: 'border-blue-200',
    tags: ['Boom Barriers', 'ANPR Cameras', 'Digital Guard Logs', 'Offline Mode'],
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="currentColor" fillOpacity="0.15" />
        <path d="M9 12l2 2 4-4" strokeWidth="2.2" />
      </svg>
    ),
  },
  {
    id: 'unified',
    badge: 'Real-Time Sync',
    title: 'One Unified Data Layer',
    subtitle: 'No silos, no spreadsheets — just one accurate live picture.',
    desc: 'Residents, security teams, facility engineers, and managing committees work from a single live database. Everything updates in milliseconds.',
    metric: '< 20ms',
    metricLabel: 'Cloud Latency',
    color: '#0D9488',
    lightBg: '#F0FDFA',
    accentBorder: 'border-teal-200',
    tags: ['Single Source of Truth', 'Instant Sync', 'Zero Duplicate Data', 'Bank-Grade AES-256'],
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    id: 'visibility',
    badge: 'Executive Intelligence',
    title: 'Real-Time Operational Visibility',
    subtitle: 'Live dashboards that give committee members complete clarity.',
    desc: 'Monitor real-time gate traffic, open maintenance ticket resolution times, society dues collection percentages, and amenity bookings at a glance.',
    metric: '100%',
    metricLabel: 'Audit Trail',
    color: '#7C3AED',
    lightBg: '#F5F3FF',
    accentBorder: 'border-purple-200',
    tags: ['Live MIS Reports', 'Financial Aging', 'SLA Scorecards', 'One-Click Exports'],
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" strokeWidth="2.5" />
        <line x1="12" y1="20" x2="12" y2="4" strokeWidth="2.5" />
        <line x1="6" y1="20" x2="6" y2="14" strokeWidth="2.5" />
      </svg>
    ),
  },
  {
    id: 'roles',
    badge: 'Tailored UX',
    title: 'Purpose-Built for Every Role',
    subtitle: 'Every user gets an interface crafted specifically for their daily flow.',
    desc: 'Guards get high-contrast large buttons for fast gate entry. Residents get a super-app. Managers get deep financial controls and ticketing systems.',
    metric: '4.9 ★',
    metricLabel: 'Resident App Rating',
    color: '#D97706',
    lightBg: '#FFFBEB',
    accentBorder: 'border-amber-200',
    tags: ['Guard Terminal', 'Resident Super-App', 'Admin Dashboard', 'Technician App'],
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export default function WhyGateSphere() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      className="relative py-14 sm:py-20 bg-[#F1F5F9] overflow-hidden border-b border-slate-200"
    >
      {/* Dynamic Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#CBD5E1_1px,transparent_1px),linear-gradient(to_bottom,#CBD5E1_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-35 pointer-events-none" />

      {/* Ambient Lighting */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-[140px] pointer-events-none opacity-50"
        style={{
          background: 'radial-gradient(circle, rgba(186, 230, 253, 0.7) 0%, rgba(241, 245, 249, 0) 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
        
        {/* ── HEADER ── */}
        <div className={`text-center mb-12 sm:mb-14 reveal ${visible ? 'visible' : ''}`}>
          
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-blue-200/80 mb-3.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span
              className="text-[11px] font-bold tracking-wider text-blue-900 uppercase"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Why GateSphere
            </span>
          </div>

          {/* High-Impact Headline */}
          <h2
            className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-slate-950 tracking-tight leading-[1.14] mb-3"
            style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
          >
            Four Strategic Pillars That Power{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-teal-600">
              Modern Communities
            </span>
          </h2>

          {/* Subtitle */}
          <p
            className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Engineered from the ground up to replace fragmented society tools with an integrated, high-availability community OS.
          </p>
        </div>

        {/* ── 2x2 BENTO GRID OF HIGH-END PILLARS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {pillars.map((p, i) => (
            <div
              key={p.id}
              className={`reveal reveal-delay-${i + 1} ${visible ? 'visible' : ''} rounded-3xl bg-white border border-slate-200/90 shadow-[0_12px_35px_rgba(15,23,42,0.06)] hover:shadow-[0_22px_50px_rgba(15,23,42,0.12)] hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between`}
            >
              {/* Card Header with Metric */}
              <div
                className="px-7 py-6 border-b border-slate-100 flex items-center justify-between"
                style={{ background: p.lightBg }}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xs"
                    style={{ background: p.color }}
                  >
                    {p.icon}
                  </div>
                  <div>
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider block font-mono"
                      style={{ color: p.color }}
                    >
                      {p.badge}
                    </span>
                    <h3
                      className="text-xl font-bold text-slate-900 mt-0.5"
                      style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
                    >
                      {p.title}
                    </h3>
                  </div>
                </div>

                {/* Benchmark Stat Pill */}
                <div className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/90 text-center shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-medium">{p.metricLabel}</div>
                  <div className="text-sm font-black text-slate-900 font-mono">{p.metric}</div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-7 space-y-5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-1.5">
                    {p.subtitle}
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed font-light">
                    {p.desc}
                  </p>
                </div>

                {/* Tag Pills */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200/70"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
