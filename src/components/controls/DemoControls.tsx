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

  // Drive the demo
  useEffect(() => {
    if (runState !== "running") return;
    const id = setInterval(() => tick(), TICK_MS);
    return () => clearInterval(id);
  }, [runState, tick]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={start}
        disabled={runState === "running"}
        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm font-medium"
      >
        Start Demo
      </button>
      <button
        onClick={pause}
        disabled={runState !== "running"}
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
      <span className="ml-2 text-[10px] font-mono text-office-muted uppercase tracking-wide">{runState}</span>
    </div>
  );
}
