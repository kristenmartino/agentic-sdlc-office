"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useOfficeStore } from "@/state/officeStore";

export default function WorkItemDrawer() {
  const open = useOfficeStore((s) => s.workItemDrawerOpen);
  const close = useOfficeStore((s) => s.closeWorkItemDrawer);
  const workItem = useOfficeStore((s) => s.workItem);
  const artifacts = useOfficeStore((s) => s.artifacts);
  const blockers = useOfficeStore((s) => s.blockers);
  const decisions = useOfficeStore((s) => s.decisions);
  const gates = useOfficeStore((s) => s.qualityGates);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: "tween", duration: 0.18 }}
          className="fixed right-4 top-4 bottom-4 w-96 rounded-lg border border-office-line bg-office-panel/95 backdrop-blur p-4 z-10 overflow-y-auto"
          role="dialog"
          aria-label="Work item details"
        >
          <header className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{workItem.title}</h3>
              <p className="text-[10px] text-office-muted font-mono mt-0.5">{workItem.id} · {workItem.kind}</p>
            </div>
            <button onClick={close} className="text-office-muted hover:text-office-text text-sm" aria-label="Close drawer">
              ×
            </button>
          </header>

          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[11px]">
            <dt className="text-office-muted">Status</dt>
            <dd className="font-mono">{workItem.status}</dd>
            <dt className="text-office-muted">Mode</dt>
            <dd className="font-mono">{workItem.currentMode}</dd>
            <dt className="text-office-muted">Phase</dt>
            <dd>{workItem.currentPhase}</dd>
            <dt className="text-office-muted">Owner</dt>
            <dd className="font-mono">{workItem.ownerAgentId ?? "—"}</dd>
            <dt className="text-office-muted">Next</dt>
            <dd className="font-mono">{workItem.nextAgentId ?? "—"}</dd>
          </dl>

          {workItem.acceptance.length > 0 && (
            <Section title="Acceptance criteria">
              <ul className="text-xs space-y-1">
                {workItem.acceptance.map((a, i) => <li key={i}>• {a}</li>)}
              </ul>
            </Section>
          )}

          {artifacts.length > 0 && (
            <Section title="Artifacts">
              <ul className="space-y-1.5">
                {artifacts.map((a) => (
                  <li key={a.id} className="text-[11px]">
                    <span className="font-mono text-office-muted">{a.kind}</span> · by {a.producedBy}
                    <div className="text-office-muted">{a.summary}</div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {gates.length > 0 && (
            <Section title="Quality gates">
              <ul className="space-y-1">
                {gates.map((g) => (
                  <li key={g.id} className="text-[11px] flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${g.status === "passed" ? "bg-emerald-400" : "bg-red-400"}`} />
                    <span className="font-mono">{g.name}</span>
                    <span className="text-office-muted">— {g.owner}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {blockers.length > 0 && (
            <Section title="Blockers">
              <ul className="space-y-1.5">
                {blockers.map((b) => (
                  <li key={b.id} className="text-[11px]">
                    <span className="font-mono text-office-muted">{b.kind}</span> — {b.description}
                    {b.resolvedAt && <div className="text-emerald-400">Cleared: {b.resolution}</div>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {decisions.length > 0 && (
            <Section title="Decisions">
              <ul className="space-y-1.5">
                {decisions.map((d) => (
                  <li key={d.id} className="text-[11px]">
                    {d.question}
                    {d.resolved && d.chosenOptionId && (
                      <div className="text-emerald-400">Chose: {d.chosenOptionId}</div>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] text-office-muted uppercase tracking-wide mb-1">{title}</p>
      {children}
    </div>
  );
}
