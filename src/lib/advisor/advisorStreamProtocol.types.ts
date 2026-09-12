import type { ContributionPlanAccepted } from "@/lib/pricing/contributionPlanner.types";

export type AdvisorStreamFrame =
  | { type: "delta"; value: string }
  | { type: "plan"; value: ContributionPlanAccepted }
  | { type: "done" }
  | { type: "error"; message: string };
