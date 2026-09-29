"use client";

import { BorderBeamPanel } from "./border-beam-panel";

export default function BorderBeamPanelDemo() {
  return (
    <div className="flex w-full items-center justify-center p-10">
      <BorderBeamPanel className="w-full max-w-md" beams={2} thickness={2} radius={18} glow>
        <div className="flex flex-col gap-4 p-7">
          <span className="w-fit rounded-full border border-[var(--motiq-border)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--motiq-muted)]">
            Pro
          </span>
          <h3 className="text-2xl font-semibold tracking-tight text-[var(--motiq-fg)]">
            Border Beam Panel
          </h3>
          <p className="text-sm text-[var(--motiq-fg-secondary)]">
            A light that travels the border on a conic gradient — it speeds up on
            hover and eases back when you leave.
          </p>
          <button
            type="button"
            className="mt-1 w-fit rounded-lg bg-[var(--motiq-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Get started
          </button>
        </div>
      </BorderBeamPanel>
    </div>
  );
}
