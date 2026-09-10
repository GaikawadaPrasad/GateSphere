import React from "react";

export default function Hero() {
  return (
    <section className="relative w-full sm:mt-0 aspect-video sm:aspect-auto sm:h-screen sm:min-h-[600px] max-h-[1080px] overflow-hidden bg-black">
      {/* ── CINEMATIC FULL-SCREEN VIDEO ── */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover object-center"
      >
        <source src="/hero-video.mp4" type="video/mp4" />
      </video>
    </section>
  );
}
