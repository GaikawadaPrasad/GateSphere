"use client";

import React, { useEffect, useState } from "react";

interface QrCodeSvgProps {
  value: string;
  size?: number;
  className?: string;
  darkColor?: string;
  lightColor?: string;
}

/**
 * Standards-compliant QR Code component using the `qrcode` npm package.
 * Renders a real ISO/IEC 18004 QR code that can be scanned by any camera.
 *
 * Uses dynamic import so the module is only loaded client-side (no SSR needed
 * for QR codes — they are always inside a modal that is client-rendered).
 */
export function QrCodeSvg({
  value,
  size = 160,
  className = "",
  darkColor = "#0F172A",
  lightColor = "#FFFFFF",
}: QrCodeSvgProps) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!value) return;

    let cancelled = false;
    (async () => {
      try {
        // Dynamic import keeps qrcode out of the SSR bundle
        const QRCode = (await import("qrcode")).default;
        const svg: string = await QRCode.toString(value, {
          type: "svg",
          width: size,
          errorCorrectionLevel: "M",
          margin: 1,
          color: {
            dark: darkColor,
            light: lightColor,
          },
        });
        if (!cancelled) setSvgContent(svg);
      } catch (e) {
        console.error("[QrCodeSvg] Failed to generate QR code:", e);
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value, darkColor, lightColor]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-red-50 border border-red-200 rounded-xl ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-red-400 font-mono text-center px-2">
          QR generation failed
        </span>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-slate-400 font-mono">Generating QR…</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center p-2 bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
