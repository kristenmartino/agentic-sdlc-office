export type RoomId =
  | "lobby"
  | "product-research"
  | "architecture-design"
  | "dev-floor"
  | "qa-lab"
  | "review-security"
  | "human-office"
  | "archive";

export interface Room {
  id: RoomId;
  name: string;
  description?: string;
}
