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
    <div className={`flex items-center gap-1 sm:gap-1.5 ${className}`}>
      <Image
        src={logoPath}
        alt="GateSphere"
        width={isLarge ? 56 : 48}
        height={isLarge ? 56 : 48}
        style={{ width: "auto", height: "auto" }}
        priority
        className={`${
          isLarge
            ? "h-8.5 sm:h-12 md:h-14 w-auto object-contain drop-shadow-xl transition-all duration-300 -ml-0.5 sm:-ml-1 -mr-1 sm:-mr-1.5"
            : "h-[21px] sm:h-[25px] md:h-[26px] w-auto object-contain drop-shadow-lg transition-all duration-300 -ml-0.5 sm:-ml-1 -mr-0.5 sm:-mr-1"
        } ${
          variant === "light"
            ? "brightness-115 contrast-110 drop-shadow-[0_0_10px_rgba(56,189,248,0.65)] drop-shadow-[0_0_2px_rgba(255,255,255,0.7)]"
            : ""
        }`}
      />
      {variant !== "compact" && (
        <span
          className={`font-extrabold leading-none tracking-[0.01em] whitespace-nowrap transition-all duration-300 ease-in-out ${
            isLarge
              ? "text-base sm:font-extrabold sm:text-2xl md:text-3xl"
              : "text-[15.5px] sm:text-[19px] md:text-[20px]"
          } ${
            showText ? "opacity-100" : "opacity-0 w-0"
          } ${variant === "light" ? "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]" : "text-slate-900"}`}
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          GateSphere
        </span>
      )}
    </div>
  );
}
