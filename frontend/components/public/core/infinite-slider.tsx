import React, { ReactNode } from "react";

export interface InfiniteSliderProps {
  children: ReactNode;
  direction?: "horizontal" | "vertical";
  reverse?: boolean;
  duration?: number;
  gap?: number;
  className?: string;
}

export function InfiniteSlider({
  children,
  direction = "horizontal",
  reverse = false,
  duration = 25,
  gap = 16,
  className = "",
}: InfiniteSliderProps) {
  const isVertical = direction === "vertical";

  const animationName = isVertical
    ? reverse
      ? "infinite-slider-vertical-reverse"
      : "infinite-slider-vertical"
    : reverse
    ? "infinite-slider-horizontal-reverse"
    : "infinite-slider-horizontal";

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        maskImage: isVertical
          ? "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)"
          : "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
        WebkitMaskImage: isVertical
          ? "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)"
          : "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
      }}
    >
      <div
        className={`flex ${isVertical ? "flex-col" : "flex-row"} w-full h-max hover:[animation-play-state:paused]`}
        style={
          {
            gap: `${gap}px`,
            animation: `${animationName} ${duration}s linear infinite`,
            willChange: "transform",
            "--slider-gap": `${gap}px`,
          } as React.CSSProperties
        }
      >
        {/* First track */}
        <div
          className={`flex ${isVertical ? "flex-col" : "flex-row"} shrink-0`}
          style={{ gap: `${gap}px` }}
        >
          {children}
        </div>
        {/* Duplicate track for seamless infinite looping */}
        <div
          aria-hidden="true"
          className={`flex ${isVertical ? "flex-col" : "flex-row"} shrink-0`}
          style={{ gap: `${gap}px` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default InfiniteSlider;
