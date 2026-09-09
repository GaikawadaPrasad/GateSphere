import React from "react";
import Image from "next/image";

interface GateSphereLogoProps {
  className?: string;
  variant?: "default" | "light" | "dark" | "compact";
  showText?: boolean;
  size?: "normal" | "large";
}

export default function GateSphereLogo({
  className = "",
  variant = "default",
  showText = true,
  size = "large",
}: GateSphereLogoProps) {
  const logoPath = "/images/gatesphere-logo.webp";

  const isLarge = size === "large";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src={logoPath}
        alt="GateSphere"
        width={isLarge ? 56 : 40}
        height={isLarge ? 56 : 40}
        priority
        className={`${
          isLarge
            ? "h-12 md:h-14 w-auto object-contain drop-shadow-xl transition-all duration-300"
            : "h-8 md:h-10 w-auto object-contain drop-shadow-lg transition-all duration-300"
        }`}
      />
      {variant !== "compact" && (
        <span
          className={`${isLarge ? "font-extrabold" : "font-bold"} tracking-tight transition-all duration-300 ease-in-out overflow-hidden ${
            showText ? "max-w-[200px] opacity-100 text-2xl md:text-3xl" : "max-w-0 opacity-0 text-[0px]"
          } ${variant === "light" ? "text-white" : "text-slate-900"}`}
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          GateSphere
        </span>
      )}
    </div>
  );
}
