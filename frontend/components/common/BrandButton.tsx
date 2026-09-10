import React from "react";
import { cn } from "@/lib/utils";

interface BrandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export function BrandButton({
  children,
  variant = "primary",
  size = "md",
  icon,
  isLoading,
  disabled,
  className = "",
  ...props
}: BrandButtonProps) {
  let variantClass = "btn-primary-glow";
  if (variant === "outline") variantClass = "btn-outline";
  if (variant === "danger") variantClass = "btn-danger";
  if (variant === "ghost") variantClass = "btn-ghost";

  const sizeStyles = {
    sm: { padding: "0.4rem 0.75rem", fontSize: "13px" },
    md: { padding: "0.6rem 1.25rem", fontSize: "15px" },
    lg: { padding: "0.85rem 1.75rem", fontSize: "16px" },
  }[size];

  return (
    <button
      className={cn("btn", variantClass, className)}
      disabled={disabled || isLoading}
      style={sizeStyles}
      {...props}
    >
      {isLoading ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <span className="spin-animation">⏳</span>
          <span>Loading…</span>
        </span>
      ) : (
        <>
          {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
