"use client";

import type { RoomId } from "@/types/rooms";

/**
 * Per-room signature element from the room bible.
 * Sits in the upper-right of each room card. Subtle — decoration, not focus.
 */
export default function RoomDecor({ roomId, size = 36 }: { roomId: RoomId; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    className: "text-office-muted opacity-50",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (roomId) {
    case "lobby":
      // Welcome desk
      return (
        <svg {...common} aria-hidden>
          <rect x="6" y="18" width="20" height="6" rx="1" />
          <line x1="6" y1="22" x2="26" y2="22" />
          <circle cx="10" cy="14" r="2.5" />
          <circle cx="22" cy="14" r="2.5" />
        </svg>
      );

    case "product-research":
      // Whiteboard
      return (
        <svg {...common} aria-hidden>
          <rect x="5" y="7" width="22" height="14" rx="1" />
          <line x1="9" y1="11" x2="20" y2="11" />
          <line x1="9" y1="14" x2="23" y2="14" />
          <line x1="9" y1="17" x2="17" y2="17" />
          <line x1="16" y1="21" x2="16" y2="25" />
        </svg>
      );

    case "architecture-design":
      // Drafting table
      return (
        <svg {...common} aria-hidden>
          <polygon points="6,22 26,22 22,8 10,8" />
          <line x1="10" y1="15" x2="22" y2="15" />
          <line x1="14" y1="10" x2="14" y2="20" />
          <line x1="18" y1="10" x2="18" y2="20" />
        </svg>
      );

    case "dev-floor":
      // Monitor cluster
      return (
        <svg {...common} aria-hidden>
          <rect x="5" y="7" width="22" height="14" rx="1" />
          <line x1="5" y1="17" x2="27" y2="17" />
          <line x1="16" y1="21" x2="16" y2="24" />
          <line x1="11" y1="24" x2="21" y2="24" />
          <text x="10" y="15" fontSize="6" fontFamily="monospace" fill="currentColor" stroke="none">{"_"}</text>
        </svg>
      );

    case "qa-lab":
      // Checklist board
      return (
        <svg {...common} aria-hidden>
          <rect x="7" y="5" width="18" height="22" rx="1.5" />
          <polyline points="10,11 12,13 15,9" />
          <line x1="17" y1="11" x2="22" y2="11" />
          <polyline points="10,17 12,19 15,15" />
          <line x1="17" y1="17" x2="22" y2="17" />
          <rect x="10" y="21" width="2.5" height="2.5" />
          <line x1="14" y1="22.5" x2="22" y2="22.5" />
        </svg>
      );

    case "review-security":
      // Lock + inspection
      return (
        <svg {...common} aria-hidden>
          <rect x="9" y="14" width="14" height="11" rx="1.5" />
          <path d="M12 14 V11 a4 4 0 0 1 8 0 V14" />
          <circle cx="16" cy="19" r="1.6" />
          <line x1="22" y1="6" x2="26" y2="10" />
          <circle cx="20" cy="8" r="2" />
        </svg>
      );

    case "human-office":
      // Larger desk + chair
      return (
        <svg {...common} aria-hidden>
          <rect x="4" y="16" width="24" height="3" />
          <line x1="6" y1="19" x2="6" y2="26" />
          <line x1="26" y1="19" x2="26" y2="26" />
          <rect x="13" y="8" width="6" height="8" rx="1" />
          <line x1="11" y1="13" x2="13" y2="13" />
          <line x1="19" y1="13" x2="21" y2="13" />
        </svg>
      );

    case "archive":
      // Filing wall
      return (
        <svg {...common} aria-hidden>
          <rect x="5" y="6" width="22" height="20" rx="1" />
          <line x1="5" y1="12" x2="27" y2="12" />
          <line x1="5" y1="18" x2="27" y2="18" />
          <line x1="5" y1="24" x2="27" y2="24" />
          <line x1="14" y1="9" x2="18" y2="9" />
          <line x1="14" y1="15" x2="18" y2="15" />
          <line x1="14" y1="21" x2="18" y2="21" />
        </svg>
      );
  }
}
