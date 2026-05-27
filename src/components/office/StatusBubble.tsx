"use client";

import type { AgentStatus } from "@/types/agents";

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "idle",
  thinking: "thinking",
  reading: "reading",
  planning: "planning",
  designing: "designing",
  coding: "coding",
  testing: "testing",
  reviewing: "reviewing",
  talking: "talking",
  meeting: "in meeting",
  waiting_on_agent: "waiting (agent)",
  waiting_on_human: "waiting (human)",
  blocked: "blocked",
  done: "done",
  failed: "failed",
};

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "bg-office-line text-office-muted",
  thinking: "bg-blue-900/40 text-blue-200",
  reading: "bg-blue-900/40 text-blue-200",
  planning: "bg-indigo-900/40 text-indigo-200",
  designing: "bg-purple-900/40 text-purple-200",
  coding: "bg-emerald-900/40 text-emerald-200",
  testing: "bg-teal-900/40 text-teal-200",
  reviewing: "bg-violet-900/40 text-violet-200",
  talking: "bg-amber-900/40 text-amber-200",
  meeting: "bg-amber-900/40 text-amber-200",
  waiting_on_agent: "bg-yellow-900/40 text-yellow-200",
  waiting_on_human: "bg-orange-900/40 text-orange-200",
  blocked: "bg-red-900/40 text-red-200",
  done: "bg-emerald-900/40 text-emerald-200",
  failed: "bg-red-900/60 text-red-200",
};

export default function StatusBubble({ status, message }: { status: AgentStatus; message: string | null }) {
  if (status === "idle") return null;
  return (
    <div className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono ${STATUS_COLOR[status]}`} title={message ?? undefined}>
      {STATUS_LABEL[status]}
    </div>
  );
}
