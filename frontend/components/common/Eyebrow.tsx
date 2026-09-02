import React from "react";

interface EyebrowProps {
  children: React.ReactNode;
  accentColor?: string;
  className?: string;
}

export function Eyebrow({ children, accentColor, className = "" }: EyebrowProps) {
  return (
    <span
      className={`eyebrow-label ${className}`}
      style={{
        borderColor: accentColor ? `${accentColor}40` : undefined,
        color: accentColor || undefined,
      }}
    >
      {children}
    </span>
  );
}
