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

  return (
    <main className="min-h-screen p-6 max-w-[1280px] mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Agentic SDLC Office</h1>
          <p className="text-[11px] text-office-muted">v0.1 — Mock Visual Workflow Prototype</p>
        </div>
        <DemoControls />
      </header>

      <div className="grid grid-cols-[1fr_320px] gap-4">
        <div className="flex flex-col gap-4">
          <Office />

          <button
            onClick={openWi}
            className="text-left rounded-lg border border-office-line bg-office-panel/60 p-3 hover:border-white/30"
            aria-label="Open work item details"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-office-muted uppercase tracking-wide">Work item</p>
                <p className="text-sm font-medium mt-0.5">{workItem.title}</p>
              </div>
              <div className="text-right text-[10px] text-office-muted">
                <div>{workItem.status}</div>
                <div className="font-mono">{workItem.currentMode}</div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-office-muted">{workItem.currentPhase}</p>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <DecisionInbox />
          <ActivityLog />
        </div>
      </div>

      <AgentDrawer />
      <WorkItemDrawer />
    </main>
  );
}
