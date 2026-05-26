import type { AgentInstance } from "../types/agents";

export const MOCK_AGENTS: AgentInstance[] = [
  { id: "cora",  name: "Cora",  role: "Delivery Lead / Orchestrator", primaryRoom: "human-office",         primaryModes: ["Govern", "Multi"],     currentRoom: "human-office",         status: "idle" },
  { id: "piper", name: "Piper", role: "Product Strategist",           primaryRoom: "product-research",     primaryModes: ["Intent"],              currentRoom: "product-research",     status: "idle" },
  { id: "nova",  name: "Nova",  role: "Researcher",                   primaryRoom: "product-research",     primaryModes: ["Intent", "Generate"],  currentRoom: "product-research",     status: "idle" },
  { id: "theo",  name: "Theo",  role: "Systems Architect",            primaryRoom: "architecture-design",  primaryModes: ["Generate"],            currentRoom: "architecture-design",  status: "idle" },
  { id: "iris",  name: "Iris",  role: "UI Designer",                  primaryRoom: "architecture-design",  primaryModes: ["Generate"],            currentRoom: "architecture-design",  status: "idle" },
  { id: "mira",  name: "Mira",  role: "Builder",                      primaryRoom: "dev-floor",            primaryModes: ["Generate"],            currentRoom: "dev-floor",            status: "idle" },
  { id: "tess",  name: "Tess",  role: "QA Engineer",                  primaryRoom: "qa-lab",               primaryModes: ["Validate"],            currentRoom: "qa-lab",               status: "idle" },
  { id: "rune",  name: "Rune",  role: "Reviewer / Security",          primaryRoom: "review-security",      primaryModes: ["Validate", "Govern"],  currentRoom: "review-security",      status: "idle" },
];
