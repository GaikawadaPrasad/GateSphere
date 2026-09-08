import React from "react";

interface EyebrowProps {
  children: React.ReactNode;
  accentColor?: string;
  className?: string;
}

export function Eyebrow({ children, accentColor = "#2563EB", className = "" }: EyebrowProps) {
  return (
    <span
      className={`eyebrow-label ${className}`}
      style={{
        background: `${accentColor}10`,
        borderColor: `${accentColor}35`,
        color: accentColor,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: accentColor,
          display: "inline-block",
        }}
      />
      {children}
    </span>
  );
}
