"use client";

import { useOfficeStore } from "@/state/officeStore";

export default function ActivityLog() {
  const log = useOfficeStore((s) => s.log);
  const recent = [...log].reverse().slice(0, 25);

  return (
    <section className="rounded-lg border border-office-line bg-office-panel/80 p-3" aria-label="Activity log">
      <header className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide">Activity Log</h2>
        <span className="text-[10px] text-office-muted">{log.length} events</span>
      </header>
      {recent.length === 0 ? (
        <p className="text-xs text-office-muted">Start the demo to see events.</p>
      ) : (
        <ul className="flex flex-col gap-1 max-h-[280px] overflow-y-auto pr-1">
          {recent.map((e) => (
            <li key={e.id} className="text-[10px] font-mono leading-snug flex gap-2">
              <span className="text-office-muted shrink-0">{e.id}</span>
              <span className="text-office-text">{e.type}</span>
              <span className="text-office-muted truncate">· {e.actor} → {e.subject}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
