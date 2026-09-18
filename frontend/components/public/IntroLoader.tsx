"use client";

import { useEffect } from "react";

export default function IntroLoader({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    if (onReady) onReady();
  }, [onReady]);

  return null;
}
