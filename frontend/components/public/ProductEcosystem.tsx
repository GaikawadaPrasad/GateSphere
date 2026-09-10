'use client';

import React, { useState } from 'react';
import { useReveal } from '@/hooks/use-reveal';

interface NodeData {
  id: string;
  label: string;
  angle: number;
  color: string;
  lightBg: string;
  category: string;
}

const nodes: NodeData[] = [
  { id: 'security', label: 'Security & Gates', angle: 270, color: '#2563EB', lightBg: '#EFF6FF', category: 'Security' },
  { id: 'residents', label: 'Resident Portal', angle: 306, color: '#0D9488', lightBg: '#F0FDFA', category: 'Community' },
  { id: 'visitors', label: 'Visitor Pass', angle: 342, color: '#7C3AED', lightBg: '#F5F3FF', category: 'Front Gate' },
  { id: 'maintenance', label: 'Helpdesk SLA', angle: 18, color: '#16A34A', lightBg: '#F0FDF4', category: 'Operations' },
  { id: 'payments', label: 'Ledger & Dues', angle: 54, color: '#D97706', lightBg: '#FFFBEB', category: 'Finance' },
  { id: 'parking', label: 'Smart Parking', angle: 90, color: '#0284C7', lightBg: '#F0F9FF', category: 'Hardware' },
  { id: 'amenities', label: 'Clubhouse Hub', angle: 126, color: '#9333EA', lightBg: '#FAF5FF', category: 'Lifestyle' },
  { id: 'comms', label: 'Broadcast Sync', angle: 162, color: '#EA580C', lightBg: '#FFF7ED', category: 'Comms' },
  { id: 'emergency', label: 'Emergency SOS', angle: 198, color: '#DC2626', lightBg: '#FEF2F2', category: 'Safety' },
  { id: 'reports', label: 'Executive MIS', angle: 234, color: '#475569', lightBg: '#F8FAFC', category: 'Executive' },
];

function renderSvgIcon(id: string, color: string, isActive: boolean) {
  const iconColor = isActive ? '#FFFFFF' : color;
  const strokeW = '2';

  switch (id) {
    case 'security':
      return (
        <g stroke={iconColor} fill="none" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill={isActive ? '#FFFFFF' : color} fillOpacity={isActive ? 0.25 : 0.1} />
          <path d="M9 12l2 2 4-4" strokeWidth="2.2" />
        </g>
      );
    case 'residents':
      return (
        <g stroke={iconColor} fill="none" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </g>
      );
    case 'visitors':
      return (
        <g stroke={iconColor} fill="none" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2.5" fill={isActive ? '#FFFFFF' : color} fillOpacity={isActive ? 0.2 : 0.08} />
          <circle cx="9" cy="10" r="2.5" />
          <path d="M15 8h2M15 12h2M6 16h12" />
        </g>
      );
    case 'maintenance':
      return (
        <g stroke={iconColor} fill="none" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" fill={isActive ? '#FFFFFF' : color} fillOpacity={isActive ? 0.25 : 0.1} />
        </g>
      );
    case 'payments':
      return (
        <g stroke={iconColor} fill="none" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" fill={isActive ? '#FFFFFF' : color} fillOpacity={isActive ? 0.2 : 0.08} />
          <line x1="2" y1="10" x2="22" y2="10" />
          <circle cx="6.5" cy="15" r="1" fill={iconColor} />
          <line x1="11" y1="15" x2="16" y2="15" />
        </g>
      );
    case 'parking':
      return (
        <g stroke={iconColor} fill="none" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 16h14v-4l-2-5H7L5 12v4z" fill={isActive ? '#FFFFFF' : color} fillOpacity={isActive ? 0.2 : 0.08} />
          <circle cx="7.5" cy="16.5" r="1.5" fill={iconColor} />
          <circle cx="16.5" cy="16.5" r="1.5" fill={iconColor} />
          <line x1="8" y1="7" x2="16" y2="7" />
        </g>
      );
    case 'amenities':
      return (
        <g stroke={iconColor} fill="none" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 20c2-1 4-1 6 0s4 1 6 0 4-1 6 0M2 16c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />
          <circle cx="12" cy="7" r="2.5" />
          <path d="M12 9.5v3l3 2" />
        </g>
      );
    case 'comms':
      return (
        <g stroke={iconColor} fill="none" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11V9a2 2 0 0 1 2-2h2l5-4v14l-5-4H5a2 2 0 0 1-2-2z" fill={isActive ? '#FFFFFF' : color} fillOpacity={0.25} />
          <path d="M15 8a4 4 0 0 1 0 8M18 6a7 7 0 0 1 0 12" />
        </g>
      );
    case 'emergency':
      return (
        <g stroke={iconColor} fill="none" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v3M4.93 4.93l2.12 2.12M2 12h3M4.93 19.07l2.12-2.12M12 22v-3M19.07 19.07l-2.12-2.12M22 12h-3M19.07 4.93l-2.12 2.12" />
          <circle cx="12" cy="12" r="4" fill={isActive ? '#FFFFFF' : color} fillOpacity={isActive ? 0.45 : 0.2} />
        </g>
      );
    case 'reports':
      return (
        <g stroke={iconColor} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </g>
      );
    default:
      return null;
  }
}

