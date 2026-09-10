'use client';

import React, { useState } from 'react';
import { useReveal } from '@/hooks/use-reveal';

export default function Emergency() {
  const { ref, visible } = useReveal();
  const [activeTab, setActiveTab] = useState<'medical' | 'fire' | 'security'>('medical');

  const incidents = {
    medical: {
      type: 'Medical Emergency Alert',
      badge: 'Active SOS',
      sub: 'Flat B-704 · Tower Sapphire · Floor 7',
      reportedBy: 'Priya Sharma (Resident)',
      time: '10:42 AM',
      eta: 'Guard Ramesh at Door (15s)',
      actions: ['Guard Ramesh Dispatched to Flat', 'Front Gate Opened for Paramedics', 'Tower Lift Reserved for Stretcher'],
      color: '#DC2626',
      lightBg: '#FEF2F2',
      borderColor: '#FECACA',
    },
    fire: {
      type: 'Smoke Reported in Utility Room',
      badge: 'Safety Alert',
      sub: 'Basement 2 · Electrical Utility Bay',
      reportedBy: 'Sunil Patil (Facility Manager)',
      time: '08:15 AM',
      eta: 'Chief Engineer on Location',
      actions: ['Chief Engineer Sunil on Site', 'Floor Wardens Alerted by Radio', 'Residents Assisted via Safe Exit'],
      color: '#EA580C',
      lightBg: '#FFF7ED',
      borderColor: '#FFEDD5',
    },
    security: {
      type: 'Unregistered Vehicle at Gate',
      badge: 'Guard Verification',
      sub: 'North Gate · Visitor Entry Lane',
      reportedBy: 'Vikram Singh (Gate Guard)',
      time: '02:30 AM',
      eta: 'Head Guard & Patrol Responding',
      actions: ['Guard Vikram Checked ID Credentials', 'Resident Direct Call Verification', 'Patrol Guard Assigned for Escort'],
      color: '#2563EB',
      lightBg: '#EFF6FF',
      borderColor: '#BFDBFE',
    },
  };

  const current = incidents[activeTab];

  return (
    <section
      ref={ref}
      className="relative py-6 sm:py-8 bg-[#FAF9F7] overflow-hidden border-b border-slate-200"
    >
      {/* Subtle Ambient Lighting */}
      <div
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(circle, rgba(254, 226, 226, 0.7) 0%, rgba(250, 249, 247, 0) 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* ── LEFT: CONTENT & CAPABILITIES (6 COLS) ── */}
          <div className={`lg:col-span-6 reveal-left ${visible ? 'visible' : ''}`}>
            
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-100/90 border border-rose-300 mb-4 shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
              <span className="text-xs font-extrabold tracking-wider text-red-950 uppercase font-mono">
                Emergency &amp; Safety
              </span>
            </div>

            {/* Headline */}
            <h2
              className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-slate-950 tracking-tight leading-[1.14] mb-3.5"
              style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
            >
              When Every Second{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-amber-600">
                Matters.
              </span>
            </h2>

            <p
              className="text-base sm:text-lg text-slate-700 mb-8 leading-relaxed font-normal"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              GateSphere&apos;s emergency module enables rapid response — from one-tap resident panic alerts to guard dispatch and emergency service routing — with a complete audit trail.
            </p>

            {/* 4 Feature Capability Rows with High-Contrast Text */}
            <div className="space-y-3.5">
              {[
                {
                  title: 'One-Tap Emergency Broadcast',
                  desc: 'Broadcast sirens to security terminals and family members in under 1 second.',
                  icon: (
                    <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v3M4.93 4.93l2.12 2.12M2 12h3M4.93 19.07l2.12-2.12M12 22v-3M19.07 19.07l-2.12-2.12M22 12h-3M19.07 4.93l-2.12 2.12" />
                      <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" />
                    </svg>
                  ),
                },
                {
                  title: 'Precise Location Pinning',
                  desc: 'Automatically identifies flat number, tower name, and nearest entry gate.',
                  icon: (
                    <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="currentColor" fillOpacity="0.2" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  ),
                },
                {
                  title: 'Instant Security Team Dispatch',
                  desc: 'Direct dispatch alerts to nearest patrolling guards with live status updates.',
                  icon: (
                    <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="currentColor" fillOpacity="0.2" />
                      <path d="M9 12l2 2 4-4" strokeWidth="2" />
                    </svg>
                  ),
                },
                {
                  title: 'Complete Incident Audit Log',
                  desc: 'Timestamps and recorded response notes preserved automatically for compliance.',
                  icon: (
                    <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                    </svg>
                  ),
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-sm sm:text-[15px] font-bold text-slate-900 mb-0.5">{item.title}</div>
                    <div className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* ── RIGHT: CLEAN EXECUTIVE DISPATCH CARD (6 COLS) ── */}
          <div className={`lg:col-span-6 reveal-right ${visible ? 'visible' : ''} flex justify-center`}>
            <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-[0_20px_50px_rgba(15,23,42,0.08)] overflow-hidden">
              
              {/* Type Switcher */}
              <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex gap-2">
                {(['medical', 'fire', 'security'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === tab
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab === 'medical' ? '🚨 Medical' : tab === 'fire' ? '🔥 Fire' : '🛡️ Security'}
                  </button>
                ))}
              </div>

              {/* Card Header */}
              <div
                className="px-6 py-4.5 flex items-center justify-between transition-colors"
                style={{ background: current.lightBg, borderBottom: `1px solid ${current.borderColor}` }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: current.color }}>
                    {current.badge}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs font-mono">
                  {current.time}
                </span>
              </div>

              {/* Card Content */}
              <div className="p-6 sm:p-7 space-y-5">
                <div>
                  <h3
                    className="text-xl font-bold text-slate-950 mb-1"
                    style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
                  >
                    {current.type}
                  </h3>
                  <p className="text-sm text-slate-700 font-medium">{current.sub}</p>
                </div>

                {/* 2x2 Telemetry Grid with Clear Text */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-600 font-semibold block">Reported Channel</span>
                    <span className="text-sm font-bold text-slate-900 mt-1 block">{current.reportedBy}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-600 font-semibold block">Dispatch ETA</span>
                    <span className="text-sm font-bold text-amber-800 mt-1 block">{current.eta}</span>
                  </div>
                </div>

                {/* Action Protocols */}
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2.5 font-mono">
                    Response Checklist
                  </span>
                  <div className="space-y-2">
                    {current.actions.map((act, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm"
                      >
                        <span className="text-slate-800 font-medium">{act}</span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-mono">
                          ✓ Executed
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live Status CTA */}
                <div className="pt-3 flex items-center justify-between border-t border-slate-200 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Guard Walkie-Talkie Synced</span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono">STATUS: LIVE</span>
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
