import React from "react";

interface LiveDotProps {
  label?: string;
  className?: string;
}

export function LiveDot({ label = "LIVE", className = "" }: LiveDotProps) {
  return (
    <span className={`live-badge ${className}`}>
      <span className="pulse-dot" />
      <span>{label}</span>
    </span>
  );
}