const details: Record<string, { title: string; subtitle: string; desc: string; metrics: { k: string; v: string }[]; bullets: string[] }> = {
  security: {
    title: 'Access Control & Gate OS',
    subtitle: 'Manual guard verifications, photo capture, and OTP-based resident approvals.',
    desc: 'Provides seamless, millisecond-level verification at vehicle barriers and pedestrian turnstiles. Full audit logs synchronized across society leadership in real time.',
    metrics: [{ k: 'Sync Speed', v: '< 20ms' }, { k: 'Barrier Speed', v: '0.8s' }, { k: 'Hardware Uptime', v: '99.99%' }],
    bullets: [
      'Guard-operated boom barriers & manual license plate logging',
      'Guard terminal with offline failover mode for 100% uptime',
      'Pre-authorized QR visitor passes for instant express entry',
      '24/7 continuous gate CCTV telemetry and intrusion alerts',
    ],
  },
  residents: {
    title: 'Resident Super-App & Directory',
    subtitle: 'The unified daily mobile companion for modern gated township living.',
    desc: 'Empowers residents to pre-approve deliveries, settle society dues, reserve clubhouse facilities, and communicate directly with management.',
    metrics: [{ k: 'Active Residents', v: '98.6%' }, { k: 'Approval Speed', v: '1-Tap' }, { k: 'App Rating', v: '4.9 / 5' }],
    bullets: [
      'One-tap instant visitor approval & digital pass generation',
      'Digital unit directory with granular family privacy controls',
      'Direct committee polling, AGM circulars & society notices',
      'Integrated emergency siren button with direct guard alert',
    ],
  },
  visitors: {
    title: 'Visitor Pass & Delivery Engine',
    subtitle: 'Zero gate bottlenecks with biometric & QR digital guest credentials.',
    desc: 'Transforms slow manual logbooks into an instant scan. Pre-approved visitors drive through without stopping for paperwork.',
    metrics: [{ k: 'Gate Scan Time', v: '1.2s' }, { k: 'Daily Passes', v: '45,000+' }, { k: 'Paper Reduction', v: '100%' }],
    bullets: [
      'Dynamic WhatsApp & SMS guest invite links with QR passes',
      'Manual photo capture by guard & physical vehicle plate logging',
      'Delivery parcel staging with resident OTP pickup confirmation',
      'Overstay detection with manual guard escalation alerts',
    ],
  },
  maintenance: {
    title: 'Helpdesk SLA & Maintenance Desk',
    subtitle: 'Manual ticket routing from resident complaint to closure.',
    desc: 'Residents raise maintenance issues in seconds with photos. The engine auto-assigns technicians and tracks SLA turnaround times.',
    metrics: [{ k: 'Avg Resolution', v: '2.4 hrs' }, { k: 'SLA Adherence', v: '99.1%' }, { k: 'Resolved Tickets', v: '180k+' }],
    bullets: [
      'Photo & video attachments for plumbing, electrical & lifts',
      'Manual technician duty roster assignment',
      'Real-time timeline tracking with resident digital sign-off',
      'Vendor performance scoring and spare parts ledger',
    ],
  },
  payments: {
    title: 'Manual Accounting & Billing',
    subtitle: '100% manual maintenance collection & vendor reconciliation.',
    desc: 'Generate manual monthly bills, collect via UPI, cards, or Net Banking, and reconcile every transaction directly into society ledgers.',
    metrics: [{ k: 'Collection Rate', v: '99.4%' }, { k: 'Auto Invoicing', v: 'Instant' }, { k: 'Reconciliation', v: '100%' }],
    bullets: [
      'Manual GST-compliant maintenance invoices & receipts',
      'UPI, Credit/Debit card & manual collection gateways',
      'Manual payment reminder schedules via WhatsApp & SMS',
      'Comprehensive ledger, balance sheet & audit-ready MIS exports',
    ],
  },
  parking: {
    title: 'Smart Parking & Fastag Control',
    subtitle: 'Manual slot allocation with overstay detection sensors.',
    desc: 'Seamless RFID and vehicle plate matching ensures unauthorized vehicles cannot enter or occupy assigned resident parking slots.',
    metrics: [{ k: 'Slot Efficiency', v: '99.8%' }, { k: 'RFID Response', v: '< 50ms' }, { k: 'Violations', v: '0.01%' }],
    bullets: [
      'Resident slot mapping with multiple vehicle license plate linking',
      'Temporary visitor parking pass issuance with expiry timers',
      'Real-time parking bay vacancy sensors & electronic LED displays',
      'Unauthorized parking clamp alerts sent directly to security guards',
    ],
  },
  amenities: {
    title: 'Clubhouse & Facility Hub',
    subtitle: 'Fair, transparent booking engine for sports courts & banquet halls.',
    desc: 'Eliminate booking clashes. Residents book clubhouse facilities with live slot availability, payment collection, and guest rules.',
    metrics: [{ k: 'Facilities', v: '24/7' }, { k: 'Booking Speed', v: '3 Taps' }, { k: 'Slot Clash', v: '0.0%' }],
    bullets: [
      'Live slot calendar for Tennis, Badminton, Swimming pool & Gym',
      'Banquet hall reservation with deposit holding & manual refunds',
      'Configurable quota rules per flat to ensure fair access for all',
      'Clubhouse smart door access control synced to active bookings',
    ],
  },
  comms: {
    title: 'Society Broadcast & Noticeboard',
    subtitle: 'Emergency broadcast alerts with verifiable read receipts.',
    desc: 'Reach every resident within 2 seconds. Replace outdated noticeboards with rich multimedia circulars sent directly to their phones.',
    metrics: [{ k: 'Delivery Speed', v: '< 800ms' }, { k: 'Read Rate', v: '94.2%' }, { k: 'Channels', v: 'App / WA' }],
    bullets: [
      'Critical emergency broadcasts with loud persistent audio alerts',
      'Tower-wise and block-wise targeted circular distribution',
      'Digital poll & voting module for AGM resolutions',
      'Read receipt telemetry showing exactly who viewed the notice',
    ],
  },
  emergency: {
    title: 'Emergency SOS Protocol',
    subtitle: 'Instant township safety dispatch and guard synchronization.',
    desc: 'One tap triggers gate sirens, guard walkie-talkie alerts, and exact flat location broadcast to first responders.',
    metrics: [{ k: 'Response Time', v: '< 45s' }, { k: 'Siren Sync', v: 'Instant' }, { k: 'Audit Trail', v: '100%' }],
    bullets: [
      'One-touch panic button in resident app and security booths',
      'Manual location pinpointing with flat number and tower name',
      'Direct integration with local police, ambulance & fire stations',
      'Live CCTV spotlight auto-switch to incident location',
    ],
  },
  reports: {
    title: 'Executive Analytics & MIS',
    subtitle: 'Data that drives smarter operational and financial decisions.',
    desc: 'Make data-backed decisions with live charts on gate traffic, financial collections, water consumption, and maintenance turnaround.',
    metrics: [{ k: 'Data Refresh', v: 'Real-Time' }, { k: 'Export Format', v: 'PDF / Excel' }, { k: 'Metrics Tracked', v: '60+' }],
    bullets: [
      'Live gate traffic heatmaps and peak arrival forecasts',
      'Maintenance SLA scorecard by technician and vendor',
      'Financial health overview with collection aging & defaulter lists',
      'Manual monthly executive summary report sent to committee',
    ],
  },
};

