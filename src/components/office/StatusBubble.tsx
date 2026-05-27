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
  waiting_on_agent: "waiting on agent",
  waiting_on_human: "waiting on human",
  blocked: "blocked",
  done: "done",
  failed: "failed",
};

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "bg-office-line text-office-muted",
  thinking: "bg-blue-900/50 text-blue-100 ring-1 ring-blue-500/30",
  reading: "bg-blue-900/50 text-blue-100 ring-1 ring-blue-500/30",
  planning: "bg-indigo-900/50 text-indigo-100 ring-1 ring-indigo-500/30",
  designing: "bg-purple-900/50 text-purple-100 ring-1 ring-purple-500/30",
  coding: "bg-emerald-900/50 text-emerald-100 ring-1 ring-emerald-500/30",
  testing: "bg-teal-900/50 text-teal-100 ring-1 ring-teal-500/30",
  reviewing: "bg-violet-900/50 text-violet-100 ring-1 ring-violet-500/30",
  talking: "bg-amber-900/50 text-amber-100 ring-1 ring-amber-500/30",
  meeting: "bg-amber-900/50 text-amber-100 ring-1 ring-amber-500/30",
  waiting_on_agent: "bg-yellow-900/50 text-yellow-100 ring-1 ring-yellow-500/30",
  waiting_on_human: "bg-orange-900/50 text-orange-100 ring-1 ring-orange-500/40 animate-pulse-soft",
  blocked: "bg-red-900/50 text-red-100 ring-1 ring-red-500/40",
  done: "bg-emerald-900/50 text-emerald-100 ring-1 ring-emerald-500/30",
  failed: "bg-red-900/60 text-red-100 ring-1 ring-red-500/50",
};

export default function StatusBubble({ status, message }: { status: AgentStatus; message: string | null }) {
  if (status === "idle") return null;
  return (
    <div
      className={`mt-1 px-1.5 py-[2px] rounded text-[10px] font-medium leading-tight whitespace-nowrap ${STATUS_COLOR[status]}`}
      title={message ?? undefined}
    >
      {STATUS_LABEL[status]}
    </div>
  );
}
