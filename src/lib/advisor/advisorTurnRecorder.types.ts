import type { ContributionPlanAccepted } from "@/lib/pricing/contributionPlanner.types";

export interface RecordedToolCall {
  toolId: string;
  result: unknown;
}

export interface AdvisorTurnSummary {
  toolIds: string[];
  plannedCount: number;
  refusalReasons: string[];
}

export type { ContributionPlanAccepted };
