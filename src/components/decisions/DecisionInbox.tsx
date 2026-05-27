"use client";

import { useOfficeStore } from "@/state/officeStore";

export default function DecisionInbox() {
  const decisions = useOfficeStore((s) => s.decisions);
  const resolveDecision = useOfficeStore((s) => s.resolveDecision);
  const resolveApproval = useOfficeStore((s) => s.resolveApproval);

  const open = decisions.filter((d) => !d.resolved);

  return (
    <section className="rounded-lg border border-office-line bg-office-panel/80 p-3" aria-label="Decision inbox">
      <header className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide">Decision Inbox</h2>
        <span className="text-[10px] text-office-muted">{open.length} open</span>
      </header>
      {open.length === 0 && (
        <p className="text-xs text-office-muted">No decisions waiting.</p>
      )}
      <ul className="flex flex-col gap-3">
        {open.map((d) => {
          const isApproval = d.id.startsWith("apr_");
          return (
            <li key={d.id} className={`rounded border bg-office-bg/60 p-2.5 ${isApproval ? "border-red-500/30" : "border-office-line"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium leading-snug">{d.question}</p>
                <span className={`shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded ${
                  isApproval ? "bg-red-500/20 text-red-300" : "bg-office-line text-office-muted"
                }`}>
                  {isApproval ? "P7 · sim" : `by ${d.raisedBy}`}
                </span>
              </div>
              {isApproval && (
                <p className="mt-1 text-[10px] text-red-300/80 leading-snug font-medium">
                  Simulated P7 approval — no real merge or deploy is performed.
                </p>
              )}
              {d.context && <p className="mt-1 text-[10px] text-office-muted leading-snug">{d.context}</p>}
              <div className="mt-2 flex flex-col gap-1.5">
                {d.options.map((opt) => (
                  <button
                    key={opt.id}
                    className={`group text-left px-2 py-1.5 rounded border border-office-line hover:border-white/30 hover:bg-white/5 transition ${
                      d.recommendation === opt.id ? "border-cora/50" : ""
                    }`}
                    onClick={() =>
                      isApproval
                        ? resolveApproval(d.id, opt.id === "approve")
                        : resolveDecision(d.id, opt.id)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">{opt.label}</span>
                      {d.recommendation === opt.id && (
                        <span className="text-[9px] text-cora font-mono">recommended</span>
                      )}
                    </div>
                    {(opt.pros.length > 0 || opt.cons.length > 0) && (
                      <div className="mt-1 grid grid-cols-2 gap-2 text-[10px] text-office-muted">
                        <div>
                          {opt.pros.map((p) => (
                            <div key={p}>+ {p}</div>
                          ))}
                        </div>
                        <div>
                          {opt.cons.map((c) => (
                            <div key={c}>− {c}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
