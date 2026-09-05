export interface RecordedToolCall {
  toolId: string;
  result: unknown;
  isGrounding: boolean;
}

export interface AdvisorTurnSummary {
  toolIds: string[];
  plannedCount: number;
  refusalReasons: string[];
}
