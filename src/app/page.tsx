"use client";

import { useMemo } from "react";
import { useOfficeStore } from "@/state/officeStore";
import { SCENARIOS } from "@/data/scenarios";
import Office from "@/components/office/Office";
import HandoffIndicator from "@/components/office/HandoffIndicator";
import PhaseTimeline from "@/components/office/PhaseTimeline";
import DemoControls from "@/components/controls/DemoControls";
import ScenarioSelector from "@/components/controls/ScenarioSelector";
import DecisionInbox from "@/components/decisions/DecisionInbox";
import ActivityLog from "@/components/activity/ActivityLog";
import AgentDrawer from "@/components/drawers/AgentDrawer";
import WorkItemDrawer from "@/components/drawers/WorkItemDrawer";
import ObservedBeatTimeline from "@/components/observed/ObservedBeatTimeline";
import { reduceObservedPlayback } from "@/lib/observed-playback-reducer";

export default function Page() {
  const scenarioId = useOfficeStore((s) => s.scenarioId);
  const workItem = useOfficeStore((s) => s.workItem);
  const log = useOfficeStore((s) => s.log);
  const openWi = useOfficeStore((s) => s.openWorkItemDrawer);
  const decisions = useOfficeStore((s) => s.decisions);
  const openDecisions = decisions.filter((d) => !d.resolved).length;

  const runState = useOfficeStore((s) => s.runState);

  const scenario = SCENARIOS[scenarioId];
  // Render spike: for observed mode, reduce the replayed event log into
  // VisualBeats so the timeline forms live as playback advances.
  const observedBeats = useMemo(() => reduceObservedPlayback(log), [log]);
  const isIncident = scenario.kind === "bug";
  const isObserved = scenario.source === "observed";
  const runHasStarted = log.length > 0;
  const showIncidentBanner = isIncident && runHasStarted;
  const showObservedBanner = isObserved;
  const showIdleHero = !runHasStarted && runState === "idle";

  return (
    <main className={`min-h-screen p-6 max-w-[1280px] mx-auto transition-colors ${
      showIncidentBanner ? "bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.06),transparent_50%)]" : ""
    } ${
      showObservedBanner ? "bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.05),transparent_50%)]" : ""
    }`}>
      {showIncidentBanner && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-red-500/40 bg-red-950/30 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse-soft" />
          <p className="text-[11px] font-medium text-red-200">
            Incident in progress — {workItem.id.toUpperCase().replace("WI_", "")}
          </p>
          <p className="text-[10px] text-red-300/70 truncate">
            {workItem.title}
          </p>
        </div>
      )}

      {showObservedBanner && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-iris/40 bg-iris/5 flex items-center gap-3 flex-wrap">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-iris/20 text-iris ring-1 ring-iris/40">
            v0.2 PREVIEW
          </span>
          <p className="text-[11px] font-medium text-iris">
            Observer mode — read-only
          </p>
          {scenario.origin && (
            <p className="text-[10px] text-office-muted truncate font-mono">
              {scenario.origin.source} · session loaded · captured{" "}
              {new Date(scenario.origin.capturedAt).toLocaleString()}
            </p>
          )}
          <p className="text-[10px] text-office-muted/80">
            Sample fixture · parser/mapper preview · file loading not yet built.
          </p>
        </div>
      )}

      <header className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-cora/30 to-iris/20 border border-office-line flex items-center justify-center">
            <span className="text-sm font-bold text-cora">A</span>
          </div>
          <div>
            <h1 className="text-base font-semibold leading-none">Agentic SDLC Office</h1>
            <p className="text-[11px] text-office-muted mt-0.5">
              v0.1 — {scenario.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ScenarioSelector />
          <DemoControls />
        </div>
      </header>

      {showIdleHero && (
        <div className="mb-4 rounded-lg border border-cora/30 bg-gradient-to-r from-cora/5 via-iris/5 to-office-panel/40 p-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-office-text">
              Ready to play <span className="font-mono text-cora">{scenario.title}</span>
            </p>
            <p className="text-[11px] text-office-muted mt-1">
              {scenario.subtitle} ·{" "}
              <span className="font-mono">{scenario.events.length} events</span>,{" "}
              ~{Math.ceil((scenario.events.length * 1.4) / 60)} min including pauses.
            </p>
            <p className="text-[10px] text-amber-300/80 mt-2">
              Click <span className="font-mono">Start Demo</span> above to begin. The Decision Inbox will
              flag when the office needs you.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 text-[10px] text-office-muted shrink-0">
            <span className="font-mono">8 agents · 8 rooms</span>
            <span className="font-mono">{scenario.kind === "bug" ? "incident" : "feature"} flow</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1fr_320px] gap-4">
        <div className="flex flex-col gap-4">
          {isObserved ? (
            <>
              {/* Observed mode: the beat timeline IS the stage. The 8-room
                  relay office is the scripted operating model and would render
                  mostly-dead for a real single-agent session, so it's hidden
                  here rather than shown half-empty. */}
              <ObservedBeatTimeline beats={observedBeats} />
              <p className="text-[10px] text-office-muted/70 leading-snug px-1">
                Observed mode renders one real session as an activity timeline, not a
                multi-agent relay. The 8-room office is the{" "}
                <span className="text-office-muted">scripted</span> operating model —
                switch to a scripted scenario to see it.
              </p>
            </>
          ) : (
            <>
              <PhaseTimeline />
              <Office />
              <HandoffIndicator />
            </>
          )}

          <button
            onClick={openWi}
            className={`text-left rounded-lg border bg-office-panel/60 p-3 hover:border-white/30 transition ${
              isIncident ? "border-red-500/30" : "border-office-line"
            }`}
            aria-label="Open work item details"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-office-muted uppercase tracking-wide">
                    {workItem.kind === "bug" ? "Bug" : "Work item"}
                  </p>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-office-line text-office-muted">
                    {workItem.id}
                  </span>
                  {isIncident && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                      incident
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium mt-1 truncate">{workItem.title}</p>
                <p className="mt-1.5 text-[11px] text-office-muted">{workItem.currentPhase}</p>
              </div>
              <div className="text-right text-[10px] flex flex-col items-end gap-1 shrink-0">
                <span className="px-1.5 py-0.5 rounded bg-office-line font-mono">
                  {workItem.status}
                </span>
                <span className={`px-1.5 py-0.5 rounded font-mono ${
                  isIncident ? "bg-red-500/20 text-red-300" : "bg-iris/20 text-iris"
                }`}>
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
        <div className={`fixed bottom-4 left-4 px-3 py-1.5 rounded-full border text-[11px] font-medium animate-pulse-soft pointer-events-none ${
          isIncident
            ? "bg-red-500/15 border-red-500/30 text-red-300"
            : "bg-amber-500/15 border-amber-500/30 text-amber-300"
        }`}>
          {openDecisions} decision{openDecisions > 1 ? "s" : ""} waiting on you
        </div>
      )}

      <AgentDrawer />
      <WorkItemDrawer />
    </main>
  );
}
