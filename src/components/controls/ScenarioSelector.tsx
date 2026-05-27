"use client";

import { useOfficeStore } from "@/state/officeStore";
import { SCENARIO_LIST, SCENARIOS, type ScenarioId } from "@/data/scenarios";

export default function ScenarioSelector() {
  const scenarioId = useOfficeStore((s) => s.scenarioId);
  const loadScenario = useOfficeStore((s) => s.loadScenario);
  const runState = useOfficeStore((s) => s.runState);

  const source = SCENARIOS[scenarioId].source;

  return (
    <label className="flex items-center gap-2 text-[11px] text-office-muted">
      <span className="uppercase tracking-wide">Scenario</span>
      <select
        value={scenarioId}
        onChange={(e) => loadScenario(e.target.value as ScenarioId)}
        disabled={runState === "running"}
        className="bg-office-panel border border-office-line rounded px-2 py-1 text-office-text font-mono disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Select scenario"
      >
        {SCENARIO_LIST.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
      {source === "observed" && (
        <span
          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-iris/20 text-iris ring-1 ring-iris/40"
          title="Observed scenario — sourced from a parsed Claude Code session (sample fixture in v0.1)"
        >
          v0.2 · observed
        </span>
      )}
    </label>
  );
}
