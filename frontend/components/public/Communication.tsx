'use client';

import React, { useState } from 'react';
import { useReveal } from '@/hooks/use-reveal';

interface NotificationItem {
  id: string;
  category: string;
  title: string;
  message: string;
  time: string;
  badge: string;
  color: string;
  lightBg: string;
  icon: React.ReactNode;
}

const notifications: NotificationItem[] = [
  {
    id: 'maint',
    category: 'Society Operations',
    title: 'Water Supply Maintenance',
    message: 'Tower B & C pressure tank overhaul scheduled for 2:00 PM – 4:00 PM today.',
    time: '10:15 AM',
    badge: 'Operations',
    color: '#D97706',
    lightBg: '#FFFBEB',
    icon: (
      <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: 'clubhouse',
    category: 'Amenity Reservation',
    title: 'Clubhouse Court Confirmed',
    message: 'Badminton Court 02 confirmed for today 6:00 PM – 7:00 PM with dynamic smart lock pass.',
    time: '11:02 AM',
    badge: 'Lifestyle',
    color: '#0D9488',
    lightBg: '#F0FDFA',
    icon: (
      <svg className="w-5 h-5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 20c2-1 4-1 6 0s4 1 6 0 4-1 6 0M2 16c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />
        <circle cx="12" cy="7" r="2.5" />
      </svg>
    ),
  },
  {
    id: 'visitor',
    category: 'Front Gate Alert',
    title: 'Pre-Approved Guest Entry',
    message: 'Your guest Dr. Ananya Krishnan (KA-01-MJ-9921) entered via Gate 01 boom barrier.',
    time: '12:34 PM',
    badge: 'Access',
    color: '#16A34A',
    lightBg: '#F0FDF4',
    icon: (
      <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
        <path d="M9 12l2 2 4-4" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'agm',
    category: 'Committee Circular',
    title: 'Annual General Meeting (AGM)',
    message: 'Official agenda & digital voting proxy available for Sunday 10:00 AM session.',
    time: '03:00 PM',
    badge: 'Official',
    color: '#2563EB',
    lightBg: '#EFF6FF',
    icon: (
      <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
];

export default function Communication() {
  const { ref, visible } = useReveal();
  const [selectedCategory] = useState<string>('all');

  const filtered = selectedCategory === 'all'
    ? notifications
    : notifications.filter((n) => n.id === selectedCategory);

  return (
    <section
      ref={ref}
      className="relative py-6 sm:py-8 bg-white overflow-hidden border-b border-slate-200/80"
      style={{
        backgroundImage:
          'radial-gradient(circle at 10% 20%, rgba(224, 242, 254, 0.45) 0%, transparent 45%), radial-gradient(circle at 90% 80%, rgba(240, 253, 244, 0.45) 0%, transparent 45%)',
      }}
    >
      {/* Background Geometric Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#F1F5F9_1px,transparent_1px),linear-gradient(to_bottom,#F1F5F9_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-60 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* ── LEFT: CONTENT & FEATURE PILLARS (6.5 COLS) ── */}
          <div className={`lg:col-span-6 reveal-left ${visible ? 'visible' : ''}`}>
            
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 mb-3.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span
                className="text-[11px] font-bold tracking-wider text-blue-900 uppercase"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Resident &amp; Community Comms
              </span>
            </div>

            {/* Headline */}
            <h2
              className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-slate-950 tracking-tight leading-[1.14] mb-3"
              style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
            >
              Keep the Whole Community{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-teal-600">
                in Sync.
              </span>
            </h2>

            <p
              className="text-base sm:text-lg text-slate-600 mb-8 leading-relaxed font-normal"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Replace paper circulars and messy chat groups with targeted announcements, multimedia notices, emergency broadcasts, and verified read receipts.
            </p>

            {/* 4 Bespoke Vector Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  id: 'broadcast',
                  label: 'Broadcast Notices',
                  desc: 'Target by tower, block, or whole society with rich photos & PDFs.',
                  icon: (
                    <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 11V9a2 2 0 0 1 2-2h2l5-4v14l-5-4H5a2 2 0 0 1-2-2z" fill="currentColor" fillOpacity="0.1" />
                      <path d="M15 8a4 4 0 0 1 0 8M18 6a7 7 0 0 1 0 12" />
                    </svg>
                  ),
                },
                {
                  id: 'emergency',
                  label: 'Urgent Audio Alerts',
                  desc: 'Persistent bypass of phone silent mode for emergency circulars.',
                  icon: (
                    <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v3M4.93 4.93l2.12 2.12M2 12h3M4.93 19.07l2.12-2.12M12 22v-3M19.07 19.07l-2.12-2.12M22 12h-3M19.07 4.93l-2.12 2.12" />
                      <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" />
                    </svg>
                  ),
                },
                {
                  id: 'direct',
                  label: 'Private Resident SMS',
                  desc: 'Automated personal payment due reminders and parcel notifications.',
                  icon: (
                    <svg className="w-5 h-5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="currentColor" fillOpacity="0.1" />
                    </svg>
                  ),
                },
                {
                  id: 'telemetry',
                  label: 'Verified Read Telemetry',
                  desc: 'Real-time telemetry showing exactly which flats read the notice.',
                  icon: (
                    <svg className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" strokeWidth="2.5" />
                      <line x1="12" y1="20" x2="12" y2="4" strokeWidth="2.5" />
                      <line x1="6" y1="20" x2="6" y2="14" strokeWidth="2.5" />
                    </svg>
                  ),
                },
              ].map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center mb-3">
                    {item.icon}
                  </div>
                  <div className="text-sm font-bold text-slate-900 mb-1">{item.label}</div>
                  <div className="text-xs text-slate-600 leading-relaxed font-light">{item.desc}</div>
                </div>
              ))}
            </div>

          </div>

          {/* ── RIGHT: EXECUTIVE IPHONE 16 DEVICE FRAME (6 COLS) ── */}
          <div className={`lg:col-span-6 reveal-right ${visible ? 'visible' : ''} flex justify-center`}>
            <div className="w-full max-w-[340px] rounded-[44px] p-3 bg-slate-900 border-4 border-slate-700/80 shadow-[0_30px_70px_rgba(15,23,42,0.25)] relative">
              
              {/* Dynamic Island Pill */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-20 flex items-center justify-end px-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700" />
              </div>

              {/* Screen Inner */}
              <div className="rounded-[36px] overflow-hidden bg-slate-50 border border-slate-200 text-slate-900 pt-7 pb-4">
                
                {/* Header inside phone */}
                <div className="px-5 pb-3 border-b border-slate-200/80 bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono mb-1">
                    <span>9:41 AM</span>
                    <span>5G · 100%</span>
                  </div>
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wider font-mono">GateSphere Super-App</div>
                  <h3 className="text-base font-extrabold text-slate-900">Community Feed</h3>
                </div>

                {/* Notifications Stack */}
                <div className="p-3.5 space-y-2.5 max-h-[360px] overflow-y-auto">
                  {filtered.map((n) => (
                    <div
                      key={n.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs transition-all hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-2xs"
                            style={{ background: n.lightBg }}
                          >
                            {n.icon}
                          </div>
                          <span className="text-[11px] font-bold text-slate-800">{n.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{n.time}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-light pl-9">
                        {n.message}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Bottom App Dock */}
                <div className="px-6 pt-3 mt-1 border-t border-slate-200/80 bg-white flex items-center justify-between text-slate-400 text-xs">
                  <span className="text-blue-600 font-bold flex flex-col items-center gap-0.5">
                    <span>🏠</span>
                    <span className="text-[9px]">Home</span>
                  </span>
                  <span className="flex flex-col items-center gap-0.5">
                    <span>👥</span>
                    <span className="text-[9px]">Directory</span>
                  </span>
                  <span className="flex flex-col items-center gap-0.5">
                    <span>💳</span>
                    <span className="text-[9px]">Pay</span>
                  </span>
                  <span className="flex flex-col items-center gap-0.5">
                    <span>⚙️</span>
                    <span className="text-[9px]">Services</span>
                  </span>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
