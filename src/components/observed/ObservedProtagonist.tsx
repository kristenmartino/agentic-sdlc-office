"use client";

import type { BeatSeverity } from "@/lib/observed-playback-reducer";

/**
 * The observed-mode protagonist — one little screen-faced robot, drawn in the
 * same flat 32×32 sprite language as the scripted office cast
 * (see office/sprites.tsx). It stands in for the single real agent a session
 * actually is (a real session is one agent, not eight specialists).
 *
 * Content-free by construction: the ONLY inputs are `severity` (the antenna
 * "mood light") and `active` (a gentle breathe). The current *action* is shown
 * by the adjacent glyph + phrase in the timeline, never drawn here — so nothing
 * payload-derived ever reaches this art. Purely decorative (`aria-hidden`); the
 * state it hints at is already announced in the surrounding text.
 */

/** Antenna light color per severity — mirrors the severity chips/dots. */
const SEVERITY_LIGHT: Record<BeatSeverity, string> = {
  info: "#9775FA", // iris — "working"
  success: "#34D399", // emerald-400 — "checks passed"
  warning: "#FBBF24", // amber-400
  error: "#F87171", // red-400 — "checks failed / stuck"
};

export default function ObservedProtagonist({
  severity,
  active = false,
  size = 22,
}: {
  severity: BeatSeverity;
  /** Gentle breathe + antenna pulse when this is the current beat. */
  active?: boolean;
  size?: number;
}) {
  const light = SEVERITY_LIGHT[severity];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`block ${active ? "animate-breathe motion-reduce:animate-none" : ""}`}
      aria-hidden
    >
      {/* antenna + mood light (severity) */}
      <line x1="16" y1="6" x2="16" y2="3.2" stroke="#8A8F9A" strokeWidth="1.4" strokeLinecap="round" />
      <circle
        cx="16"
        cy="2.4"
        r="2"
        fill={light}
        className={active ? "animate-pulse-soft motion-reduce:animate-none" : ""}
      />
      {/* ears */}
      <rect x="3" y="12.5" width="2.4" height="6" rx="1.2" fill="#7E5BE0" />
      <rect x="26.6" y="12.5" width="2.4" height="6" rx="1.2" fill="#7E5BE0" />
      {/* head */}
      <rect x="5" y="6" width="22" height="20" rx="6" fill="#9775FA" />
      {/* screen face */}
      <rect x="8.5" y="10" width="15" height="11" rx="3" fill="#0F1115" />
      {/* eyes */}
      <circle cx="13" cy="15" r="1.9" fill="#E6E8EC" />
      <circle cx="19" cy="15" r="1.9" fill="#E6E8EC" />
      {/* smile */}
      <path d="M12.8 18.4 Q16 20.4 19.2 18.4" stroke="#E6E8EC" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  );
}
