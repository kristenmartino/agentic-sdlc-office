"use client";

import { useOfficeStore } from "@/state/officeStore";
import Office from "@/components/office/Office";
import DemoControls from "@/components/controls/DemoControls";
import DecisionInbox from "@/components/decisions/DecisionInbox";
import ActivityLog from "@/components/activity/ActivityLog";
import AgentDrawer from "@/components/drawers/AgentDrawer";
import WorkItemDrawer from "@/components/drawers/WorkItemDrawer";

export default function Page() {
  const workItem = useOfficeStore((s) => s.workItem);
  const openWi = useOfficeStore((s) => s.openWorkItemDrawer);
  const decisions = useOfficeStore((s) => s.decisions);
  const openDecisions = decisions.filter((d) => !d.resolved).length;

  return (
    <main className="min-h-screen p-6 max-w-[1280px] mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-cora/30 to-iris/20 border border-office-line flex items-center justify-center">
            <span className="text-sm font-bold text-cora">A</span>
          </div>
          <div>
            <h1 className="text-base font-semibold leading-none">Agentic SDLC Office</h1>
            <p className="text-[11px] text-office-muted mt-0.5">
              v0.1 — Mock Visual Workflow Prototype
            </p>
          </div>
        </div>
        <DemoControls />
      </header>

      <div className="grid grid-cols-[1fr_320px] gap-4">
        <div className="flex flex-col gap-4">
          <Office />

          <button
            onClick={openWi}
            className="text-left rounded-lg border border-office-line bg-office-panel/60 p-3 hover:border-white/30 transition"
            aria-label="Open work item details"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-office-muted uppercase tracking-wide">Work item</p>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-office-line text-office-muted">
                    {workItem.id}
                  </span>
                </div>
                <p className="text-sm font-medium mt-1 truncate">{workItem.title}</p>
                <p className="mt-1.5 text-[11px] text-office-muted">{workItem.currentPhase}</p>
              </div>
              <div className="text-right text-[10px] flex flex-col items-end gap-1 shrink-0">
                <span className="px-1.5 py-0.5 rounded bg-office-line font-mono">
                  {workItem.status}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-iris/20 text-iris font-mono">
                  {workItem.currentMode}
                </span>
                {workItem.ownerAgentId && (
                  <span className="text-office-muted font-mono">
                    owner: {workItem.ownerAgentId}
                  </span>
                )}
              </div>
            </div>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <DecisionInbox />
          <ActivityLog />
        </div>
      </div>

      {openDecisions > 0 && (
        <div className="fixed bottom-4 left-4 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-medium animate-pulse-soft pointer-events-none">
          {openDecisions} decision{openDecisions > 1 ? "s" : ""} waiting on you
        </div>
      )}

      <AgentDrawer />
      <WorkItemDrawer />
    </main>
  );
}
