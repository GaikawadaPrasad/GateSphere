import React from 'react';

interface StatPill {
  label: string;
  value: string;
  icon?: string;
}

interface PageHeroHeaderProps {
  badge: string;
  badgeColor?: 'blue' | 'sky' | 'emerald' | 'indigo' | 'amber' | 'rose';
  titleLead: string;
  titleHighlight: string;
  subtitle: string;
  breadcrumbs?: { label: string; href?: string }[];
  stats?: StatPill[];
  quickLinks?: { label: string; href: string }[];
}

export default function PageHeroHeader({
  badge,
  badgeColor = 'blue',
  titleLead,
  titleHighlight,
  subtitle,
  stats = [],
  quickLinks = [],
}: PageHeroHeaderProps) {
  const colorMap = {
    blue: {
      badgeBg: 'bg-blue-500/10',
      badgeText: 'text-blue-400',
      badgeBorder: 'border-blue-500/25',
      glow: 'rgba(29, 78, 216, 0.22)',
      gradient: 'from-blue-400 via-sky-300 to-cyan-300',
      pillBg: 'hover:bg-blue-500/10 hover:border-blue-400/30 text-blue-300',
    },
    sky: {
      badgeBg: 'bg-sky-500/10',
      badgeText: 'text-sky-400',
      badgeBorder: 'border-sky-500/25',
      glow: 'rgba(14, 165, 233, 0.22)',
      gradient: 'from-sky-400 via-cyan-300 to-teal-300',
      pillBg: 'hover:bg-sky-500/10 hover:border-sky-400/30 text-sky-300',
    },
    emerald: {
      badgeBg: 'bg-emerald-500/10',
      badgeText: 'text-emerald-400',
      badgeBorder: 'border-emerald-500/25',
      glow: 'rgba(16, 185, 129, 0.22)',
      gradient: 'from-emerald-400 via-teal-300 to-cyan-300',
      pillBg: 'hover:bg-emerald-500/10 hover:border-emerald-400/30 text-emerald-300',
    },
    indigo: {
      badgeBg: 'bg-indigo-500/10',
      badgeText: 'text-indigo-400',
      badgeBorder: 'border-indigo-500/25',
      glow: 'rgba(99, 102, 241, 0.22)',
      gradient: 'from-indigo-400 via-purple-300 to-sky-300',
      pillBg: 'hover:bg-indigo-500/10 hover:border-indigo-400/30 text-indigo-300',
    },
    amber: {
      badgeBg: 'bg-amber-500/10',
      badgeText: 'text-amber-400',
      badgeBorder: 'border-amber-500/25',
      glow: 'rgba(245, 158, 11, 0.22)',
      gradient: 'from-amber-400 via-orange-300 to-yellow-200',
      pillBg: 'hover:bg-amber-500/10 hover:border-amber-400/30 text-amber-300',
    },
    rose: {
      badgeBg: 'bg-rose-500/10',
      badgeText: 'text-rose-400',
      badgeBorder: 'border-rose-500/25',
      glow: 'rgba(244, 63, 94, 0.22)',
      gradient: 'from-rose-400 via-pink-300 to-amber-200',
      pillBg: 'hover:bg-rose-500/10 hover:border-rose-400/30 text-rose-300',
    },
  };

  const scheme = colorMap[badgeColor] || colorMap.blue;

  return (
    <section className="relative w-full overflow-hidden bg-[#070C18] text-white pt-24 pb-16 sm:pb-20 border-b border-slate-800/80">
      {/* ── ATMOSPHERIC AURORA GLOWS & GRID ── */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] rounded-full blur-[120px] pointer-events-none opacity-60"
        style={{
          background: `radial-gradient(ellipse at center, ${scheme.glow} 0%, rgba(15, 23, 42, 0) 70%)`,
        }}
      />
      <div
        className="absolute top-0 right-1/4 w-[400px] h-[250px] rounded-full blur-[100px] pointer-events-none opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(56, 189, 248, 0.25) 0%, rgba(0,0,0,0) 70%)',
        }}
      />

      {/* Subtle Tech Lattice Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8">
        
        {/* ── LIVE STATUS PILL (CENTERED) ── */}
        <div className="flex items-center justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 backdrop-blur-md text-[11px] text-slate-300 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
            <span className="font-mono tracking-tight text-slate-300">GateSphere OS v2.4 • Active</span>
          </div>
        </div>

        {/* ── MAIN HERO COPY WITH DUAL-TONE GRADIENT ── */}
        <div className="max-w-4xl mx-auto text-center space-y-6">
          
          {/* Category Badge */}
          <div className="inline-flex items-center gap-2">
            <span
              className={`px-3.5 py-1.2 rounded-full text-[11.5px] font-bold tracking-widest uppercase border backdrop-blur-md shadow-xs ${scheme.badgeBg} ${scheme.badgeText} ${scheme.badgeBorder}`}
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              {badge}
            </span>
          </div>

          {/* Title */}
          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-extrabold tracking-tight text-white leading-[1.12]"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            {titleLead}{' '}
            <span className={`text-transparent bg-clip-text bg-gradient-to-r ${scheme.gradient}`}>
              {titleHighlight}
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed font-light"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {subtitle}
          </p>

          {/* ── QUICK SECTION PILLS / BUTTONS (IF PROVIDED) ── */}
          {quickLinks.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {quickLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className={`px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-slate-300 transition-all cursor-pointer backdrop-blur-sm ${scheme.pillBg}`}
                >
                  {link.label} ↓
                </a>
              ))}
            </div>
          )}
        </div>

        {/* ── STATS / CAPABILITY STRIP (IF PROVIDED) ── */}
        {stats.length > 0 && (
          <div className="mt-12 pt-8 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {stats.map((st) => (
              <div
                key={st.label}
                className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] backdrop-blur-xs text-center group hover:border-white/20 transition-all"
              >
                <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight flex items-center justify-center gap-1.5">
                  {st.icon && <span className="text-base">{st.icon}</span>}
                  <span className={`text-transparent bg-clip-text bg-gradient-to-r ${scheme.gradient}`}>
                    {st.value}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-medium tracking-wide">
                  {st.label}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