const CX = 270, CY = 270, R = 180;

export default function ProductEcosystem() {
  const [active, setActive] = useState<string>('security');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const { ref, visible } = useReveal();

  const activeNode = nodes.find((n) => n.id === active) || nodes[0];
  const activeDetail = details[activeNode.id];

  return (
    <section
      ref={ref}
      className="relative w-full pt-4 pb-12 sm:pt-6 sm:pb-16 bg-white overflow-hidden border-b border-slate-200/80"
      style={{
        backgroundImage:
          'radial-gradient(circle at 10% 20%, rgba(224, 242, 254, 0.45) 0%, transparent 45%), radial-gradient(circle at 90% 80%, rgba(240, 253, 244, 0.45) 0%, transparent 45%)',
      }}
    >
      {/* Background Geometric Grid matching RequestDemo */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#F1F5F9_1px,transparent_1px),linear-gradient(to_bottom,#F1F5F9_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-60 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">

        {/* ── HEADER STYLED EXACTLY TO MATCH THE APPROVED SYSTEM ── */}
        <div className={`text-center mb-10 sm:mb-12 reveal ${visible ? 'visible' : ''}`}>

          {/* Pill Badge with Pulsing Dot */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 mb-3.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span
              className="text-[11px] font-bold tracking-wider text-blue-900 uppercase"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Platform Architecture
            </span>
          </div>

          {/* High-Impact Headline with Gradient Text */}
          <h2
            className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-slate-950 tracking-tight leading-[1.14] mb-3"
            style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
          >
            One Connected Ecosystem for the{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-teal-600">
              Entire Community
            </span>
          </h2>

          {/* Subtitle */}
          <p
            className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Every gate barrier, resident service, financial ledger, and maintenance workflow connected in real time.
          </p>
        </div>

        {/* ── MAIN INTERACTIVE GRID: PROMINENT LARGE ORBITAL TOPOLOGY + SHOWCASE ── */}
        <div className={`reveal ${visible ? 'visible' : ''} grid lg:grid-cols-12 gap-8 lg:gap-12 items-center`}>

          {/* ── LEFT: LARGE PROMINENT ORBITAL TOPOLOGY (6 COLS) ── */}
          <div className="lg:col-span-6 w-full max-w-[540px] mx-auto flex flex-col items-center select-none">

            <div className="relative w-full aspect-square flex items-center justify-center">

              <svg viewBox="0 0 540 540" className="w-full h-full" style={{ overflow: 'visible' }}>
                <defs>
                  {/* Central Core Gradient */}
                  <radialGradient id="centerCoreGrad" cx="35%" cy="30%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="55%" stopColor="#1D4ED8" />
                    <stop offset="100%" stopColor="#0F286E" />
                  </radialGradient>

                  {/* Soft Drop Shadow for Hub */}
                  <filter id="hubElevation" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="#1D4ED8" floodOpacity="0.25" />
                  </filter>

                  {/* Soft Node Drop Shadow */}
                  <filter id="nodeElevation" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#0F172A" floodOpacity="0.14" />
                  </filter>
                </defs>

                {/* Concentric Orbital Track Rings */}
                <circle cx={CX} cy={CY} r={230} fill="none" stroke="#94A3B8" strokeWidth="1.2" strokeDasharray="5 7" opacity="0.45" />
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="#64748B" strokeWidth="1.5" opacity="0.45" />
                <circle cx={CX} cy={CY} r={120} fill="none" stroke="#94A3B8" strokeWidth="1.2" strokeDasharray="4 6" opacity="0.45" />

                {/* Dynamic Laser Beams Connecting Center Hub to Nodes */}
                {nodes.map((node) => {
                  const rad = (node.angle * Math.PI) / 180;
                  const nx = CX + R * Math.cos(rad);
                  const ny = CY + R * Math.sin(rad);
                  const isActive = active === node.id;
                  const isHovered = hoveredNode === node.id;

                  return (
                    <line
                      key={node.id}
                      x1={CX}
                      y1={CY}
                      x2={nx}
                      y2={ny}
                      stroke={isActive ? node.color : isHovered ? node.color : '#94A3B8'}
                      strokeWidth={isActive ? 3 : isHovered ? 2 : 1.5}
                      strokeDasharray={isActive ? 'none' : '4 5'}
                      opacity={isActive ? 1 : isHovered ? 0.9 : 0.45}
                      style={{ transition: 'all 0.25s ease' }}
                    />
                  );
                })}

                {/* Central GateSphere Core Disc */}
                <circle cx={CX} cy={CY} r={68} fill="url(#centerCoreGrad)" filter="url(#hubElevation)" />
                <circle cx={CX} cy={CY} r={68} fill="none" stroke="#FFFFFF" strokeWidth="3" />
                <circle cx={CX} cy={CY} r={58} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />

                {/* Center Image Logo (Only) */}
                <image 
                  href="/images/gatesphere-logo.webp" 
                  x={CX - 55} 
                  y={CY - 55} 
                  width="110" 
                  height="110" 
                />

                {/* 10 Satellite Nodes with Vector Icons and Text Labels */}
                {nodes.map((node) => {
                  const rad = (node.angle * Math.PI) / 180;
                  const nx = CX + R * Math.cos(rad);
                  const ny = CY + R * Math.sin(rad);
                  const isActive = active === node.id;
                  const isHovered = hoveredNode === node.id;
                  const radius = isActive ? 24 : 20;

                  // Smart label positioning based on angle
                  const cosVal = Math.cos(rad);

                  let lx = nx;
                  let ly = ny;
                  let anchor: 'start' | 'end' | 'middle' = 'middle';

                  if (node.angle === 270) {
                    // Top (Security)
                    lx = nx;
                    ly = ny - radius - 10;
                    anchor = 'middle';
                  } else if (node.angle === 90) {
                    // Bottom (Parking)
                    lx = nx;
                    ly = ny + radius + 18;
                    anchor = 'middle';
                  } else if (cosVal > 0) {
                    // Right hemisphere
                    lx = nx + radius + 10;
                    ly = ny + 4;
                    anchor = 'start';
                  } else {
                    // Left hemisphere
                    lx = nx - radius - 10;
                    ly = ny + 4;
                    anchor = 'end';
                  }

                  return (
                    <g
                      key={node.id}
                      className="cursor-pointer group"
                      onClick={() => setActive(node.id)}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      {/* Active Pulsing Halo Ring */}
                      {isActive && (
                        <circle
                          cx={nx}
                          cy={ny}
                          r={34}
                          fill="none"
                          stroke={node.color}
                          strokeWidth="2.5"
                          opacity="0.5"
                          className="animate-pulse"
                        />
                      )}

                      {/* Node Button Disc */}
                      <circle
                        cx={nx}
                        cy={ny}
                        r={radius}
                        fill={isActive ? node.color : '#FFFFFF'}
                        stroke={isActive ? '#FFFFFF' : isHovered ? node.color : node.color}
                        strokeWidth={isActive ? 2.5 : 2}
                        filter="url(#nodeElevation)"
                        style={{ transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />

                      {/* Bespoke Vector Icon */}
                      <g transform={`translate(${nx - 10.5}, ${ny - 10.5}) scale(0.88)`}>
                        {renderSvgIcon(node.id, node.color, isActive)}
                      </g>

                      {/* Clear Label Text */}
                      <text
                        x={lx}
                        y={ly}
                        textAnchor={anchor}
                        fill={isActive ? node.color : isHovered ? '#0F172A' : '#475569'}
                        fontSize="11.5"
                        fontWeight={isActive ? '800' : '600'}
                        fontFamily="'Plus Jakarta Sans', Inter, sans-serif"
                        letterSpacing="0.01em"
                        style={{
                          transition: 'all 0.2s ease',
                          filter: isActive ? `drop-shadow(0 1px 2px rgba(0,0,0,0.08))` : undefined,
                        }}
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="text-xs text-slate-500 mt-4 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              Click any node in the circular diagram to inspect module capabilities
            </div>
          </div>

          {/* ── RIGHT: SHOWCASE CARD (6 COLS) ── */}
          <div className="lg:col-span-6 w-full">
            <div className="rounded-3xl bg-white border border-slate-200 shadow-[0_20px_50px_rgba(15,23,42,0.08)] overflow-hidden transition-all">

              {/* Header */}
              <div
                className="px-6 sm:px-8 py-5.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 transition-colors"
                style={{ background: activeNode.lightBg }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-13 h-13 rounded-2xl flex items-center justify-center text-white shadow-xs p-2.5"
                    style={{ background: activeNode.color }}
                  >
                    <svg viewBox="0 0 24 24" className="w-7 h-7">
                      {renderSvgIcon(activeNode.id, '#FFFFFF', true)}
                    </svg>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                      {activeNode.category} Module
                    </span>
                    <h3
                      className="text-xl sm:text-2xl font-bold text-slate-900"
                      style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
                    >
                      {activeDetail.title}
                    </h3>
                  </div>
                </div>

                {/* Performance Benchmarks */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {activeDetail.metrics.map((m, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 text-center shadow-2xs"
                    >
                      <div className="text-[10px] text-slate-500 font-medium">{m.k}</div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
                        {m.v}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-800 mb-1.5">
                    {activeDetail.subtitle}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-light">
                    {activeDetail.desc}
                  </p>
                </div>

                {/* 4 Feature Cards */}
                <div className="grid sm:grid-cols-2 gap-3.5">
                  {activeDetail.bullets.map((b, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/90 border border-slate-100 hover:border-slate-200 transition-colors"
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 text-white text-[11px] font-bold shadow-2xs"
                        style={{ background: activeNode.color }}
                      >
                        ✓
                      </div>
                      <span className="text-xs sm:text-[13px] text-slate-700 font-medium leading-snug">
                        {b}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Live Status & CTA Button matching RequestDemo */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-5 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  </div>

                  <a
                    href="#demo"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-white transition-all transform hover:-translate-y-0.5 shadow-md shadow-blue-500/20 cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)',
                    }}
                  >
                    <span>Get in Contact</span>
                    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                      <path
                        d="M3 8h10M9 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </a>
                </div>

              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
