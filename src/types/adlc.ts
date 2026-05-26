export type ADLCMode =
  | "Intent"
  | "Generate"
  | "Validate"
  | "Govern"
  | "Deploy"
  | "Observe"
  | "Multi";

export const ALL_ADLC_MODES: readonly ADLCMode[] = [
  "Intent",
  "Generate",
  "Validate",
  "Govern",
  "Deploy",
  "Observe",
  "Multi",
] as const;
