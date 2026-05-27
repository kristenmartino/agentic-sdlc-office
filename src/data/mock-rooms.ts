import type { Room, RoomId } from "../types/rooms";

export const MOCK_ROOMS: Room[] = [
  { id: "lobby", name: "Lobby", description: "Entry point for new work items." },
  { id: "product-research", name: "Product / Research", description: "Piper & Nova: capture intent, investigate." },
  { id: "architecture-design", name: "Architecture / Design", description: "Theo & Iris: plan structure and UI." },
  { id: "dev-floor", name: "Dev Floor", description: "Mira: implementation." },
  { id: "qa-lab", name: "QA Lab", description: "Tess: test and regress." },
  { id: "review-security", name: "Review / Security", description: "Rune: review, audit, threat-model." },
  { id: "human-office", name: "Human Office", description: "Cora + you. Decision Inbox lives here." },
  { id: "archive", name: "Archive", description: "Completed work items. Replay source." },
];

// 2 rows × 4 cols layout. Row 0 reads left→right, row 1 reads left→right.
export const ROOM_GRID: RoomId[][] = [
  ["lobby", "product-research", "architecture-design", "dev-floor"],
  ["archive", "review-security", "qa-lab", "human-office"],
];
