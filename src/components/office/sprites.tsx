"use client";

import type { AgentId } from "@/types/agents";
import { AGENT_COLORS } from "@/data/mock-agents";

interface SpriteProps {
  agentId: AgentId;
  size?: number;
  /** True when the sprite should pulse (active states). */
  active?: boolean;
}

/**
 * Per-character bible silhouettes. Each draws inside a 32x32 viewBox so
 * the agent reads cleanly at small sizes. Strokes + 1 accent shape per agent.
 */
export default function AgentSilhouette({ agentId, size = 36, active = false }: SpriteProps) {
  const color = AGENT_COLORS[agentId];
  const className = `block ${active ? "animate-breathe" : ""}`;
  const common = { width: size, height: size, viewBox: "0 0 32 32", className };

  switch (agentId) {
    case "cora":
      // Rounded square + headset arc
      return (
        <svg {...common} aria-hidden>
          <rect x="6" y="6" width="20" height="20" rx="5" fill={color} />
          <path d="M9 13 Q16 5 23 13" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <circle cx="9" cy="14" r="1.6" fill="#fff" />
          <circle cx="23" cy="14" r="1.6" fill="#fff" />
        </svg>
      );

    case "piper":
      // Tall rectangle + notebook
      return (
        <svg {...common} aria-hidden>
          <rect x="8" y="4" width="16" height="24" rx="3" fill={color} />
          <rect x="11" y="11" width="10" height="13" rx="1" fill="#fff" opacity=".95" />
          <line x1="13" y1="14" x2="19" y2="14" stroke={color} strokeWidth="1" strokeLinecap="round" />
          <line x1="13" y1="17" x2="19" y2="17" stroke={color} strokeWidth="1" strokeLinecap="round" />
          <line x1="13" y1="20" x2="17" y2="20" stroke={color} strokeWidth="1" strokeLinecap="round" />
        </svg>
      );

    case "nova":
      // Rounded rectangle + magnifier
      return (
        <svg {...common} aria-hidden>
          <rect x="5" y="7" width="22" height="18" rx="5" fill={color} />
          <circle cx="14" cy="16" r="4" fill="none" stroke="#fff" strokeWidth="1.6" />
          <line x1="17" y1="19" x2="21" y2="23" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case "theo":
      // Wide rectangle + right-angled headline
      return (
        <svg {...common} aria-hidden>
          <rect x="3" y="8" width="26" height="16" rx="3" fill={color} />
          <polyline points="8,18 12,12 20,12 24,18" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="16" cy="20" r="1.4" fill="#fff" />
        </svg>
      );

    case "iris":
      // Circle + brush angle
      return (
        <svg {...common} aria-hidden>
          <circle cx="16" cy="16" r="11" fill={color} />
          <path d="M10 22 L18 12 L22 16 L14 26 Z" fill="#fff" opacity=".95" />
          <circle cx="10" cy="22" r="1.6" fill={color} />
        </svg>
      );

    case "mira":
      // Square + screen overlay
      return (
        <svg {...common} aria-hidden>
          <rect x="5" y="5" width="22" height="22" rx="3" fill={color} />
          <rect x="9" y="10" width="14" height="10" rx="1" fill="#fff" opacity=".95" />
          <rect x="11" y="13" width="2.2" height="2.2" fill={color} />
          <rect x="14.6" y="13" width="2.2" height="2.2" fill={color} />
          <line x1="9" y1="22.5" x2="23" y2="22.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );

    case "tess":
      // Rounded square + checkbox
      return (
        <svg {...common} aria-hidden>
          <rect x="6" y="6" width="20" height="20" rx="4" fill={color} />
          <rect x="11" y="11" width="10" height="10" rx="1.5" fill="none" stroke="#fff" strokeWidth="1.6" />
          <polyline points="13,16 15.5,18.5 19.5,13.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case "rune":
      // Square + lock
      return (
        <svg {...common} aria-hidden>
          <rect x="6" y="6" width="20" height="20" rx="3" fill={color} />
          <rect x="11" y="15" width="10" height="8" rx="1.5" fill="#fff" opacity=".95" />
          <path d="M13 15 V13 a3 3 0 0 1 6 0 V15" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="16" cy="19" r="1.2" fill={color} />
        </svg>
      );
  }
}
