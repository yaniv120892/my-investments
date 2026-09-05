export interface AdvisorTurnRecord {
  userId: string;
  toolIds: string[];
  plannedCount: number;
  refusalReasons: string[];
  isGrounded: boolean;
  ungrounded: string[];
  replyChars: number;
  durationMs: number;
}
