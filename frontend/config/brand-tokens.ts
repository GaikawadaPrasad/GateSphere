/**
 * GateSphere Brand Design System Tokens
 * Source: Visual Language & UI Specification (Brand Design System)
 */

export const BRAND_COLORS = {
  // Brand Colors
  trustBlue: "#1D4ED8", // Primary brand, CTAs, links
  freshTeal: "#0D9488", // Secondary brand, gradient pair
  deepCharcoal: "#0F172A", // Page headings, primary text
  bodySlate: "#64748B", // Body copy, descriptions
  warmOffWhite: "#FAF9F7", // Page background

  // Module / Accent Colors
  modules: {
    security: "#1D4ED8",
    residents: "#0D9488",
    visitors: "#7C3AED",
    maintenance: "#16A34A",
    payments: "#D97706",
    parking: "#0891B2",
    amenities: "#9333EA",
    communication: "#EA580C",
    emergency: "#DC2626",
    reports: "#475569",
  },

  // Surface & Border
  surfaces: {
    cardBg: "#FFFFFF",
    border: "#E2E8F0",
    lightBorder: "#F1F5F9",
    mutedText: "#94A3B8",
    cardHover: "#F8FAFC",
  },

  // Status Colors
  status: {
    success: "#16A34A",
    successBg: "#F0FDF4",
    successBorder: "#BBF7D0",
    warning: "#D97706",
    warningBg: "#FFFBEB",
    warningBorder: "#FDE68A",
    danger: "#DC2626",
    dangerBg: "#FEF2F2",
    dangerBorder: "#FECACA",
    info: "#1D4ED8",
    infoBg: "#EFF6FF",
    infoBorder: "#BFDBFE",
  },
} as const;

export const BrandTokens = {
  colors: {
    primary: BRAND_COLORS.trustBlue,
    secondary: BRAND_COLORS.freshTeal,
    darkText: BRAND_COLORS.deepCharcoal,
    slateText: BRAND_COLORS.bodySlate,
    background: BRAND_COLORS.warmOffWhite,
    modules: BRAND_COLORS.modules,
  },
  typography: {
    weights: {
      hero: 900,
      eyebrow: 700,
    },
    eyebrow: {
      textTransform: "uppercase",
    },
  },
};

export function getModuleAccent(module: keyof typeof BRAND_COLORS.modules): string {
  return BRAND_COLORS.modules[module] || BRAND_COLORS.trustBlue;
}

export const TYPOGRAPHY = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  heroH1: { size: "56px", weight: 900, letterSpacing: "-0.03em" },
  sectionH2: { size: "48px", weight: 900, letterSpacing: "-0.025em" },
  cardH3: { size: "22px", weight: 900, letterSpacing: "-0.02em" },
  eyebrow: { size: "12px", weight: 700, textTransform: "uppercase", letterSpacing: "0.1em" },
  body: { size: "16px", weight: 400, lineHeight: 1.6 },
  cardBody: { size: "14px", weight: 400, lineHeight: 1.5 },
  statNumber: { size: "56px", weight: 900 },
  button: { size: "15px", weight: 600 },
  tag: { size: "13px", weight: 600 },
  caption: { size: "11px", weight: 500 },
} as const;

export const SHADOWS = {
  standardCard: "0 8px 24px rgba(0, 0, 0, 0.08)",
  elevatedCard: "0 16px 48px rgba(0, 0, 0, 0.09)",
  primaryCtaGlow: "0 4px 20px rgba(29, 78, 216, 0.3)",
} as const;
