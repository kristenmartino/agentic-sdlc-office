"use client";

import { useOfficeStore } from "@/state/officeStore";
import { SCENARIOS } from "@/data/scenarios";

export default function ActivityLog() {
  const log = useOfficeStore((s) => s.log);
  const cursor = useOfficeStore((s) => s.cursor);
  const scenarioId = useOfficeStore((s) => s.scenarioId);
  const seekTo = useOfficeStore((s) => s.seekTo);

  const totalEvents = SCENARIOS[scenarioId].events.length;
  const recent = [...log].reverse().slice(0, 25);

  return (
    <section className="rounded-lg border border-office-line bg-office-panel/80 p-3" aria-label="Activity log">
      <header className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide">Activity Log</h2>
        <span className="text-[10px] text-office-muted font-mono">
          {cursor} / {totalEvents}
        </span>
      </header>
      {recent.length === 0 ? (
        <p className="text-xs text-office-muted">Start the demo to see events.</p>
      ) : (
        <ul className="flex flex-col gap-1 max-h-[280px] overflow-y-auto pr-1">
          {recent.map((e) => {
            // Find this event's index in the canonical log (0-based).
            const logIndex = log.indexOf(e);
            const isCurrentTail = logIndex === log.length - 1;
            return (
              <li key={e.id}>
                <button
                  onClick={() => seekTo(logIndex + 1)}
                  title="Replay from this event"
                  className={`w-full text-left px-1 py-0.5 rounded text-[10px] font-mono leading-snug flex gap-2 hover:bg-white/5 transition ${
                    isCurrentTail ? "bg-white/[0.03]" : ""
                  }`}
                >
                  <span className="text-office-muted shrink-0">{e.id.slice(-4)}</span>
                  <span className="text-office-text shrink-0">{e.type}</span>
                  <span className="text-office-muted truncate">
                    · {e.actor} → {e.subject}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {log.length > 0 && (
        <p className="mt-2 text-[9px] text-office-muted/60">
          Tip: click any event to replay from that point. State persists across refreshes.
        </p>
      )}
    </section>
  );
}
