"use client";

import { useEffect } from "react";
import { useOfficeStore } from "@/state/officeStore";

const TICK_MS = 1400;

export default function DemoControls() {
  const runState = useOfficeStore((s) => s.runState);
  const start = useOfficeStore((s) => s.start);
  const pause = useOfficeStore((s) => s.pause);
  const reset = useOfficeStore((s) => s.reset);
  const tick = useOfficeStore((s) => s.tick);

  // Drive the demo — only ticks when actually running, not when paused or awaiting human input.
  useEffect(() => {
    if (runState !== "running") return;
    const id = setInterval(() => tick(), TICK_MS);
    return () => clearInterval(id);
  }, [runState, tick]);

  const awaiting = runState === "awaiting_human";
  const running = runState === "running";

  const stateLabel = awaiting ? "awaiting human" : runState;
  const stateClass = awaiting
    ? "text-amber-300 animate-pulse-soft"
    : running
    ? "text-emerald-300"
    : "text-office-muted";

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={start}
        disabled={running || awaiting}
        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
        title={awaiting ? "Resolve the open decision/approval to continue" : undefined}
      >
        Start Demo
      </button>
      <button
        onClick={pause}
        disabled={!running}
        className="px-3 py-1.5 rounded bg-office-line hover:bg-office-line/70 disabled:opacity-40 text-sm"
      >
        Pause
      </button>
      <button
        onClick={reset}
        className="px-3 py-1.5 rounded bg-office-line hover:bg-office-line/70 text-sm"
      >
        Reset
      </button>
      <span className={`ml-2 text-[10px] font-mono uppercase tracking-wide ${stateClass}`}>{stateLabel}</span>
    </div>
  );
}
