"use client";

import { useEffect, useState } from "react";
import { AnimatedCircularProgressBar } from "./animated-circular-progress-bar";

export default function AnimatedCircularProgressBarDemo() {
  const [value, setValue] = useState(13);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setValue((prev) => (prev >= 100 ? 0 : prev + 13));
    }, 2000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-[240px] w-full items-center justify-center bg-[#0C0C0E]">
      <AnimatedCircularProgressBar
        max={100}
        min={0}
        value={value}
        gaugePrimaryColor="#FF2B2B"
        gaugeSecondaryColor="rgba(255, 255, 255, 0.15)"
      />
    </div>
  );
}
